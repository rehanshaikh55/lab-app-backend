import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';

let app;
const realFetch = globalThis.fetch;

before(async () => {
  process.env.PUBLIC_URL = 'https://api.example.test';
  process.env.BREVO_API_KEY = 'test-brevo-key';
  process.env.EMAIL_FROM = 'sender@example.test';
  app = await setupTestApp();
  const { default: User } = await import('../models/user.js');
  await User.create({ name: 'F', email: 'f@example.test', passwordHash: await bcrypt.hash('oldpass1', 12) });
});

afterEach(() => { globalThis.fetch = realFetch; });

after(async () => {
  for (const k of ['PUBLIC_URL', 'BREVO_API_KEY', 'EMAIL_FROM']) delete process.env[k];
  await teardownTestApp(app);
});

const forgot = () => app.inject({
  method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'f@example.test' },
});

test('with BREVO_API_KEY the reset email goes through the Brevo HTTPS API', async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push({ url, opts }); return new Response('{}', { status: 201 }); };

  const res = await forgot();
  assert.equal(res.statusCode, 200);
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].opts.headers['api-key'], 'test-brevo-key');
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.sender.email, 'sender@example.test');
  assert.deepEqual(body.to, [{ email: 'f@example.test' }]);
  assert.match(body.htmlContent, /https:\/\/api\.example\.test\/reset-password\/[a-f0-9]{64}/);
});

test('the API answers immediately even if the email provider hangs', async () => {
  globalThis.fetch = () => new Promise(() => {}); // never resolves
  const started = Date.now();
  const res = await forgot();
  assert.equal(res.statusCode, 200);
  assert.ok(Date.now() - started < 3000, `took ${Date.now() - started}ms`);
});
