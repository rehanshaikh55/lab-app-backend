import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRequiredEnv } from '../config/env.js';

test('assertRequiredEnv throws when a required var is missing', () => {
  const saved = process.env.MONGO_URI;
  delete process.env.MONGO_URI;
  process.env.JWT_SECRET = 'x';
  process.env.COOKIE_PASSWORD = 'y';
  assert.throws(() => assertRequiredEnv(), /MONGO_URI/);
  process.env.MONGO_URI = saved;
});

test('assertRequiredEnv passes when all present', () => {
  process.env.JWT_SECRET = 'x';
  process.env.MONGO_URI = 'mongodb://localhost/x';
  process.env.COOKIE_PASSWORD = 'y';
  assert.doesNotThrow(() => assertRequiredEnv());
});
