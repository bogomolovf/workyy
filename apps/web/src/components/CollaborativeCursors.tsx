import { useEffect, useRef } from 'react';
import { useViewport } from 'reactflow';
import type { Cursor } from '../hooks/useCursorStateSynced';

// Scale factors - cursor and label are independent
const CURSOR_SCALE = 0.9; // Smaller cursor
const LABEL_SCALE = 1.3; // Bigger label

function CollaborativeCursors({
  cursors,
  ownClientId,
}: {
  cursors: Cursor[];
  /** Current user's client ID — label (nickname) is hidden for own cursor, shown only for others */
  ownClientId?: string;
}) {
  const viewport = useViewport();
  const animatedLabelsRef = useRef<Set<string>>(new Set());

  // Track which cursors have completed their animation
  useEffect(() => {
    // After animation duration (300ms), mark all visible cursors as animated
    const timer = setTimeout(() => {
      cursors.forEach(({ id }) => {
        animatedLabelsRef.current.add(id);
      });
    }, 350); // Slightly longer than animation duration (300ms)

    return () => clearTimeout(timer);
  }, [cursors]);

  return (
    <>
      {/* Global styles for cursor animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes collaborativeCursorFadeIn {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes collaborativeCursorPulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.85;
            }
          }
          
          @keyframes collaborativeLabelFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          
          .collaborative-cursor-group {
            animation: collaborativeCursorFadeIn 0.2s ease-out;
            /* Smooth interpolation between position updates (~33ms throttle).
               80ms ease-out matches node transition — absorbs WebSocket jitter
               so the remote cursor glides instead of jumping between positions. */
            transition: transform 80ms ease-out;
          }
          
          .collaborative-cursor-path {
            animation: collaborativeCursorPulse 2s ease-in-out infinite;
          }
          
          .collaborative-cursor-label-group {
            animation: collaborativeLabelFadeIn 0.3s ease-out;
            animation-fill-mode: both;
          }
          
          /* Prevent animation from restarting when cursor visibility changes */
          .collaborative-cursor-label-group.animation-complete {
            animation: none;
            opacity: 1;
          }
        `,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 60, // Above comment anchors (z-index: 51) and comment cards (z-index: 52)
        }}
      >
        {cursors.map(({ id, color, x, y, userName }) => {
          const screenX = x * viewport.zoom + viewport.x;
          const screenY = y * viewport.zoom + viewport.y;
          const translate = `translate(${screenX}px, ${screenY}px)`;

          return (
            <svg
              key={id}
              className="collaborative-cursor-group"
              style={{
                position: 'absolute',
                transform: translate,
                pointerEvents: 'none',
                overflow: 'visible',
                willChange: 'transform',
              }}
            >
              <g style={{ transform: `scale(1)`, transformOrigin: '0 0' }}>
                {/* Cursor icon - user color fill with bold black outline */}
                <g
                  className="collaborative-cursor-icon"
                  style={{
                    transform: `translate(-8px, -2px) scale(${CURSOR_SCALE})`,
                    transformOrigin: '0 0',
                  }}
                >
                  {/* Black outline layer */}
                  <path
                    d={cursorPath}
                    fill="#000000"
                    stroke="#000000"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* User color fill layer on top */}
                  <path d={cursorPath} fill={color} className="collaborative-cursor-path" />
                </g>

                {/* User name label - only for other users, not for own cursor */}
                {userName && (!ownClientId || id !== ownClientId) && (
                  <g
                    className={`collaborative-cursor-label-group ${
                      animatedLabelsRef.current.has(id) ? 'animation-complete' : ''
                    }`}
                    style={{
                      transform: `translate(10px, 14px) scale(${LABEL_SCALE})`,
                      transformOrigin: '0 0',
                    }}
                  >
                    <rect
                      x={-3}
                      y={-8}
                      width={Math.min(Math.max(userName.length * 5.5 + 10, 45), 120)}
                      height={16}
                      rx={4}
                      fill={color}
                      opacity={0.95}
                    />
                    <text
                      x={0}
                      y={0}
                      fill="white"
                      fontSize={10}
                      fontWeight="600"
                      style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        dominantBaseline: 'central',
                        textAnchor: 'start',
                      }}
                    >
                      {userName.length > 14 ? `${userName.substring(0, 11)}...` : userName}
                    </text>
                  </g>
                )}
              </g>
            </svg>
          );
        })}
      </div>
    </>
  );
}

// Simple clean cursor arrow path
const cursorPath = `M0 0 L0 16 L4 12 L7 18 L10 17 L7 11 L12 11 Z`;

export default CollaborativeCursors;
