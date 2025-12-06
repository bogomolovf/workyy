import { config } from 'dotenv';

config();

const required = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_WS_URL', 'DATABASE_URL'];

const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error('Missing environment variables:', missing.join(', '));
  process.exit(1);
}

console.log('Environment variables look good');
