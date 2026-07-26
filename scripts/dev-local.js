// Local dev launcher: boots an on-disk MongoDB via mongodb-memory-server (no install
// required) and starts the backend against it. Use when you don't have a real MongoDB /
// Atlas cluster reachable. Data persists in ./.local-mongo-data across restarts.
//
//   npm run start:local
//
// The mongod binary is downloaded & cached on first run (needs internet once).
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '.local-mongo-data');
fs.mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, dbName: process.env.DB_NAME || 'labzy', dbPath, storageEngine: 'wiredTiger' },
});

// Override BEFORE importing app.js — dotenv/config won't clobber an already-set var.
process.env.MONGO_URI = mongod.getUri(process.env.DB_NAME || 'labzy');
console.log(`local MongoDB up at ${process.env.MONGO_URI} (data: ${dbPath})`);

const shutdown = async () => { await mongod.stop(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const { start } = await import('../app.js');
await start();
