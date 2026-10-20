import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';


const envCandidates = [
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (envPath) {
  dotenv.config({ path: envPath, override: true });

  try {
    const rawContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of rawContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...rest] = trimmed.split('=');
        const key = k.trim();
        let val = rest.join('=').trim();
        val = val.replace(/^["'](.*)["']$/, '$1');
        process.env[key] = val;
      }
    }
  } catch {
    
  }
}

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});
