'use client';

import { useEffect, useRef } from 'react';

type PlotPreviewProps = {
  plotJson: string;
  height?: number;
};

export function PlotPreview({ plotJson, height = 360 }: PlotPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotJson) {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      return;
    }

    let mounted = true;
    let plotly: any;

    (async () => {
      try {
        const Plotly = await import('plotly.js-dist-min');
        plotly = Plotly;
        if (!mounted || !containerRef.current) return;
        const parsed = JSON.parse(plotJson);
        await Plotly.react(
          containerRef.current,
          parsed?.data ?? [],
          parsed?.layout ?? {},
          parsed?.config ?? {},
        );
      } catch (error) {
        console.warn('Plot render failed', error);
      }
    })();

    return () => {
      mounted = false;
      if (plotly && containerRef.current) {
        try {
          plotly.purge(containerRef.current);
        } catch (error) {
          // ignore purge errors
        }
      }
    };
  }, [plotJson]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, overflow: 'hidden' }}
      className="w-full"
    />
  );
}
