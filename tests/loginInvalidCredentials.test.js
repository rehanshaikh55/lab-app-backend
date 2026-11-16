import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';

let app;

before(async () => {
  app = await setupTestApp();
  const { default: User } = await import('../models/user.js');
  await User.create({ name: 'L', email: 'l@example.test', passwordHash: await bcrypt.hash('rightpass1', 12) });
});

after(async () => { await teardownTestApp(app); });

const login = (email, password) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });

for (const [label, email, password] of [
  ['wrong password', 'l@example.test', 'wrongpass1'],
  ['unknown email', 'nobody@example.test', 'whatever1'],
]) {
  test(`${label}: 401 INVALID_CREDENTIALS with a readable message`, async () => {
    const res = await login(email, password);
    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.match(body.type, /\/INVALID_CREDENTIALS$/);
    assert.equal(body.detail, 'Incorrect email or password');
  });
}

test('correct password still logs in', async () => {
  const res = await login('l@example.test', 'rightpass1');
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().accessToken);
});
