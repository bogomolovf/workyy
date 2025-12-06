import { useEffect, useRef, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import type { ReactFlowInstance } from 'reactflow';

const clampZoom = (value: number) => Math.round(value * 100);

type ZoomHudProps = {
  instance: ReactFlowInstance | null;
};

export const ZoomHud = memo(function ZoomHud({ instance }: ZoomHudProps) {
  const zoomRef = useRef<number>(clampZoom(instance?.getZoom() ?? 1));
  const [zoom, setZoom] = useState(zoomRef.current);

  useEffect(() => {
    if (!instance) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = clampZoom(instance.getZoom());
        if (zoomRef.current !== next) {
          zoomRef.current = next;
          setZoom(next);
        }
      });
    };
    update();
    const unsubscribe = instance?.on?.('move', update);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe?.();
    };
  }, [instance]);

  return createPortal(
    <div className="zoom-hud" aria-live="polite">
      {zoom}%
    </div>,
    document.body,
  );
});
