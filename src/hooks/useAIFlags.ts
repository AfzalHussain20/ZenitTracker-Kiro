import { useState, useEffect, useCallback } from 'react';
import type { AIFeatureFlags, AIFeatureKey, AIProviderKey } from '@/lib/ai/feature-flags';

interface UseAIFlagsReturn {
  flags: AIFeatureFlags | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  featureLabels: Record<string, { label: string; description: string; icon: string }>;
  providerLabels: Record<string, { label: string; description: string; color: string }>;
  /** Toggle a single feature on/off */
  toggleFeature: (key: AIFeatureKey) => Promise<void>;
  /** Toggle a single provider on/off */
  toggleProvider: (key: AIProviderKey) => Promise<void>;
  /** Check if a specific feature is enabled (returns true if flags not loaded yet) */
  isEnabled: (feature: AIFeatureKey, provider?: AIProviderKey) => boolean;
  /** Reload flags from server */
  refresh: () => Promise<void>;
}

export function useAIFlags(): UseAIFlagsReturn {
  const [flags, setFlags] = useState<AIFeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featureLabels, setFeatureLabels] = useState<Record<string, any>>({});
  const [providerLabels, setProviderLabels] = useState<Record<string, any>>({});

  const fetchFlags = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/ai/feature-flags');
      const data = await res.json();
      if (data.flags) {
        setFlags(data.flags);
        setFeatureLabels(data.featureLabels || {});
        setProviderLabels(data.providerLabels || {});
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const toggleFeature = useCallback(async (key: AIFeatureKey) => {
    if (!flags) return;
    const updated = {
      ...flags.features,
      [key]: !flags.features[key],
    };
    // Optimistic update
    setFlags(prev => prev ? { ...prev, features: updated } : prev);
    setSaving(true);
    try {
      await fetch('/api/ai/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: updated }),
      });
    } catch {
      // Revert on failure
      await fetchFlags();
    } finally {
      setSaving(false);
    }
  }, [flags, fetchFlags]);

  const toggleProvider = useCallback(async (key: AIProviderKey) => {
    if (!flags) return;
    const updated = {
      ...flags.providers,
      [key]: !flags.providers[key],
    };
    setFlags(prev => prev ? { ...prev, providers: updated } : prev);
    setSaving(true);
    try {
      await fetch('/api/ai/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: updated }),
      });
    } catch {
      await fetchFlags();
    } finally {
      setSaving(false);
    }
  }, [flags, fetchFlags]);

  const isEnabled = useCallback((feature: AIFeatureKey, provider: AIProviderKey = 'gemini'): boolean => {
    if (!flags) return true; // default allow while loading
    return flags.features[feature] !== false && flags.providers[provider] !== false;
  }, [flags]);

  return {
    flags,
    loading,
    saving,
    error,
    featureLabels,
    providerLabels,
    toggleFeature,
    toggleProvider,
    isEnabled,
    refresh: fetchFlags,
  };
}
