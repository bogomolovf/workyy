/**
 * Spreadsheet Parser Utility
 * Supports CSV and Excel (.xlsx, .xls) file parsing with configurable encoding.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { SqlResult } from '../state/executionStore';

/** Encodings supported via TextDecoder (Encoding API). Use these for CSV when FileReader UTF-8 fails. */
export const SUPPORTED_CSV_ENCODINGS = [
  { value: 'UTF-8', label: 'UTF-8' },
  { value: 'windows-1251', label: 'Windows-1251 (Cyrillic)' },
  { value: 'windows-1252', label: 'Windows-1252 (Western European)' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1 (Latin-1)' },
  { value: 'ISO-8859-5', label: 'ISO-8859-5 (Cyrillic)' },
] as const;

const REPLACEMENT_CODEPOINT = 0xfffd; // U+FFFD

function countReplacementChars(text: string): number {
  let n = 0;
  for (const c of text) {
    if (c.codePointAt(0) === REPLACEMENT_CODEPOINT) n++;
  }
  return n;
}

/**
 * Decode file bytes with the given encoding using TextDecoder (Encoding API).
 * Supports UTF-8, windows-1251, windows-1252, ISO-8859-*, etc. per WhatWG Encoding Standard.
 */
async function decodeFileWithEncoding(file: File, encoding: string): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const decoder = new TextDecoder(encoding, { fatal: false });
  return decoder.decode(buffer);
}

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
 * Parse CSV file using PapaParse with optional encoding.
 * Uses ArrayBuffer + TextDecoder when encoding is specified so Windows-1251 and other encodings work.
 */
async function parseCSV(file: File, encoding?: string): Promise<SpreadsheetParseResult> {
  const effectiveEncoding = encoding ?? 'UTF-8';

  let csvString: string;
  try {
    csvString = await decodeFileWithEncoding(file, effectiveEncoding);
  } catch (err) {
    return {
      success: false,
      error: `Unsupported or invalid encoding "${effectiveEncoding}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return new Promise((resolve) => {
    Papa.parse(csvString, {
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
      error: (error: unknown) => {
        resolve({
          success: false,
          error: `Failed to read CSV file: ${error instanceof Error ? error.message : String(error)}`,
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

/** Threshold: if replacement-char count in header/first row exceeds this, try other encodings. */
const REPLACEMENT_THRESHOLD = 3;

/**
 * Count replacement characters in parsed CSV result (columns + first row).
 */
function countReplacementsInResult(data: SqlResult): number {
  const headerText = data.columns.join('');
  const firstRowText = (data.rows[0] ?? [])
    .map((v) => (v != null ? String(v) : ''))
    .join('');
  return countReplacementChars(headerText) + countReplacementChars(firstRowText);
}

/**
 * Parse a spreadsheet file (CSV or Excel).
 * Automatically detects file type based on extension.
 * For CSV: if encoding is not specified, tries UTF-8 first, then windows-1251 (and others) if many replacement chars.
 */
export type ParseSpreadsheetOptions = {
  /** Explicit encoding for CSV (e.g. 'UTF-8', 'windows-1251'). If not set, auto-detect is used. */
  encoding?: string;
};

export async function parseSpreadsheetFile(
  file: File,
  options?: ParseSpreadsheetOptions,
): Promise<SpreadsheetParseResult> {
  const fileType = getFileType(file.name);

  switch (fileType) {
    case 'csv': {
      if (options?.encoding) {
        return parseCSV(file, options.encoding);
      }
      // Auto-detect: try UTF-8, then windows-1251 if many replacement chars
      const utf8Result = await parseCSV(file, 'UTF-8');
      if (!utf8Result.success) return utf8Result;
      const utf8Replacements = countReplacementsInResult(utf8Result.data);
      if (utf8Replacements <= REPLACEMENT_THRESHOLD) {
        return utf8Result;
      }
      const fallbackEncodings = ['windows-1251', 'windows-1252', 'ISO-8859-1', 'ISO-8859-5'];
      let best = utf8Result;
      let bestCount = utf8Replacements;
      for (const enc of fallbackEncodings) {
        const result = await parseCSV(file, enc);
        if (!result.success) continue;
        const count = countReplacementsInResult(result.data);
        if (count < bestCount) {
          best = result;
          bestCount = count;
        }
      }
      return best;
    }
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
