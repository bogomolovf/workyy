import { useEffect, useState } from 'react';

interface CanvasNode {
  id: string;
  type: 'sql' | 'python' | 'plot';
  x: number; // в пикселях от левого края viewport
  y: number; // в пикселях от верхнего края viewport
  width: number;
  height: number;
  code?: string;
  opacity: number;
  zIndex: number;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  x1: number; // в пикселях от левого края viewport
  y1: number; // в пикселях от верхнего края viewport
  x2: number; // в пикселях от левого края viewport
  y2: number; // в пикселях от верхнего края viewport
}

export const CanvasDecorations = () => {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);

  useEffect(() => {
    // Вычисляем позиции в пикселях относительно документа для равномерного распределения
    // Используем высоту документа для вертикального распределения
    const getViewportPositions = () => {
      // Используем большую из высот: документа или viewport (на случай, если документ еще не загружен)
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight
      );
      const vw = window.innerWidth;
      
      // Равномерно распределяем узлы по всей высоте документа
      // Узлы размещаем только в крайних зонах (0-15% слева, 85-100% справа), чтобы не перекрывать центральный контент
      // Уменьшенные размеры: горизонтальные прямоугольники (width > height)
      const leftZoneMax = vw * 0.15; // Максимум 15% от ширины слева
      const rightZoneMin = vw * 0.85; // Минимум 85% от ширины справа
      const maxWidth = 280; // Максимальная ширина узла
      const maxHeight = 100; // Максимальная высота узла
      
      const nodes = [
        // SQL узлы - горизонтальные прямоугольники (слева, уменьшенные)
        {
          id: 'sql1',
          type: 'sql' as const,
          x: Math.max(15, vw * 0.02),
          y: docHeight * 0.12,
          width: Math.min(maxWidth, leftZoneMax - 20),
          height: 80,
          code: 'SELECT u.id, u.name, u.email FROM users u WHERE u.age > 25 AND u.status = \'active\'',
          opacity: 0.7,
          zIndex: 1,
        },
        {
          id: 'sql2',
          type: 'sql' as const,
          x: Math.max(rightZoneMin, vw * 0.86),
          y: docHeight * 0.18,
          width: Math.min(maxWidth, vw - rightZoneMin - 20),
          height: 85,
          code: 'SELECT product_id, SUM(quantity) as total_qty, AVG(price) as avg_price FROM orders WHERE order_date >= CURRENT_DATE - 30 GROUP BY product_id',
          opacity: 0.7,
          zIndex: 1,
        },
        // Python узлы - горизонтальные прямоугольники (уменьшенные)
        {
          id: 'python1',
          type: 'python' as const,
          x: Math.max(15, vw * 0.02),
          y: docHeight * 0.75,
          width: Math.min(maxWidth, leftZoneMax - 20),
          height: 85,
          code: 'import pandas as pd\nimport numpy as np\ndf = pd.read_csv("sales.csv")\ndf_filtered = df[df["revenue"] > 1000]\ndf_agg = df_filtered.groupby("region").sum()',
          opacity: 0.7,
          zIndex: 1,
        },
        {
          id: 'python2',
          type: 'python' as const,
          x: Math.max(rightZoneMin, vw * 0.86),
          y: docHeight * 0.68,
          width: Math.min(maxWidth, vw - rightZoneMin - 20),
          height: 80,
          code: 'import matplotlib.pyplot as plt\nplt.figure(figsize=(10, 6))\nplt.plot(dates, values)\nplt.title("Revenue Trend")\nplt.show()',
          opacity: 0.7,
          zIndex: 1,
        },
        // Plot узлы - дашборды (горизонтальные, уменьшенные)
        {
          id: 'plot1',
          type: 'plot' as const,
          x: Math.max(rightZoneMin, vw * 0.86),
          y: docHeight * 0.45,
          width: Math.min(maxWidth, vw - rightZoneMin - 20),
          height: 140,
          opacity: 0.7,
          zIndex: 1,
        },
        // Дополнительные узлы
        {
          id: 'sql3',
          type: 'sql' as const,
          x: Math.max(15, vw * 0.02),
          y: docHeight * 0.5,
          width: Math.min(maxWidth, leftZoneMax - 20),
          height: 85,
          code: 'SELECT DATE_TRUNC(\'month\', date) as month, COUNT(*) as transactions, SUM(amount) as total FROM transactions WHERE date > NOW() - INTERVAL \'1 year\' GROUP BY month ORDER BY month',
          opacity: 0.7,
          zIndex: 1,
        },
        {
          id: 'python3',
          type: 'python' as const,
          x: Math.max(rightZoneMin, vw * 0.86),
          y: docHeight * 0.78,
          width: Math.min(maxWidth - 20, vw - rightZoneMin - 20),
          height: 75,
          code: 'result = df.groupby("category").agg({"price": "mean", "quantity": "sum"}).reset_index()',
          opacity: 0.7,
          zIndex: 1,
        },
        // Еще один Plot узел
        {
          id: 'plot2',
          type: 'plot' as const,
          x: Math.max(15, vw * 0.02),
          y: docHeight * 0.35,
          width: Math.min(maxWidth, leftZoneMax - 20),
          height: 130,
          opacity: 0.7,
          zIndex: 1,
        },
        {
          id: 'plot3',
          type: 'plot' as const,
          x: Math.max(rightZoneMin, vw * 0.86),
          y: docHeight * 0.55,
          width: Math.min(maxWidth, vw - rightZoneMin - 20),
          height: 135,
          opacity: 0.7,
          zIndex: 1,
        },
      ];
      return nodes;
      return nodes;
    };
    
    const initialNodes = getViewportPositions();

    // Создаем связи между узлами (координаты в пикселях)
    const getNodeCenterX = (node: CanvasNode) => node.x + node.width / 2;
    const getNodeCenterY = (node: CanvasNode) => node.y + node.height / 2;

    const initialEdges: CanvasEdge[] = [
      {
        id: 'edge1',
        from: 'sql1',
        to: 'python1',
        x1: getNodeCenterX(initialNodes[0]),
        y1: getNodeCenterY(initialNodes[0]),
        x2: getNodeCenterX(initialNodes[2]),
        y2: getNodeCenterY(initialNodes[2]),
      },
      {
        id: 'edge2',
        from: 'python1',
        to: 'plot1',
        x1: getNodeCenterX(initialNodes[2]),
        y1: getNodeCenterY(initialNodes[2]),
        x2: getNodeCenterX(initialNodes[4]),
        y2: getNodeCenterY(initialNodes[4]),
      },
      {
        id: 'edge3',
        from: 'sql2',
        to: 'python2',
        x1: getNodeCenterX(initialNodes[1]),
        y1: getNodeCenterY(initialNodes[1]),
        x2: getNodeCenterX(initialNodes[3]),
        y2: getNodeCenterY(initialNodes[3]),
      },
      {
        id: 'edge4',
        from: 'python2',
        to: 'plot1',
        x1: getNodeCenterX(initialNodes[3]),
        y1: getNodeCenterY(initialNodes[3]),
        x2: getNodeCenterX(initialNodes[4]),
        y2: getNodeCenterY(initialNodes[4]),
      },
      {
        id: 'edge5',
        from: 'sql3',
        to: 'plot2',
        x1: getNodeCenterX(initialNodes[5]),
        y1: getNodeCenterY(initialNodes[5]),
        x2: getNodeCenterX(initialNodes[7]),
        y2: getNodeCenterY(initialNodes[7]),
      },
      {
        id: 'edge6',
        from: 'python3',
        to: 'plot3',
        x1: getNodeCenterX(initialNodes[6]),
        y1: getNodeCenterY(initialNodes[6]),
        x2: getNodeCenterX(initialNodes[8]),
        y2: getNodeCenterY(initialNodes[8]),
      },
    ];

    setNodes(initialNodes);
    setEdges(initialEdges);
    
    // Обработчик изменения размера окна для пересчета позиций
    const handleResize = () => {
      // Небольшая задержка, чтобы document.documentElement.scrollHeight успел обновиться
      setTimeout(() => {
        const newNodes = getViewportPositions();
        const newEdges: CanvasEdge[] = [
          {
            id: 'edge1',
            from: 'sql1',
            to: 'python1',
            x1: getNodeCenterX(newNodes[0]),
            y1: getNodeCenterY(newNodes[0]),
            x2: getNodeCenterX(newNodes[2]),
            y2: getNodeCenterY(newNodes[2]),
          },
          {
            id: 'edge2',
            from: 'python1',
            to: 'plot1',
            x1: getNodeCenterX(newNodes[2]),
            y1: getNodeCenterY(newNodes[2]),
            x2: getNodeCenterX(newNodes[4]),
            y2: getNodeCenterY(newNodes[4]),
          },
          {
            id: 'edge3',
            from: 'sql2',
            to: 'python2',
            x1: getNodeCenterX(newNodes[1]),
            y1: getNodeCenterY(newNodes[1]),
            x2: getNodeCenterX(newNodes[3]),
            y2: getNodeCenterY(newNodes[3]),
          },
          {
            id: 'edge4',
            from: 'python2',
            to: 'plot1',
            x1: getNodeCenterX(newNodes[3]),
            y1: getNodeCenterY(newNodes[3]),
            x2: getNodeCenterX(newNodes[4]),
            y2: getNodeCenterY(newNodes[4]),
          },
          {
            id: 'edge5',
            from: 'sql3',
            to: 'plot2',
            x1: getNodeCenterX(newNodes[5]),
            y1: getNodeCenterY(newNodes[5]),
            x2: getNodeCenterX(newNodes[7]),
            y2: getNodeCenterY(newNodes[7]),
          },
          {
            id: 'edge6',
            from: 'python3',
            to: 'plot3',
            x1: getNodeCenterX(newNodes[6]),
            y1: getNodeCenterY(newNodes[6]),
            x2: getNodeCenterX(newNodes[8]),
            y2: getNodeCenterY(newNodes[8]),
          },
        ];
        setNodes(newNodes);
        setEdges(newEdges);
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    // Также пересчитываем при изменении высоты документа (например, при загрузке контента)
    const resizeObserver = new ResizeObserver(() => {
      const newNodes = getViewportPositions();
      const newEdges: CanvasEdge[] = [
        {
          id: 'edge1',
          from: 'sql1',
          to: 'python1',
          x1: getNodeCenterX(newNodes[0]),
          y1: getNodeCenterY(newNodes[0]),
          x2: getNodeCenterX(newNodes[2]),
          y2: getNodeCenterY(newNodes[2]),
        },
        {
          id: 'edge2',
          from: 'python1',
          to: 'plot1',
          x1: getNodeCenterX(newNodes[2]),
          y1: getNodeCenterY(newNodes[2]),
          x2: getNodeCenterX(newNodes[4]),
          y2: getNodeCenterY(newNodes[4]),
        },
        {
          id: 'edge3',
          from: 'sql2',
          to: 'python2',
          x1: getNodeCenterX(newNodes[1]),
          y1: getNodeCenterY(newNodes[1]),
          x2: getNodeCenterX(newNodes[3]),
          y2: getNodeCenterY(newNodes[3]),
        },
        {
          id: 'edge4',
          from: 'python2',
          to: 'plot1',
          x1: getNodeCenterX(newNodes[3]),
          y1: getNodeCenterY(newNodes[3]),
          x2: getNodeCenterX(newNodes[4]),
          y2: getNodeCenterY(newNodes[4]),
        },
        {
          id: 'edge5',
          from: 'sql3',
          to: 'plot2',
          x1: getNodeCenterX(newNodes[5]),
          y1: getNodeCenterY(newNodes[5]),
          x2: getNodeCenterX(newNodes[7]),
          y2: getNodeCenterY(newNodes[7]),
        },
        {
          id: 'edge6',
          from: 'python3',
          to: 'plot3',
          x1: getNodeCenterX(newNodes[6]),
          y1: getNodeCenterY(newNodes[6]),
          x2: getNodeCenterX(newNodes[8]),
          y2: getNodeCenterY(newNodes[8]),
        },
      ];
      setNodes(newNodes);
      setEdges(newEdges);
    });
    
    resizeObserver.observe(document.documentElement);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'sql':
        return '#3b82f6';
      case 'python':
        return '#22c55e';
      case 'plot':
        return '#a855f7';
      default:
        return '#f97316';
    }
  };

  const getNodeBorderColor = (type: string) => {
    switch (type) {
      case 'sql':
        return 'rgba(59, 130, 246, 0.3)';
      case 'python':
        return 'rgba(34, 197, 94, 0.3)';
      case 'plot':
        return 'rgba(168, 85, 247, 0.3)';
      default:
        return 'rgba(249, 115, 22, 0.3)';
    }
  };

  // Функция для экранирования HTML
  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Функция для подсветки синтаксиса SQL
  const highlightSQL = (code: string) => {
    // Сначала экранируем HTML
    let highlighted = escapeHtml(code);
    
    // Используем временные маркеры для защиты уже подсвеченных частей
    const markers: string[] = [];
    let markerIndex = 0;
    
    // Функция для создания маркера
    const createMarker = (content: string) => {
      const marker = `__MARKER_${markerIndex++}__`;
      markers.push(content);
      return marker;
    };
    
    // Сначала защищаем строки временными маркерами
    highlighted = highlighted.replace(/'([^']*)'/g, (match) => {
      return createMarker(`<span style="color: #059669;">${escapeHtml(match)}</span>`);
    });
    
    // Затем защищаем числа
    highlighted = highlighted.replace(/\b(\d+)\b/g, (match) => {
      return createMarker(`<span style="color: #dc2626;">${match}</span>`);
    });
    
    // Затем защищаем операторы
    highlighted = highlighted.replace(/(>=|<=|<>|!=|>|<|=)/g, (match) => {
      return createMarker(`<span style="color: #7c3aed;">${match}</span>`);
    });
    
    // Теперь подсвечиваем ключевые слова (они не будут конфликтовать с уже защищенными частями)
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP',
      'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'ON', 'AS', 'GROUP', 'BY', 'ORDER', 'HAVING',
      'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DISTINCT', 'UNION', 'ALL', 'INTERSECT', 'EXCEPT',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'EXISTS', 'DATE_TRUNC', 'NOW', 'INTERVAL'
    ];
    
    const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
    sortedKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      highlighted = highlighted.replace(regex, (match) => {
        return `<span style="color: #2563eb; font-weight: 600;">${match}</span>`;
      });
    });
    
    // Восстанавливаем маркеры обратно в HTML
    markers.forEach((content, index) => {
      highlighted = highlighted.replace(`__MARKER_${index}__`, content);
    });
    
    return highlighted;
  };

  // Функция для подсветки синтаксиса Python
  const highlightPython = (code: string) => {
    // Сначала экранируем HTML
    let highlighted = escapeHtml(code);
    
    // Используем временные маркеры для защиты уже подсвеченных частей
    const markers: string[] = [];
    let markerIndex = 0;
    
    // Функция для создания маркера
    const createMarker = (content: string) => {
      const marker = `__MARKER_${markerIndex}__`;
      markers[markerIndex] = content;
      markerIndex++;
      return marker;
    };
    
    // Сначала защищаем строки временными маркерами (важно - до других замен)
    highlighted = highlighted.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
      return createMarker(`<span style="color: #059669;">${match}</span>`);
    });
    
    // Затем защищаем числа
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, (match) => {
      // Проверяем, что это не часть уже защищенной строки
      if (!match.includes('__MARKER_')) {
        return createMarker(`<span style="color: #dc2626;">${match}</span>`);
      }
      return match;
    });
    
    // Теперь подсвечиваем ключевые слова (они не будут конфликтовать с маркерами)
    const keywords = [
      'import', 'from', 'as', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while',
      'in', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'try', 'except', 'finally',
      'with', 'pass', 'break', 'continue', 'lambda', 'yield', 'raise', 'assert',
      'del', 'global', 'nonlocal'
    ];
    
    const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
    sortedKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      highlighted = highlighted.replace(regex, (match) => {
        // Проверяем, что это не часть маркера
        if (!match.includes('__MARKER_')) {
          return `<span style="color: #2563eb; font-weight: 600;">${match}</span>`;
        }
        return match;
      });
    });
    
    // Подсвечиваем функции и методы (после ключевых слов, но до восстановления маркеров)
    highlighted = highlighted.replace(/(\w+)\(/g, (match, funcName) => {
      // Пропускаем если это ключевое слово или часть маркера
      if (keywords.includes(funcName) || match.includes('__MARKER_') || match.includes('<span')) {
        return match;
      }
      return `<span style="color: #7c3aed;">${funcName}</span>(`;
    });
    
    // Подсвечиваем атрибуты (после функций)
    highlighted = highlighted.replace(/\.(\w+)/g, (match, attrName) => {
      // Пропускаем если часть маркера или уже подсвечено
      if (match.includes('__MARKER_') || match.includes('<span')) {
        return match;
      }
      return `.<span style="color: #ea580c;">${attrName}</span>`;
    });
    
    // Восстанавливаем маркеры обратно в HTML (в обратном порядке, чтобы не конфликтовать)
    for (let i = markers.length - 1; i >= 0; i--) {
      highlighted = highlighted.replace(`__MARKER_${i}__`, markers[i]);
    }
    
    return highlighted;
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        minHeight: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'visible',
      }}
    >
      {/* Связи между узлами */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill="rgba(148, 163, 184, 0.3)"
            />
          </marker>
        </defs>
        {edges.map((edge) => (
          <line
            key={edge.id}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="2"
            strokeDasharray="4 4"
            markerEnd="url(#arrowhead)"
          />
        ))}
      </svg>

      {/* Узлы - скрываем все узлы (SQL, Python, Plot) */}
      {nodes.map((node) => null)}
    </div>
  );
};
