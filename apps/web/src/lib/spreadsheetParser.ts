/**
 * Spreadsheet Parser Utility
 * Supports CSV and Excel (.xlsx, .xls) file parsing
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { SqlResult } from '../state/executionStore';

export type SpreadsheetParseResult =
  | {
      success: true;
      data: SqlResult;
      filename: string;
      rowCount: number;
      columnCount: number;
      fileType: 'csv' | 'excel';
    }
  | {
      success: false;
      error: string;
    };

/**
 * Normalize a cell value to SqlResult compatible type
 */
function normalizeValue(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Parse CSV file using PapaParse
 */
async function parseCSV(file: File): Promise<SpreadsheetParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            const firstError = results.errors[0];
            resolve({
              success: false,
              error: `CSV parsing error at row ${firstError.row || 'unknown'}: ${firstError.message}`,
            });
            return;
          }

          if (!results.data || results.data.length === 0) {
            resolve({
              success: false,
              error: 'CSV file is empty or contains no data rows',
            });
            return;
          }

          // Get columns from first row keys
          const firstRow = results.data[0] as Record<string, unknown>;
          const columns = Object.keys(firstRow);

          if (columns.length === 0) {
            resolve({
              success: false,
              error: 'No columns found in CSV file',
            });
            return;
          }

          // Convert rows to SqlResult format
          const rows: Array<Array<string | number | null>> = results.data.map(
            (row: unknown) => {
              const typedRow = row as Record<string, unknown>;
              return columns.map((col) => normalizeValue(typedRow[col]));
            },
          );

          const sqlResult: SqlResult = {
            columns,
            rows,
          };

          resolve({
            success: true,
            data: sqlResult,
            filename: file.name,
            rowCount: rows.length,
            columnCount: columns.length,
            fileType: 'csv',
          });
        } catch (err) {
          resolve({
            success: false,
            error:
              err instanceof Error ? err.message : 'Unknown error parsing CSV',
          });
        }
      },
      error: (error) => {
        resolve({
          success: false,
          error: `Failed to read CSV file: ${error.message}`,
        });
      },
    });
  });
}

/**
 * Parse Excel file (.xlsx, .xls) using SheetJS
 */
async function parseExcel(file: File): Promise<SpreadsheetParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({
            success: false,
            error: 'Failed to read Excel file',
          });
          return;
        }

        // Parse workbook
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve({
            success: false,
            error: 'Excel file contains no sheets',
          });
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          {
            defval: null, // Default value for empty cells
          },
        );

        if (jsonData.length === 0) {
          resolve({
            success: false,
            error: 'Excel sheet is empty or contains no data rows',
          });
          return;
        }

        // Get columns from first row
        const columns = Object.keys(jsonData[0]);

        if (columns.length === 0) {
          resolve({
            success: false,
            error: 'No columns found in Excel sheet',
          });
          return;
        }

        // Convert rows to SqlResult format
        const rows: Array<Array<string | number | null>> = jsonData.map(
          (row) => {
            return columns.map((col) => normalizeValue(row[col]));
          },
        );

        const sqlResult: SqlResult = {
          columns,
          rows,
        };

        resolve({
          success: true,
          data: sqlResult,
          filename: file.name,
          rowCount: rows.length,
          columnCount: columns.length,
          fileType: 'excel',
        });
      } catch (err) {
        resolve({
          success: false,
          error:
            err instanceof Error ? err.message : 'Unknown error parsing Excel',
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        error: 'Failed to read Excel file',
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Detect file type based on extension
 */
function getFileType(
  filename: string,
): 'csv' | 'excel' | 'unsupported' {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'csv':
    case 'tsv':
    case 'txt':
      return 'csv';
    case 'xlsx':
    case 'xls':
    case 'xlsb':
    case 'xlsm':
      return 'excel';
    default:
      return 'unsupported';
  }
}

/**
 * Parse a spreadsheet file (CSV or Excel)
 * Automatically detects file type based on extension
 */
export async function parseSpreadsheetFile(
  file: File,
): Promise<SpreadsheetParseResult> {
  const fileType = getFileType(file.name);

  switch (fileType) {
    case 'csv':
      return parseCSV(file);
    case 'excel':
      return parseExcel(file);
    case 'unsupported':
      return {
        success: false,
        error: `Unsupported file type. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.`,
      };
  }
}

/**
 * Get accepted file extensions for file input
 */
export const SPREADSHEET_ACCEPT =
  '.csv,.tsv,.txt,.xlsx,.xls,.xlsb,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
