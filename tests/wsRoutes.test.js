import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';

let app;
let base;
const open = [];

before(async () => {
  app = await setupTestApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `ws://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  for (const s of open) { try { s.terminate(); } catch { /* ignore */ } }
  await teardownTestApp(app);
});

const connect = (query) => {
  const ws = new WebSocket(`${base}/ws${query}`);
  open.push(ws);
  return ws;
};

test('authenticated socket receives notify() fan-out', async () => {
  const userId = 'a1b2c3d4e5f6a1b2c3d4e5f6';
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
  const ws = connect(`?token=${token}`);
  const received = new Promise((resolve, reject) => {
    ws.on('message', (m) => resolve(JSON.parse(m.toString())));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout waiting for message')), 5000);
  });
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  const { notify } = await import('../services/notificationService.js');
  // allow the server to register the socket before publishing
  await new Promise((r) => setTimeout(r, 100));
  await notify({ userId, event: 'TEST', title: 't', body: 'b' });
  const msg = await received;
  assert.equal(msg.event, 'TEST');
});

test('missing token closes the socket with 1008', async () => {
  const ws = connect('');
  const code = await new Promise((resolve, reject) => {
    ws.on('close', (c) => resolve(c));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout waiting for close')), 5000);
  });
  assert.equal(code, 1008);
});
