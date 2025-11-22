// file: apps/web/src/components/InteractiveResultTable.tsx
"use client";

import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { SqlResult } from "../state/executionStore";

function isNumericValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inferColumnType(values: Array<string | number | null>) {
  const sample = values.find((item) => item !== null && item !== undefined);
  if (typeof sample === "number") return "number";
  if (typeof sample === "string") {
    const numericCandidate = Number(sample);
    if (!Number.isNaN(numericCandidate) && sample.trim() !== "") {
      return "stringNumeric";
    }
  }
  return "string";
}

type TableRow = Record<string, string | number | null> & { __rowId: number };

type InteractiveResultTableProps = {
  result: SqlResult;
  compact?: boolean;
};

export function InteractiveResultTable({ result, compact }: InteractiveResultTableProps) {
  const rows = useMemo<TableRow[]>(() => {
    return result.rows.map((row, rowIndex) => {
      const record: TableRow = { __rowId: rowIndex } as TableRow;
      result.columns.forEach((column, columnIndex) => {
        record[column] = row[columnIndex];
      });
      return record;
    });
  }, [result]);

  const columnMeta = useMemo(() => {
    return result.columns.map((column) => {
      const values = rows.map((row) => row[column]);
      const type = inferColumnType(values);
      const numericValues =
        type === "number"
          ? (values.filter((value) => isNumericValue(value)) as number[])
          : [];
      const min = numericValues.length > 0 ? Math.min(...numericValues) : undefined;
      const max = numericValues.length > 0 ? Math.max(...numericValues) : undefined;
      const mean =
        numericValues.length > 0
          ? numericValues.reduce((acc, value) => acc + value, 0) / numericValues.length
          : undefined;
      return { column, type, numericValues, min, max, mean };
    });
  }, [result.columns, rows]);

  const [sorting, setSorting] = useState<SortingState>([]);

  const columnDefs = useMemo<ColumnDef<TableRow>[]>(() => {
    return columnMeta.map(({ column, type }) => {
      const isNumeric = type === "number";
      return {
        accessorKey: column,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <span>{column.id}</span>
              <span className="text-[10px] font-medium text-slate-400">
                {isSorted === "asc" && "▲"}
                {isSorted === "desc" && "▼"}
                {!isSorted && ""}
              </span>
            </button>
          );
        },
        cell: ({ getValue }) => {
          const value = getValue();
          if (value === null || value === undefined) {
            return <span className="text-slate-400">NULL</span>;
          }
          if (isNumericValue(value)) {
            return <span>{value.toLocaleString()}</span>;
          }
          return <span>{String(value)}</span>;
        },
        sortingFn: isNumeric ? "basic" : "alphanumeric",
        meta: {
          isNumeric,
        },
      } satisfies ColumnDef<TableRow>;
    });
  }, [columnMeta]);

  const table = useReactTable<TableRow>({
    data: rows,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasBaseRows = rows.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className={`overflow-auto rounded-lg border border-slate-200 bg-white ${compact ? "max-h-56" : "max-h-80"}`}>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className="px-3 py-2 align-top text-left">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={result.columns.length} className="px-3 py-6 text-center text-sm text-slate-500">
                  {hasBaseRows ? "No rows available." : "No rows returned."}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="odd:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 text-sm text-slate-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
