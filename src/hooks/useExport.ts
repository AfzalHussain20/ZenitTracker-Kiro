/**
 * useExport Hook
 * Manages data export operations
 */

import { useState, useCallback } from 'react';
import { ExportService } from '@/lib/export-service';
import { FirebaseConnector } from '@/lib/firebase-connector';
import { db } from '@/lib/firebaseConfig';
import { ExportConfig } from '@/types/bug-analytics';

interface UseExportReturn {
  exportData: (config: ExportConfig) => Promise<void>;
  exporting: boolean;
  progress: number;
  error: Error | null;
}

export function useExport(): UseExportReturn {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [service] = useState(() => {
    const connector = new FirebaseConnector(db);
    return new ExportService(connector);
  });

  const exportData = useCallback(
    async (config: ExportConfig) => {
      setExporting(true);
      setProgress(0);
      setError(null);

      try {
        let blob: Blob;

        switch (config.format) {
          case 'excel':
            setProgress(30);
            blob = await service.exportToExcel(config);
            break;
          case 'csv':
            setProgress(30);
            blob = await service.exportToCSV(config);
            break;
          case 'pdf':
            setProgress(30);
            blob = await service.exportToPDF(config);
            break;
          default:
            throw new Error(`Unsupported format: ${config.format}`);
        }

        setProgress(80);

        // Download the file
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = config.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
      } catch (err) {
        setError(err as Error);
      } finally {
        setExporting(false);
        setTimeout(() => setProgress(0), 1000);
      }
    },
    [service]
  );

  return {
    exportData,
    exporting,
    progress,
    error,
  };
}
