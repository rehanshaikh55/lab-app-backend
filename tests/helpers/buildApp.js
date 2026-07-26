import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

export const setupTestApp = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.MONGO_URI = uri;
  process.env.COOKIE_PASSWORD = 'test-cookie-password-at-least-32-chars';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);
  const { buildApp } = await import('../../app.js');
  const app = await buildApp({ withAdmin: false });
  await app.ready();
  return app;
};

export const teardownTestApp = async (app) => {
  if (app) await app.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};
