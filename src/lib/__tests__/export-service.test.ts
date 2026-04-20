/**
 * Unit tests for ExportService
 */

import { ExportService } from '../export-service';
import { ExportConfig } from '@/types/bug-analytics';
import { FirebaseConnector } from '../firebase-connector';
import * as XLSX from 'xlsx';

// Mock dependencies
jest.mock('xlsx');
jest.mock('jspdf');
jest.mock('jspdf-autotable');
jest.mock('../firebase-connector');

describe('ExportService', () => {
  let exportService: ExportService;
  let mockConnector: any;

  beforeEach(() => {
    mockConnector = {
      create: jest.fn(),
      query: jest.fn(),
      delete: jest.fn(),
    };
    exportService = new ExportService(mockConnector as FirebaseConnector);
  });

  describe('exportToExcel', () => {
    it('should export data to Excel format', async () => {
      const sampleData = [
        { id: '1', title: 'Bug 1', severity: 'high' },
        { id: '2', title: 'Bug 2', severity: 'medium' },
      ];

      const config: ExportConfig = {
        format: 'excel',
        data: sampleData,
        fileName: 'test-export',
        metadata: {
          exportDate: new Date(),
          exportedBy: 'user123',
          filters: { severity: 'high' },
        },
      };

      // Mock XLSX functions
      const mockWorkbook = { SheetNames: [], Sheets: {} };
      const mockWorksheet = {};
      (XLSX.utils.book_new as jest.Mock) = jest.fn(() => mockWorkbook);
      (XLSX.utils.json_to_sheet as jest.Mock) = jest.fn(() => mockWorksheet);
      (XLSX.utils.book_append_sheet as jest.Mock) = jest.fn();
      (XLSX.write as jest.Mock) = jest.fn(() => new ArrayBuffer(8));

      const result = await exportService.exportToExcel(config);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should include metadata sheet when metadata is provided', async () => {
      const config: ExportConfig = {
        format: 'excel',
        data: [{ id: '1', title: 'Test' }],
        fileName: 'test',
        metadata: {
          exportDate: new Date(),
          exportedBy: 'user123',
          filters: {},
        },
      };

      const mockWorkbook = { SheetNames: [], Sheets: {} };
      (XLSX.utils.book_new as jest.Mock) = jest.fn(() => mockWorkbook);
      (XLSX.utils.json_to_sheet as jest.Mock) = jest.fn(() => ({}));
      (XLSX.utils.book_append_sheet as jest.Mock) = jest.fn();
      (XLSX.write as jest.Mock) = jest.fn(() => new ArrayBuffer(8));

      await exportService.exportToExcel(config);

      expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(2); // Data + Metadata
    });
  });

  describe('exportToCSV', () => {
    it('should export data to CSV format with proper escaping', async () => {
      const sampleData = [
        { id: '1', title: 'Bug 1', description: 'Test, with comma' },
        { id: '2', title: 'Bug 2', description: 'Test "with quotes"' },
      ];

      const config: ExportConfig = {
        format: 'csv',
        data: sampleData,
        fileName: 'test-export',
      };

      const result = await exportService.exportToCSV(config);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('text/csv;charset=utf-8;');

      // Read blob content
      const text = await result.text();
      expect(text).toContain('id,title,description');
      expect(text).toContain('"Test, with comma"'); // Comma should be escaped
      expect(text).toContain('Test ""with quotes""'); // Quotes should be escaped
    });

    it('should include metadata as comments when provided', async () => {
      const config: ExportConfig = {
        format: 'csv',
        data: [{ id: '1', title: 'Test' }],
        fileName: 'test',
        metadata: {
          exportDate: new Date('2024-01-01'),
          exportedBy: 'user123',
          filters: { status: 'open' },
        },
      };

      const result = await exportService.exportToCSV(config);
      const text = await result.text();

      expect(text).toContain('# Export Date:');
      expect(text).toContain('# Exported By: user123');
      expect(text).toContain('# Record Count: 1');
    });
  });

  describe('exportToPDF', () => {
    it('should export data to PDF format', async () => {
      const sampleData = [
        { id: '1', title: 'Bug 1', severity: 'high' },
        { id: '2', title: 'Bug 2', severity: 'medium' },
      ];

      const config: ExportConfig = {
        format: 'pdf',
        data: sampleData,
        fileName: 'test-export',
      };

      const result = await exportService.exportToPDF(config);

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('scheduleExport', () => {
    it('should create a scheduled export', async () => {
      const schedule = {
        userId: 'user123',
        frequency: 'weekly' as const,
        format: 'excel' as const,
        query: { status: 'open' },
        emailTo: ['user@example.com'],
        nextRunDate: new Date(),
      };

      mockConnector.create.mockResolvedValue('schedule123');

      const scheduleId = await exportService.scheduleExport('user123', schedule);

      expect(scheduleId).toBe('schedule123');
      expect(mockConnector.create).toHaveBeenCalledWith('export_schedules', expect.objectContaining({
        userId: 'user123',
        frequency: 'weekly',
      }));
    });
  });

  describe('getScheduledExports', () => {
    it('should retrieve scheduled exports for a user', async () => {
      const mockSchedules = [
        {
          id: 'schedule1',
          userId: 'user123',
          frequency: 'weekly',
          format: 'excel',
          query: {},
          emailTo: [],
          nextRunDate: new Date(),
        },
      ];

      mockConnector.query.mockResolvedValue(mockSchedules);

      const result = await exportService.getScheduledExports('user123');

      expect(result).toEqual(mockSchedules);
      expect(mockConnector.query).toHaveBeenCalledWith('export_schedules', expect.objectContaining({
        where: [{ field: 'userId', operator: '==', value: 'user123' }],
      }));
    });
  });

  describe('cancelScheduledExport', () => {
    it('should delete a scheduled export', async () => {
      mockConnector.delete.mockResolvedValue(undefined);

      await exportService.cancelScheduledExport('schedule123');

      expect(mockConnector.delete).toHaveBeenCalledWith('export_schedules', 'schedule123');
    });
  });

  describe('generateFileName', () => {
    it('should generate filename with timestamp', () => {
      const fileName = exportService.generateFileName('bugs', 'excel');

      expect(fileName).toContain('bugs');
      expect(fileName).toContain('.xlsx');
      expect(fileName).toMatch(/\d{4}-\d{2}-\d{2}/); // Date pattern
    });

    it('should include filters in filename', () => {
      const fileName = exportService.generateFileName('bugs', 'csv', { severity: 'high', status: 'open' });

      expect(fileName).toContain('severity');
      expect(fileName).toContain('status');
      expect(fileName).toContain('.csv');
    });
  });
});
