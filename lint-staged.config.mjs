export default {
  '*.{ts,tsx,js,jsx}': ['pnpm format:fix', 'pnpm lint'],
  '*.{json,md,yml,yaml}': ['pnpm format:fix'],
};

