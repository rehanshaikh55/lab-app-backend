import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';

let app;
let User;
let authService;

before(async () => {
  process.env.PUBLIC_URL = 'https://api.example.test';
  app = await setupTestApp();
  ({ default: User } = await import('../models/user.js'));
  authService = await import('../services/authService.js');
});

after(async () => {
  delete process.env.PUBLIC_URL;
  await teardownTestApp(app);
});

const token = 'a'.repeat(64);

test('GET /reset-password/:token serves an HTML form posting to the reset API', async () => {
  const res = await app.inject({ method: 'GET', url: `/reset-password/${token}` });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.body, /<form/);
  assert.match(res.body, new RegExp(`/api/auth/reset-password/${token}`));
});

test('malformed token gets an error page, not the form', async () => {
  const res = await app.inject({ method: 'GET', url: '/reset-password/%3Cscript%3E' });
  assert.equal(res.statusCode, 400);
  assert.doesNotMatch(res.body, /<form/);
  assert.doesNotMatch(res.body, /<script>/);
});

test('forgot-password stores a token and the reset link points at PUBLIC_URL', async () => {
  await User.create({ name: 'R', email: 'r@example.test', passwordHash: await bcrypt.hash('oldpass1', 12) });
  const sent = [];
  const result = await authService.forgotPassword(
    { email: 'r@example.test' },
    null,
    { sendMail: async (m) => sent.push(m) },
  );
  const user = await User.findOne({ email: 'r@example.test' });
  assert.ok(user.resetToken);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(user.resetToken)); // never leak the token
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, new RegExp(`https://api.example.test/reset-password/${user.resetToken}`));

  const res = await app.inject({
    method: 'POST',
    url: `/api/auth/reset-password/${user.resetToken}`,
    payload: { newPassword: 'newpass123' },
  });
  assert.equal(res.statusCode, 200);
  const updated = await User.findOne({ email: 'r@example.test' });
  assert.ok(await bcrypt.compare('newpass123', updated.passwordHash));
});
