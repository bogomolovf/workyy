/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  webpack: (webpackConfig, { isServer }) => {
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.fallback = {
      ...(webpackConfig.resolve.fallback ?? {}),
      child_process: false,
      fs: false,
      path: false,
      crypto: false,
      module: false,
    };
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias ?? {}),
      "node:child_process": false,
      "node:fs": false,
      "node:path": false,
      "node:crypto": false,
      "node:module": false,
    };
    
    // Ensure echarts is properly resolved
    if (!isServer) {
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
      };
    }
    
    return webpackConfig;
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default config;

