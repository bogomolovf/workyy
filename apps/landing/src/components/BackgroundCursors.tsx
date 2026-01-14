import { useEffect, useState } from 'react';

interface CursorPosition {
  id: string;
  x: number; // в пикселях от левого края viewport
  y: number; // в пикселях от верхнего края viewport
  color: string;
  userName: string;
  delay: number;
}

const cursorPath = `
  M3.29227 0.048984C3.47033 -0.032338 3.67946 -0.00228214 3.8274 0.125891L12.8587
  7.95026C13.0134 8.08432 13.0708 8.29916 13.0035 8.49251C12.9362 8.68586 12.7578
  8.81866 12.5533 8.82768L9.21887 8.97474L11.1504 13.2187C11.2648 13.47 11.1538
  13.7664 10.9026 13.8808L8.75024 14.8613C8.499 14.9758 8.20255 14.8649 8.08802
  14.6137L6.15339 10.3703L3.86279 12.7855C3.72196 12.934 3.50487 12.9817 3.31479
  12.9059C3.1247 12.8301 3 12.6461 3 12.4414V0.503792C3 0.308048 3.11422 0.130306 
  3.29227 0.048984ZM4 1.59852V11.1877L5.93799 9.14425C6.05238 9.02363 6.21924 8.96776
  6.38319 8.99516C6.54715 9.02256 6.68677 9.12965 6.75573 9.2809L8.79056 13.7441L10.0332
  13.178L8.00195 8.71497C7.93313 8.56376 7.94391 8.38824 8.03072 8.24659C8.11753
  8.10494 8.26903 8.01566 8.435 8.00834L11.2549 7.88397L4 1.59852z
`;

export const BackgroundCursors = () => {
  const [cursors, setCursors] = useState<CursorPosition[]>([]);

  useEffect(() => {
    // Создаем декоративные курсоры, размещенные подальше от текста и границ
    // Распределяем их по всему сайту, но НЕ у краев доски
    const vw = window.innerWidth;
    const docHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    
    // Увеличенные отступы от краев (10% от ширины/высоты) - чтобы курсоры НЕ были у края доски
    const marginX = vw * 0.10;
    const marginY = docHeight * 0.10;
    
    const initialCursors: CursorPosition[] = [
      // Верхняя часть - дальше от краев
      { id: '1', x: marginX + 80, y: marginY + 100, color: '#2563eb', userName: 'Анна', delay: 0 },
      { id: '2', x: vw - marginX + 20, y: marginY - 280, color: '#f59e0b', userName: 'Мария', delay: 0 },
      // Средняя часть - не у краев
      { id: '3', x: marginX + 120, y: docHeight * 0.3, color: '#16a34a', userName: 'Дмитрий', delay: 0 },
      { id: '4', x: vw - marginX - 160, y: docHeight * 0.35, color: '#dc2626', userName: 'Иван', delay: 0 },
      // Нижняя часть - не у краев
      { id: '5', x: marginX + 140, y: docHeight * 0.65, color: '#7c3aed', userName: 'Елена', delay: 0 },
      { id: '6', x: vw - marginX - 200, y: docHeight * 0.7, color: '#059669', userName: 'Сергей', delay: 0 },
      // Еще ниже - не у краев
      { id: '7', x: marginX + 100, y: docHeight * 0.85, color: '#ea580c', userName: 'Ольга', delay: 0 },
      // Дополнительные курсоры справа
      { id: '8', x: vw - marginX - 150, y: docHeight * 0.52, color: '#8b5cf6', userName: 'Алексей', delay: 0 },
      { id: '9', x: vw - marginX - 170, y: docHeight * 0.88, color: '#14b8a6', userName: 'Татьяна', delay: 0 },
    ];

    setCursors(initialCursors);
    
    // Обработчик изменения размера окна для пересчета позиций
    const handleResize = () => {
      const vw = window.innerWidth;
      const docHeight = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      // Увеличенные отступы от краев (10% от ширины/высоты) - чтобы курсоры НЕ были у края доски
      const marginX = vw * 0.10;
      const marginY = docHeight * 0.10;
      
      const newCursors: CursorPosition[] = [
        { id: '1', x: marginX + 80, y: marginY + 100, color: '#2563eb', userName: 'Анна', delay: 0 },
        { id: '2', x: vw - marginX + 20, y: marginY - 280, color: '#f59e0b', userName: 'Мария', delay: 0 },
        { id: '3', x: marginX + 120, y: docHeight * 0.3, color: '#16a34a', userName: 'Дмитрий', delay: 0 },
        { id: '4', x: vw - marginX - 160, y: docHeight * 0.35, color: '#dc2626', userName: 'Иван', delay: 0 },
        { id: '5', x: marginX + 140, y: docHeight * 0.65, color: '#7c3aed', userName: 'Елена', delay: 0 },
        { id: '6', x: vw - marginX - 200, y: docHeight * 0.7, color: '#059669', userName: 'Сергей', delay: 0 },
        { id: '7', x: marginX + 100, y: docHeight * 0.85, color: '#ea580c', userName: 'Ольга', delay: 0 },
        { id: '8', x: vw - marginX - 150, y: docHeight * 0.52, color: '#8b5cf6', userName: 'Алексей', delay: 0 },
        { id: '9', x: vw - marginX - 170, y: docHeight * 0.88, color: '#14b8a6', userName: 'Татьяна', delay: 0 },
      ];
      setCursors(newCursors);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      {cursors.map((cursor) => (
        <svg
          key={cursor.id}
          style={{
            position: 'absolute',
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 1,
            animation: `float ${3 + (parseInt(cursor.id) % 3) * 0.5}s ease-in-out infinite`,
            animationDelay: `${cursor.delay}s`,
          }}
        >
          <g style={{ transform: 'translate(0, 0)' }}>
            {/* Cursor icon */}
            <g
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
              }}
            >
              <path
                d={cursorPath}
                fill={cursor.color}
                opacity={1}
              />
            </g>
            
            {/* User name label - такое же расстояние как в продукте (18px, 18px) */}
            <g
              style={{
                transform: 'translate(18px, 18px)',
              }}
            >
              {(() => {
                const labelWidth = Math.min(Math.max(cursor.userName.length * 6.5 + 12, 50), 150);
                const labelCenterX = (labelWidth / 2) - 6; // Центр прямоугольника относительно начала группы
                return (
                  <>
                    <rect
                      x={-6}
                      y={-11}
                      width={labelWidth}
                      height={18}
                      rx={6}
                      fill={cursor.color}
                      opacity={1}
                    />
                    <text
                      x={labelCenterX}
                      y={0}
                      fill="white"
                      fontSize={11}
                      fontWeight="500"
                      style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        dominantBaseline: 'central',
                        textAnchor: 'middle',
                      }}
                    >
                      {cursor.userName.length > 20 ? `${cursor.userName.substring(0, 17)}...` : cursor.userName}
                    </text>
                  </>
                );
              })()}
            </g>
          </g>
        </svg>
      ))}
    </div>
  );
};
