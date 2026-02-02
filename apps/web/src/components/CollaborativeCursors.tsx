import { EdgeLabelRenderer, useViewport } from 'reactflow';
import { useEffect, useRef } from 'react';
import type { Cursor } from '../hooks/useCursorStateSynced';

// Scale factors - cursor and label are independent
const CURSOR_SCALE = 0.9;  // Smaller cursor
const LABEL_SCALE = 1.3;   // Bigger label

function CollaborativeCursors({ cursors }: { cursors: Cursor[] }) {
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
      <style dangerouslySetInnerHTML={{
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
            /* No transition - instant updates for smooth tracking */
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
        `
      }} />
      
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1300, // Ensure cursors are above all UI elements: nodes (up to 20), Controls (1100), PenToolbar (1000)
          }}
        >
          {cursors.map(({ id, color, x, y, userName }) => {
            const translate = `translate(${x}px, ${y}px)`;
            const scale = `scale(${1 / viewport.zoom})`;

            return (
              <svg
                key={id}
                className="collaborative-cursor-group"
                style={{
                  position: 'absolute',
                  transform: translate,
                  pointerEvents: 'none',
                  overflow: 'visible',
                  willChange: 'transform', // Optimize rendering for frequent transform updates
                }}
              >
              <g style={{ transform: scale, transformOrigin: '0 0' }}>
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
                  <path
                    d={cursorPath}
                    fill={color}
                    className="collaborative-cursor-path"
                  />
                </g>
                
                {/* User name label - bigger size */}
                {userName && (
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
      </EdgeLabelRenderer>
    </>
  );
}

// Simple clean cursor arrow path
const cursorPath = `M0 0 L0 16 L4 12 L7 18 L10 17 L7 11 L12 11 Z`;

export default CollaborativeCursors;

