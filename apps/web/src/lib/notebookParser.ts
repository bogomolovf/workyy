export type NotebookCellType = 'code' | 'markdown' | 'raw';

export type NotebookCellOutput = {
  outputType: 'stream' | 'execute_result' | 'display_data' | 'error';
  text?: string;
  data?: Record<string, unknown>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
};

export type NotebookCell = {
  id: string;
  cellType: NotebookCellType;
  source: string;
  outputs: NotebookCellOutput[];
  executionCount: number | null;
  metadata: Record<string, unknown>;
};

export type ParsedNotebook = {
  name: string;
  cells: NotebookCell[];
  metadata: {
    kernelspec?: { name: string; display_name: string; language: string };
    language_info?: { name: string; version?: string };
    [key: string]: unknown;
  };
  nbformat: number;
  nbformatMinor: number;
};

let cellIdCounter = 0;

export function nextCellId(): string {
  cellIdCounter += 1;
  return `nb-cell-${cellIdCounter}-${Date.now().toString(36)}`;
}

function joinSource(source: string | string[]): string {
  if (Array.isArray(source)) return source.join('');
  return source;
}

function parseOutputs(rawOutputs: unknown[]): NotebookCellOutput[] {
  if (!Array.isArray(rawOutputs)) return [];
  return rawOutputs.map((raw: any) => {
    const outputType = raw.output_type ?? 'stream';
    const result: NotebookCellOutput = { outputType };
    if (raw.text) {
      result.text = joinSource(raw.text);
    }
    if (raw.data) {
      result.data = raw.data;
    }
    if (outputType === 'error') {
      result.ename = raw.ename;
      result.evalue = raw.evalue;
      result.traceback = raw.traceback;
    }
    return result;
  });
}

export function parseNotebook(content: string, fileName: string): ParsedNotebook {
  const raw = JSON.parse(content);

  const nbformat = raw.nbformat ?? 4;
  const nbformatMinor = raw.nbformat_minor ?? 0;
  const metadata = raw.metadata ?? {};

  const cells: NotebookCell[] = (raw.cells ?? []).map((cell: any) => ({
    id: cell.id ?? nextCellId(),
    cellType: cell.cell_type ?? 'code',
    source: joinSource(cell.source ?? ''),
    outputs: parseOutputs(cell.outputs ?? []),
    executionCount: cell.execution_count ?? null,
    metadata: cell.metadata ?? {},
  }));

  const name = fileName.replace(/\.ipynb$/i, '');
  return { name, cells, metadata, nbformat, nbformatMinor };
}

export function createEmptyCell(cellType: NotebookCellType = 'code'): NotebookCell {
  return {
    id: nextCellId(),
    cellType,
    source: '',
    outputs: [],
    executionCount: null,
    metadata: {},
  };
}

export function getCodeCells(notebook: ParsedNotebook): NotebookCell[] {
  return notebook.cells.filter((c) => c.cellType === 'code');
}

export function getLanguage(notebook: ParsedNotebook): string {
  return (
    notebook.metadata.kernelspec?.language ?? notebook.metadata.language_info?.name ?? 'python'
  );
}

export function extractPlainText(output: NotebookCellOutput): string {
  if (output.text) return output.text;
  if (output.data) {
    const plain = output.data['text/plain'];
    if (typeof plain === 'string') return plain;
    if (Array.isArray(plain)) return plain.join('');
  }
  if (output.outputType === 'error') {
    return [output.ename, output.evalue].filter(Boolean).join(': ');
  }
  return '';
}
