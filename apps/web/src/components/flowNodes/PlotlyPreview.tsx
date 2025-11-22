"use client";

import { useEffect, useRef } from "react";

let plotlyPromise: Promise<any> | null = null;

async function getPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import("plotly.js-dist-min");
  }
  return plotlyPromise;
}

type PlotlyPreviewProps = {
  plotJson?: string | null;
  height?: number;
};

export default function PlotlyPreview({ plotJson, height = 320 }: PlotlyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!plotJson || !containerRef.current) {
      return;
    }

    (async () => {
      try {
        const PlotlyModule = await getPlotly();
        if (cancelled || !containerRef.current) return;
        const payload = JSON.parse(plotJson);
        const Plotly = PlotlyModule.default ?? PlotlyModule;
        await Plotly.react(containerRef.current, payload.data, payload.layout ?? {}, {
          responsive: true,
          displaylogo: false,
        });
      } catch (error) {
        console.warn("Plotly render error", error);
      }
    })();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        getPlotly().then((PlotlyModule) => {
          const Plotly = PlotlyModule.default ?? PlotlyModule;
          Plotly.purge(containerRef.current);
        });
      }
    };
  }, [plotJson]);

  return <div ref={containerRef} className="w-full" style={{ minHeight: height }} />;
}
