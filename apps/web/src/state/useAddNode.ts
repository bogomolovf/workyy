// file: apps/web/src/state/useAddNode.ts
type Position = { x: number; y: number };

type NodeKind =
  | 'sql'
  | 'python'
  | 'note'
  | 'text'
  | 'shape'
  | 'image'
  | 'video'
  | 'document'
  | 'database'
  | 'plot'
  | 'voice';

type NewNode = {
  id: string;
  type: NodeKind;
  position: Position;
  payload: Record<string, unknown>;
};

const HORIZONTAL_STEP = 420;
const START_POSITION: Position = { x: 160, y: 200 };
let fallbackIdCounter = 0;

/**
 * Корректирует позицию так, чтобы центр узла был в указанной точке
 * @param position - позиция клика (где должен быть центр узла)
 * @param width - ширина узла
 * @param height - высота узла
 * @returns скорректированная позиция для левого верхнего угла
 */
function centerPosition(position: Position, width: number, height: number): Position {
  return {
    x: position.x - width / 2,
    y: position.y - height / 2,
  };
}

function createUuidFallback() {
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10, 16).join('')}`;
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `${createUuidFallback()}-${fallbackIdCounter.toString(16)}`;
}

export function useAddNode() {
  function getNextPosition(nodes: Array<{ position: Position }>): Position {
    if (nodes.length === 0) return START_POSITION;
    const last = nodes[nodes.length - 1].position;
    return { x: last.x + HORIZONTAL_STEP, y: START_POSITION.y };
  }

  function createSqlNode(position: Position): NewNode {
    // SQL узлы: width = 620, height ≈ 250 (примерная высота для нового узла)
    const nodeWidth = 620;
    const nodeHeight = 250;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'sql',
      position: centeredPosition,
      payload: { sql: 'SELECT 1;' },
    };
  }

  function createPythonNode(position: Position): NewNode {
    // Python узлы: width = 620, height ≈ 250 (примерная высота для нового узла)
    const nodeWidth = 620;
    const nodeHeight = 250;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'python',
      position: centeredPosition,
      payload: {
        python: [
          'import pandas as pd',
          'import plotly.express as px',
          '',
          'if df is None:',
          "    print('⚠️ Run the upstream SQL node first.')",
          '    result = None',
          'else:',
          "    summary = df.groupby('region', as_index=False)['revenue'].sum()",
          '    result = summary',
          "    plot = px.bar(summary, x='region', y='revenue', title='Revenue by region')",
        ].join('\n'),
      },
    };
  }

  function createNoteNode(position: Position): NewNode {
    // Note узлы: width = 280, height = 280
    const nodeWidth = 280;
    const nodeHeight = 280;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'note',
      position: centeredPosition,
      payload: {
        noteContent: '',
        noteColor: '#FFFFBA',
        text: '',
        color: '#FFFFBA', // пастельный бледно желтый
        fontSize: 48,
        fontFamily: 'Inter, sans-serif',
        isBold: false,
        isItalic: false,
        ui: {
          width: 280,
          height: 280,
        },
      },
    };
  }

  function createTextNode(position: Position): NewNode {
    // Text узлы: width = 240, height = 80
    const nodeWidth = 240;
    const nodeHeight = 80;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'text',
      position: centeredPosition,
      payload: {
        text: '',
        textContent: '',
        fontSize: 18,
        fontFamily: 'Noto Sans, sans-serif', // Как в референсе Miro
        color: '#CF4C2C', // orange-red (первый цвет в палитре, как у стикеров)
        backgroundColor: 'transparent',
        textAlign: 'left' as const,
        ui: {
          width: 240,
          height: 80,
        },
      },
    };
  }

  function createShapeNode(
    position: Position,
    width?: number,
    height?: number,
    payload?: {
      shapeType?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      cornerRadius?: number;
      arrowHead?: boolean;
      endX?: number;
      endY?: number;
    },
  ): NewNode {
    // Shape узлы: width = 160, height = 96 (дефолтные размеры) или переданные значения
    const nodeWidth = width ?? 160;
    const nodeHeight = height ?? 96;
    const centeredPosition =
      width && height ? position : centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'shape',
      position: centeredPosition,
      payload: {
        shapeType: payload?.shapeType ?? 'rectangle',
        shapeColor: '#BFDBFE', // Legacy
        shapeLabel: 'Фигура',
        // New style properties (Miro-like defaults)
        fill: payload?.fill ?? 'transparent',
        stroke: payload?.stroke ?? '#1f1f1f',
        strokeWidth: payload?.strokeWidth ?? 2,
        opacity: payload?.opacity ?? 1.0,
        cornerRadius: payload?.cornerRadius ?? 0,
        arrowHead: payload?.arrowHead,
        // For line/arrow types
        endX: payload?.endX,
        endY: payload?.endY,
      },
    };
  }

  function createImageNode(
    position: Position,
    payload?: {
      url?: string;
      originalName?: string;
      fileId?: string;
      caption?: string;
    },
  ): NewNode {
    // Image узлы: используем примерные размеры 300x300
    const nodeWidth = 300;
    const nodeHeight = 300;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'image',
      position: centeredPosition,
      payload: {
        url: payload?.url ?? '',
        originalName: payload?.originalName ?? '',
        fileId: payload?.fileId ?? '',
        caption: payload?.caption ?? '',
        width: nodeWidth,
        height: nodeHeight,
      },
    };
  }

  function createVideoNode(
    position: Position,
    payload?: {
      url?: string;
      originalName?: string;
      fileId?: string;
    },
  ): NewNode {
    // Video узлы: используем размеры 400x300
    const nodeWidth = 400;
    const nodeHeight = 300;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'video',
      position: centeredPosition,
      payload: {
        url: payload?.url ?? '',
        originalName: payload?.originalName ?? '',
        fileId: payload?.fileId ?? '',
        width: nodeWidth,
        height: nodeHeight,
      },
    };
  }

  function createDocumentNode(
    position: Position,
    payload?: {
      url?: string;
      originalName?: string;
      fileId?: string;
      mimeType?: string;
    },
  ): NewNode {
    // Document узлы: используем размеры 400x500
    const nodeWidth = 400;
    const nodeHeight = 500;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'document',
      position: centeredPosition,
      payload: {
        url: payload?.url ?? '',
        originalName: payload?.originalName ?? '',
        fileId: payload?.fileId ?? '',
        mimeType: payload?.mimeType ?? '',
        width: nodeWidth,
        height: nodeHeight,
      },
    };
  }

  function createDatabaseNode(position: Position): NewNode {
    // Database узлы: width = 280, height ≈ 100 (примерная высота)
    const nodeWidth = 280;
    const nodeHeight = 100;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'database',
      position: centeredPosition,
      payload: {
        connectionName: 'New Database',
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
        ssl: false,
        status: 'idle',
      },
    };
  }

  function createPlotNode(position: Position): NewNode {
    // Plot узлы: width = 500, height ≈ 400 (примерная высота)
    const nodeWidth = 500;
    const nodeHeight = 400;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'plot',
      position: centeredPosition,
      payload: {
        chartType: 'bar',
        mapping: {},
        styling: {
          title: 'New Chart',
          theme: 'light',
          showLegend: true,
          legendPosition: 'top',
          showGrid: true,
          enableZoomPan: false,
          enableTooltips: true,
        },
        version: '1',
        autoConfigured: false,
      },
    };
  }

  function createVoiceNode(position: Position): NewNode {
    // Voice узлы: width = 280, height = 60 (компактный Telegram-style)
    const nodeWidth = 280;
    const nodeHeight = 60;
    const centeredPosition = centerPosition(position, nodeWidth, nodeHeight);
    return {
      id: createId(),
      type: 'voice',
      position: centeredPosition,
      payload: {
        audioData: null,
        duration: 0,
        mimeType: 'audio/webm',
        ui: {
          width: 280,
          height: 60,
        },
      },
    };
  }

  return {
    getNextPosition,
    createSqlNode,
    createPythonNode,
    createNoteNode,
    createTextNode,
    createShapeNode,
    createImageNode,
    createVideoNode,
    createDocumentNode,
    createDatabaseNode,
    createPlotNode,
    createVoiceNode,
  };
}
