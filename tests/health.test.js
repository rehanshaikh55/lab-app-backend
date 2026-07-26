import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';

let app;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

test('GET /health returns ok + connected db', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.db, 'connected');
});
