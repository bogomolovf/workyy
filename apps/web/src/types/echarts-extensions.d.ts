// Type declarations for ECharts extensions that don't ship their own types
declare module 'echarts-gl' {
  // echarts-gl registers itself as an ECharts extension when imported
  const echartsGL: void;
  export default echartsGL;
}

declare module 'echarts-wordcloud' {
  // echarts-wordcloud registers itself as an ECharts extension when imported
  const echartsWordCloud: void;
  export default echartsWordCloud;
}

declare module 'echarts-liquidfill' {
  // echarts-liquidfill registers itself as an ECharts extension when imported
  const echartsLiquidFill: void;
  export default echartsLiquidFill;
}
