import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import RecentSearch from '../models/recentSearch.js';
import LabWatch from '../models/labWatch.js';
import Notification from '../models/notification.js';
import bcrypt from 'bcryptjs';

let app, token, user;
let ownerCounter = 0;

const CENTER = { lat: 12.9716, lng: 77.5946 };

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

const createOwner = () => {
  ownerCounter += 1;
  return User.create({ name: 'Owner', email: `owner${ownerCounter}@x.com`, roles: ['LAB_OWNER'] });
};

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Lab.deleteMany({}),
    Test.deleteMany({}),
    RecentSearch.deleteMany({}),
    LabWatch.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  await User.create({
    name: 'Cust', email: 'c@x.com', roles: ['CUSTOMER'],
    passwordHash: await bcrypt.hash('pass123', 12),
  });
  const login = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'c@x.com', password: 'pass123' },
  });
  token = login.json().accessToken;
  user = await User.findOne({ email: 'c@x.com' });
});

test('GET /api/labs/nearby?sortBy=relevance ranks a farther, higher-rated lab above a closer, lower-rated one', async () => {
  const own = await createOwner();
  await Lab.create({
    owner: own._id, name: 'Close Low Rating',
    location: { type: 'Point', coordinates: [77.5946, 12.9725] }, // ~100m from center
    rating: 1, isActive: true,
  });
  await Lab.create({
    owner: own._id, name: 'Far High Rating',
    location: { type: 'Point', coordinates: [77.5946, 12.9896] }, // ~2000m from center
    rating: 5, isActive: true,
  });

  const relRes = await app.inject({
    method: 'GET',
    url: `/api/labs/nearby?lat=${CENTER.lat}&lng=${CENTER.lng}&sortBy=relevance`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(relRes.statusCode, 200);
  const relLabs = relRes.json().labs;
  assert.equal(relLabs.length, 2);
  assert.equal(relLabs[0].name, 'Far High Rating');
  assert.equal(relLabs[1].name, 'Close Low Rating');

  // Sanity check: plain distance sort flips the order — proves relevance isn't just distance.
  const distRes = await app.inject({
    method: 'GET',
    url: `/api/labs/nearby?lat=${CENTER.lat}&lng=${CENTER.lng}&sortBy=distance`,
    headers: { authorization: `Bearer ${token}` },
  });
  const distLabs = distRes.json().labs;
  assert.equal(distLabs[0].name, 'Close Low Rating');
  assert.equal(distLabs[1].name, 'Far High Rating');
});

test('GET /api/labs/nearby?q=sugar only returns labs with a test matching an expanded synonym', async () => {
  const own = await createOwner();
  const labMatch = await Lab.create({
    owner: own._id, name: 'Sugar Lab',
    location: { type: 'Point', coordinates: [77.5946, 12.9720] },
    rating: 3, isActive: true,
  });
  const labNoMatch = await Lab.create({
    owner: own._id, name: 'XRay Lab',
    location: { type: 'Point', coordinates: [77.5946, 12.9720] },
    rating: 3, isActive: true,
  });
  await Test.create({ lab: labMatch._id, name: 'Fasting Blood Glucose', price: 200, isActive: true });
  await Test.create({ lab: labNoMatch._id, name: 'Chest X-Ray', price: 500, isActive: true });

  const res = await app.inject({
    method: 'GET',
    url: `/api/labs/nearby?lat=${CENTER.lat}&lng=${CENTER.lng}&q=sugar`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const labs = res.json().labs;
  assert.equal(labs.length, 1);
  assert.equal(labs[0].name, 'Sugar Lab');
});

test('POST /api/me/recent-searches caps at 20 per user, evicting the oldest first', async () => {
  for (let i = 0; i < 21; i++) {
    const res = await app.inject({
      method: 'POST', url: '/api/me/recent-searches',
      headers: { authorization: `Bearer ${token}` },
      payload: { kind: 'QUERY', value: `search-${i}` },
    });
    assert.equal(res.statusCode, 201);
    // Ensure distinct createdAt ordering across rapid inserts.
    await new Promise((r) => setTimeout(r, 3));
  }

  const res = await app.inject({
    method: 'GET', url: '/api/me/recent-searches',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  const { searches } = res.json();
  assert.equal(searches.length, 20);
  const values = searches.map((s) => s.value);
  assert.ok(!values.includes('search-0'), 'oldest search should have been evicted');
  assert.ok(values.includes('search-20'), 'newest search should be present');
});

test('POST /api/me/lab-watches creates a watch; GET /api/me/recent-searches returns only the authenticated user\'s own searches', async () => {
  const watchRes = await app.inject({
    method: 'POST', url: '/api/me/lab-watches',
    headers: { authorization: `Bearer ${token}` },
    payload: { lat: CENTER.lat, lng: CENTER.lng, radiusMeters: 3000 },
  });
  assert.equal(watchRes.statusCode, 201);
  assert.equal(await LabWatch.countDocuments({ user: user._id }), 1);

  await User.create({
    name: 'Other', email: 'other@x.com', roles: ['CUSTOMER'],
    passwordHash: await bcrypt.hash('pass123', 12),
  });
  const otherLogin = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'other@x.com', password: 'pass123' },
  });
  const otherToken = otherLogin.json().accessToken;

  await app.inject({
    method: 'POST', url: '/api/me/recent-searches',
    headers: { authorization: `Bearer ${token}` },
    payload: { kind: 'QUERY', value: 'mine' },
  });
  await app.inject({
    method: 'POST', url: '/api/me/recent-searches',
    headers: { authorization: `Bearer ${otherToken}` },
    payload: { kind: 'QUERY', value: 'not-mine' },
  });

  const res = await app.inject({
    method: 'GET', url: '/api/me/recent-searches',
    headers: { authorization: `Bearer ${token}` },
  });
  const { searches } = res.json();
  assert.equal(searches.length, 1);
  assert.equal(searches[0].value, 'mine');
});

test('a lab activating within a watch radius produces exactly one LAB_JOINED_NEARBY notification', async () => {
  await app.inject({
    method: 'POST', url: '/api/me/lab-watches',
    headers: { authorization: `Bearer ${token}` },
    payload: { lat: CENTER.lat, lng: CENTER.lng, radiusMeters: 3000 },
  });

  const own = await createOwner();
  await Lab.create({
    owner: own._id, name: 'New Nearby Lab',
    location: { type: 'Point', coordinates: [77.5946, 12.9720] }, // well within 3000m
    isActive: true,
  });

  // The post-save hook is fire-and-forget; poll briefly for the notification to land.
  let notif = null;
  for (let i = 0; i < 40 && !notif; i++) {
    notif = await Notification.findOne({ user: user._id, event: 'LAB_JOINED_NEARBY' });
    if (!notif) await new Promise((r) => setTimeout(r, 25));
  }
  assert.ok(notif, 'expected a LAB_JOINED_NEARBY notification');
  assert.match(notif.body, /New Nearby Lab/);

  const watch = await LabWatch.findOne({ user: user._id });
  assert.ok(watch.notifiedAt, 'watch.notifiedAt should be set after notifying');

  // A second lab activating nearby must not re-notify the already-notified watch.
  await Lab.create({
    owner: own._id, name: 'Second New Lab',
    location: { type: 'Point', coordinates: [77.5946, 12.9720] },
    isActive: true,
  });
  await new Promise((r) => setTimeout(r, 150));
  const count = await Notification.countDocuments({ user: user._id, event: 'LAB_JOINED_NEARBY' });
  assert.equal(count, 1);
});
