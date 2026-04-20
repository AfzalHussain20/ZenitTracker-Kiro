/**
 * Export Service - Handles data export to Excel, CSV, and PDF formats
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExportConfig, ExportSchedule, ExportMetadata, ColumnDefinition } from '@/types/bug-analytics';
import { Timestamp } from 'firebase/firestore';
import { FirebaseConnector } from './firebase-connector';

export class ExportService {
  constructor(private connector?: FirebaseConnector) {}

  /**
   * Export data to Excel format using SheetJS
   */
  async exportToExcel(config: ExportConfig): Promise<Blob> {
    const { data, fileName, metadata, columns } = config;

    // Transform data using column definitions if provided
    const transformedData = columns
      ? data.map(row => this.transformRow(row, columns))
      : data;

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(transformedData);

    // Add metadata sheet if provided
    if (metadata) {
      const metadataSheet = XLSX.utils.json_to_sheet([
        { Field: 'Export Date', Value: metadata.exportDate.toISOString() },
        { Field: 'Exported By', Value: metadata.exportedBy },
        { Field: 'Filters', Value: JSON.stringify(metadata.filters) },
        { Field: 'Record Count', Value: data.length },
      ]);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Export data to CSV format with proper escaping
   */
  async exportToCSV(config: ExportConfig): Promise<Blob> {
    const { data, columns, metadata } = config;

    // Transform data using column definitions if provided
    const transformedData = columns
      ? data.map(row => this.transformRow(row, columns))
      : data;

    // Get headers
    const headers = columns
      ? columns.map(col => col.label)
      : Object.keys(transformedData[0] || {});

    // Build CSV content
    let csvContent = '';

    // Add metadata as comments if provided
    if (metadata) {
      csvContent += `# Export Date: ${metadata.exportDate.toISOString()}\n`;
      csvContent += `# Exported By: ${metadata.exportedBy}\n`;
      csvContent += `# Record Count: ${data.length}\n`;
      csvContent += `# Filters: ${JSON.stringify(metadata.filters)}\n`;
      csvContent += '\n';
    }

    // Add headers
    csvContent += headers.map(h => this.escapeCSVValue(h)).join(',') + '\n';

    // Add data rows
    for (const row of transformedData) {
      const values = columns
        ? columns.map(col => row[col.label])
        : Object.values(row);
      csvContent += values.map(v => this.escapeCSVValue(v)).join(',') + '\n';
    }

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * Export data to PDF format using jsPDF
   */
  async exportToPDF(config: ExportConfig): Promise<Blob> {
    const { data, fileName, metadata, columns } = config;

    // Create PDF document
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text(fileName || 'Export', 14, 15);

    // Add metadata if provided
    if (metadata) {
      doc.setFontSize(10);
      let yPos = 25;
      doc.text(`Export Date: ${metadata.exportDate.toLocaleString()}`, 14, yPos);
      yPos += 6;
      doc.text(`Exported By: ${metadata.exportedBy}`, 14, yPos);
      yPos += 6;
      doc.text(`Record Count: ${data.length}`, 14, yPos);
      yPos += 10;
    }

    // Transform data using column definitions if provided
    const transformedData = columns
      ? data.map(row => this.transformRow(row, columns))
      : data;

    // Prepare table data
    const headers = columns
      ? columns.map(col => col.label)
      : Object.keys(transformedData[0] || {});

    const body = transformedData.map(row =>
      columns
        ? columns.map(col => String(row[col.label] || ''))
        : Object.values(row).map(v => String(v || ''))
    );

    // Add table
    autoTable(doc, {
      head: [headers],
      body: body,
      startY: metadata ? 45 : 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    // Convert to Blob
    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }

  /**
   * Schedule a recurring export
   */
  async scheduleExport(userId: string, schedule: Omit<ExportSchedule, 'id'>): Promise<string> {
    if (!this.connector) {
      throw new Error('FirebaseConnector is required for scheduling exports');
    }

    const scheduleData: Omit<ExportSchedule, 'id'> = {
      ...schedule,
      userId,
    };

    return await this.connector.create<Omit<ExportSchedule, 'id'>>('export_schedules', scheduleData);
  }

  /**
   * Get all scheduled exports for a user
   */
  async getScheduledExports(userId: string): Promise<ExportSchedule[]> {
    if (!this.connector) {
      throw new Error('FirebaseConnector is required for retrieving scheduled exports');
    }

    return await this.connector.query<ExportSchedule>('export_schedules', {
      where: [{ field: 'userId', operator: '==', value: userId }],
      orderBy: { field: 'nextRunDate', direction: 'asc' },
    });
  }

  /**
   * Cancel a scheduled export
   */
  async cancelScheduledExport(scheduleId: string): Promise<void> {
    if (!this.connector) {
      throw new Error('FirebaseConnector is required for canceling scheduled exports');
    }

    await this.connector.delete('export_schedules', scheduleId);
  }

  /**
   * Save export metadata to Firestore
   */
  async saveExportMetadata(metadata: Omit<ExportMetadata, 'exportId'>): Promise<string> {
    if (!this.connector) {
      throw new Error('FirebaseConnector is required for saving export metadata');
    }

    return await this.connector.create<Omit<ExportMetadata, 'exportId'>>('export_metadata', metadata);
  }

  /**
   * Transform a data row using column definitions
   */
  private transformRow(row: any, columns: ColumnDefinition[]): Record<string, any> {
    const transformed: Record<string, any> = {};

    for (const col of columns) {
      const value = row[col.key];
      transformed[col.label] = col.format ? col.format(value) : value;
    }

    return transformed;
  }

  /**
   * Escape CSV value to handle special characters
   */
  private escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Generate filename with metadata
   */
  generateFileName(baseName: string, format: 'excel' | 'csv' | 'pdf', filters?: Record<string, any>): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const filterStr = filters ? `_${Object.keys(filters).join('_')}` : '';
    const extension = format === 'excel' ? 'xlsx' : format;

    return `${baseName}${filterStr}_${timestamp}.${extension}`;
  }
}
