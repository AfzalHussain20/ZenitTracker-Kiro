import { useState, useCallback, useRef } from 'react';
import type { GeneratedTestCase } from '@/types/test-cases';

/**
 * Phase 7: Hook for consuming Server-Sent Events (SSE) from the streaming
 * test case generation endpoint. Test cases appear one batch at a time
 * instead of waiting for the full response.
 */

export interface StreamProgress {
  pass: number;
  status: 'fetching' | 'generating' | 'warning' | 'complete';
  message: string;
  totalPasses?: number;
}

export interface StreamBatch {
  testCases: GeneratedTestCase[];
  pass: number;
  passName: string;
  batchIndex: number;
  batchCount: number;
}

interface UseStreamingGenerationReturn {
  /** Start streaming generation */
  startStream: (pageId: string, passes?: string[]) => void;
  /** Cancel an in-progress stream */
  cancelStream: () => void;
  /** Whether streaming is currently in progress */
  isStreaming: boolean;
  /** Current progress message */
  progress: StreamProgress | null;
  /** All test cases received so far (accumulates across batches) */
  testCases: GeneratedTestCase[];
  /** Each batch as it arrives */
  batches: StreamBatch[];
  /** Total test cases generated */
  totalGenerated: number;
  /** Error message if streaming failed */
  error: string | null;
  /** Model used for generation */
  modelUsed: string | null;
  /** Whether streaming completed successfully */
  isComplete: boolean;
}

export function useStreamingGeneration(): UseStreamingGenerationReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [progress, setProgress] = useState<StreamProgress | null>(null);
  const [testCases, setTestCases] = useState<GeneratedTestCase[]>([]);
  const [batches, setBatches] = useState<StreamBatch[]>([]);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const startStream = useCallback((pageId: string, passes?: string[]) => {
    // Reset state
    setIsStreaming(true);
    setProgress(null);
    setTestCases([]);
    setBatches([]);
    setTotalGenerated(0);
    setError(null);
    setModelUsed(null);
    setIsComplete(false);

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch('/api/ai/generate-tests-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId, passes }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Stream failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          let currentEvent = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.substring(6);

              if (currentEvent && currentData) {
                try {
                  const data = JSON.parse(currentData);
                  handleSSEEvent(currentEvent, data);
                } catch {
                  // Skip malformed JSON
                }
                currentEvent = '';
                currentData = '';
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setProgress({ pass: 0, status: 'warning', message: 'Generation cancelled' });
        } else {
          setError(err.message || 'Stream generation failed');
        }
      } finally {
        setIsStreaming(false);
      }
    })();

    function handleSSEEvent(event: string, data: any) {
      switch (event) {
        case 'progress':
          setProgress(data as StreamProgress);
          break;

        case 'testcases': {
          const batch = data as StreamBatch;
          setBatches(prev => [...prev, batch]);
          setTestCases(prev => [...prev, ...batch.testCases]);
          setTotalGenerated(prev => prev + batch.batchCount);
          break;
        }

        case 'complete':
          setModelUsed(data.modelUsed || null);
          setTotalGenerated(data.totalGenerated || 0);
          setIsComplete(true);
          setProgress({ pass: 0, status: 'complete', message: 'Generation complete' });
          break;

        case 'error':
          setError(data.message || 'Unknown streaming error');
          break;
      }
    }
  }, []);

  return {
    startStream,
    cancelStream,
    isStreaming,
    progress,
    testCases,
    batches,
    totalGenerated,
    error,
    modelUsed,
    isComplete,
  };
}
