import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Session from '../models/session.js';
import bcrypt from 'bcryptjs';
import { runAccountDeletion } from '../scheduler/jobs/accountDeletionJob.js';

let app, user, token;

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Session.deleteMany({})]);
  user = await User.create({
    name: 'Del Me', email: 'del@x.com', roles: ['CUSTOMER'],
    passwordHash: await bcrypt.hash('pass123', 12),
  });
  const login = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'del@x.com', password: 'pass123' },
  });
  token = login.json().accessToken;
});

test('DELETE /api/me schedules deletion ~30 days out and returns it', async () => {
  const res = await app.inject({
    method: 'DELETE', url: '/api/me',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.deletionScheduledAt);

  const scheduledAt = new Date(body.deletionScheduledAt);
  const days = (scheduledAt.getTime() - Date.now()) / (24 * 3600 * 1000);
  assert.ok(days > 29 && days < 31, `expected ~30 days out, got ${days}`);

  const updated = await User.findById(user._id);
  assert.ok(updated.deletionScheduledAt);

  // Requesting deletion also logs the account out everywhere.
  assert.equal(await Session.countDocuments({ user: user._id }), 0);
});

test('POST /api/me/restore before the grace period elapses clears deletionScheduledAt', async () => {
  const del = await app.inject({
    method: 'DELETE', url: '/api/me',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(del.statusCode, 200);

  const restore = await app.inject({
    method: 'POST', url: '/api/me/restore',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(restore.statusCode, 200);

  const updated = await User.findById(user._id);
  assert.equal(updated.deletionScheduledAt, null);
});

test('POST /api/me/restore after the grace period has elapsed returns 400', async () => {
  await User.findByIdAndUpdate(user._id, { deletionScheduledAt: new Date(Date.now() - 1000) });

  const restore = await app.inject({
    method: 'POST', url: '/api/me/restore',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(restore.statusCode, 400);
  assert.match(restore.json().detail, /Grace period has elapsed/);

  // Still scheduled — restore did not clear it.
  const updated = await User.findById(user._id);
  assert.ok(updated.deletionScheduledAt);
});

test('runAccountDeletion anonymizes a user whose deletionScheduledAt is in the past', async () => {
  await User.findByIdAndUpdate(user._id, { deletionScheduledAt: new Date(Date.now() - 1000) });
  // beforeEach's login already created one Session; add a second to confirm the job
  // clears *all* of the user's sessions, not just one.
  await Session.create({ user: user._id, refreshTokenHash: 'irrelevant-hash', deviceId: 'd1' });
  assert.ok((await Session.countDocuments({ user: user._id })) >= 1);

  const purged = await runAccountDeletion({ now: new Date() });
  assert.equal(purged, 1);

  const after = await User.findById(user._id);
  assert.ok(after, 'user document should still exist — anonymized, not hard-deleted');
  assert.equal(after.name, 'Deleted User');
  assert.equal(after.passwordHash, undefined);
  assert.equal(after.email, undefined);
  assert.equal(after.deletionScheduledAt, null);

  assert.equal(await Session.countDocuments({ user: user._id }), 0);
});

test('runAccountDeletion is a no-op when no user is due', async () => {
  const purged = await runAccountDeletion({ now: new Date() });
  assert.equal(purged, 0);
});
