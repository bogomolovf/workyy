// file: apps/web/src/state/useAddNode.ts
type Position = { x: number; y: number };

type NodeKind = 'sql' | 'python' | 'note' | 'text' | 'shape' | 'image' | 'database' | 'plot';

type NewNode = {
  id: string;
  type: NodeKind;
  position: Position;
  payload: Record<string, unknown>;
};

const HORIZONTAL_STEP = 420;
const START_POSITION: Position = { x: 160, y: 200 };
let fallbackIdCounter = 0;

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
    return {
      id: createId(),
      type: 'sql',
      position,
      payload: { sql: 'SELECT 1;' },
    };
  }

  function createPythonNode(position: Position): NewNode {
    return {
      id: createId(),
      type: 'python',
      position,
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
    return {
      id: createId(),
      type: 'note',
      position,
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
    return {
      id: createId(),
      type: 'text',
      position,
      payload: {
        text: '',
        textContent: '',
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        color: '#CF4C2C', // orange-red (первый цвет в палитре, как у стикеров)
        textAlign: 'left' as const,
        ui: {
          width: 240,
          height: 80,
        },
      },
    };
  }

  function createShapeNode(position: Position): NewNode {
    return {
      id: createId(),
      type: 'shape',
      position,
      payload: {
        shapeType: 'rectangle',
        shapeColor: '#BFDBFE',
        shapeLabel: 'Фигура',
      },
    };
  }

  function createImageNode(position: Position): NewNode {
    return {
      id: createId(),
      type: 'image',
      position,
      payload: {
        imageUrl: '',
        imageCaption: 'Добавьте изображение',
      },
    };
  }

  function createDatabaseNode(position: Position): NewNode {
    return {
      id: createId(),
      type: 'database',
      position,
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
    return {
      id: createId(),
      type: 'plot',
      position,
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

  return {
    getNextPosition,
    createSqlNode,
    createPythonNode,
    createNoteNode,
    createTextNode,
    createShapeNode,
    createImageNode,
    createDatabaseNode,
    createPlotNode,
  };
}
