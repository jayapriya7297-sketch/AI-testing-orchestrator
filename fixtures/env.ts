import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}; copy it from .env.example into .env`);
  }
  return value;
}

export const env = {
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  get adminEmail() {
    return required('ADMIN_EMAIL');
  },
  get adminPassword() {
    return required('ADMIN_PASSWORD');
  },
  get userEmail() {
    return required('USER_EMAIL');
  },
  get userPassword() {
    return required('USER_PASSWORD');
  },
};
