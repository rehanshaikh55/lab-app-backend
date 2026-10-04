import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Session from '../models/session.js';
import bcrypt from 'bcryptjs';

let app, user;

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Session.deleteMany({})]);
  user = await User.create({
    name: 'Cust', email: 'cap@x.com', roles: ['CUSTOMER'],
    passwordHash: await bcrypt.hash('pass123', 12),
  });
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const login = (deviceId) => app.inject({
  method: 'POST', url: '/api/auth/login',
  payload: { email: 'cap@x.com', password: 'pass123', deviceId },
});

test('logging in on a 4th device evicts the oldest session, capping at 3', async () => {
  const first = await login('device-1');
  assert.equal(first.statusCode, 200);
  const firstRefreshToken = first.json().refreshToken;
  await wait(5);

  const second = await login('device-2');
  assert.equal(second.statusCode, 200);
  await wait(5);

  const third = await login('device-3');
  assert.equal(third.statusCode, 200);
  await wait(5);

  const fourth = await login('device-4');
  assert.equal(fourth.statusCode, 200);

  const count = await Session.countDocuments({ user: user._id });
  assert.equal(count, 3);

  // Oldest session (device-1's) was evicted — its refresh token no longer works.
  const refreshAttempt = await app.inject({
    method: 'POST', url: '/api/auth/refresh',
    payload: { refreshToken: firstRefreshToken },
  });
  assert.equal(refreshAttempt.statusCode, 401);

  // The 3 surviving sessions belong to devices 2, 3 and 4.
  const remaining = (await Session.find({ user: user._id })).map((s) => s.deviceId).sort();
  assert.deepEqual(remaining, ['device-2', 'device-3', 'device-4']);
});

test('re-login on the same deviceId replaces that device session instead of adding a new one', async () => {
  await login('device-a');
  await wait(5);
  await login('device-a');

  const count = await Session.countDocuments({ user: user._id });
  assert.equal(count, 1);
});

test('POST /api/auth/refresh succeeds with a valid token and rotates it (old token stops working)', async () => {
  const first = await login('device-x');
  assert.equal(first.statusCode, 200);
  const refreshToken = first.json().refreshToken;

  const rotated = await app.inject({
    method: 'POST', url: '/api/auth/refresh',
    payload: { refreshToken },
  });
  assert.equal(rotated.statusCode, 200);
  const newRefreshToken = rotated.json().refreshToken;
  assert.ok(newRefreshToken);
  assert.notEqual(newRefreshToken, refreshToken);

  const reuse = await app.inject({
    method: 'POST', url: '/api/auth/refresh',
    payload: { refreshToken },
  });
  assert.equal(reuse.statusCode, 401);

  // The rotated token is now valid.
  const rotatedWorks = await app.inject({
    method: 'POST', url: '/api/auth/refresh',
    payload: { refreshToken: newRefreshToken },
  });
  assert.equal(rotatedWorks.statusCode, 200);
});
