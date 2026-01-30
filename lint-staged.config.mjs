export default {
  '*.{ts,tsx,js,jsx}': ['pnpm format:fix', 'eslint --fix'],
  '*.{json,md,yml,yaml}': ['pnpm format:fix'],
};
