import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import { toCatalogCode } from '../services/_shared/catalogCode.js';
import { backfillCatalog } from '../scripts/backfillPatientRedesign.js';
import bcrypt from 'bcryptjs';

let app, lab, owner;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({})]);
  owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'] });
  lab = await Lab.create({
    owner: owner._id, name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:5 },
    isActive:true, isVerified:true,
  });
});

test('toCatalogCode slugs names', () => {
  assert.equal(toCatalogCode('Complete Blood Count (CBC)'), 'complete-blood-count-cbc');
  assert.equal(toCatalogCode('  Thyroid Profile (T3, T4, TSH) '), 'thyroid-profile-t3-t4-tsh');
  assert.equal(toCatalogCode("Women's Wellness Package"), 'womens-wellness-package');
});

test('Test without catalogCode gets one on save and mrp defaults to price', async () => {
  const t = await Test.create({ lab: lab._id, name: 'Lipid Profile', price: 549 });
  assert.equal(t.catalogCode, 'lipid-profile');
  assert.equal(t.mrp, 549);
  assert.equal(t.parametersCount, 1);
  assert.equal(t.isPackage, false);
  assert.equal(t.homeCollection, true);
});

test('explicit catalogCode is kept', async () => {
  const t = await Test.create({ lab: lab._id, name: 'CBC', catalogCode: 'complete-blood-count-cbc', price: 299, mrp: 450 });
  assert.equal(t.catalogCode, 'complete-blood-count-cbc');
  assert.equal(t.mrp, 450);
});

test('backfillCatalog fills missing catalogCode/mrp and is idempotent', async () => {
  await Test.collection.insertOne({ lab: lab._id, name: 'Vitamin D', price: 800, isActive: true });
  const first = await backfillCatalog();
  assert.equal(first.catalogCode, 1);
  assert.equal(first.mrp, 1);
  const t = await Test.findOne({ name: 'Vitamin D' });
  assert.equal(t.catalogCode, 'vitamin-d');
  assert.equal(t.mrp, 800);
  const second = await backfillCatalog();
  assert.equal(second.catalogCode, 0);
  assert.equal(second.mrp, 0);
});

// ---- GET /api/catalog/tests ----
const seedCatalog = async () => {
  const labB = await Lab.create({
    owner: owner._id, name: 'Lab B',
    location: { type: 'Point', coordinates: [77.6, 13.5] }, // ~70 km from Lab A
    openingHours: openAllWeek, isActive: true, isVerified: true,
  });
  const inactive = await Lab.create({
    owner: owner._id, name: 'Lab Off',
    location: { type: 'Point', coordinates: [77.5, 12.9] },
    openingHours: openAllWeek, isActive: false,
  });
  await Test.create([
    { lab: lab._id, name: 'Complete Blood Count (CBC)', price: 299, mrp: 450, turnaroundHours: 6 },
    { lab: lab._id, name: 'Lipid Profile', price: 549, fastingHours: 12 },
    { lab: labB._id, name: 'Complete Blood Count (CBC)', price: 349, turnaroundHours: 4 },
    { lab: inactive._id, name: 'Complete Blood Count (CBC)', price: 99, turnaroundHours: 1 },
  ]);
};

const catalogToken = async () => {
  if (!(await User.exists({ email: 'cust@x.com' }))) await User.create({
    name: 'Cust', email: 'cust@x.com', roles: ['CUSTOMER'],
    passwordHash: await bcrypt.hash('pass123', 12),
  });
  const login = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'cust@x.com', password: 'pass123' },
  });
  return login.json().accessToken;
};

const getCatalog = async (qs = '') => {
  const token = await catalogToken();
  const res = await app.inject({
    method: 'GET', url: `/api/catalog/tests${qs}`,
    headers: { authorization: `Bearer ${token}` },
  });
  return res;
};

test('GET /catalog/tests groups by code across active labs', async () => {
  await seedCatalog();
  const res = await getCatalog();
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.items.length, 2);
  assert.equal(body.total, 2);
  const cbc = body.items.find((i) => i.code === 'complete-blood-count-cbc');
  assert.equal(cbc.price, 299);
  assert.equal(cbc.mrp, 450);
  assert.equal(cbc.turnaroundHours, 4);
  assert.equal(cbc.labCount, 2);
});

test('GET /catalog/tests requires auth', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/catalog/tests' });
  assert.equal(res.statusCode, 401);
});

test('GET /catalog/tests?noFasting=true excludes fasting tests', async () => {
  await seedCatalog();
  const body = (await getCatalog('?noFasting=true')).json();
  assert.deepEqual(body.items.map((i) => i.code), ['complete-blood-count-cbc']);
});

test('GET /catalog/tests?maxPrice=300 returns only CBC', async () => {
  await seedCatalog();
  const body = (await getCatalog('?maxPrice=300')).json();
  assert.deepEqual(body.items.map((i) => i.code), ['complete-blood-count-cbc']);
});

test('GET /catalog/tests?sort=low orders by price ascending', async () => {
  await seedCatalog();
  const body = (await getCatalog('?sort=low')).json();
  assert.deepEqual(body.items.map((i) => i.price), [299, 549]);
  const high = (await getCatalog('?sort=high')).json();
  assert.deepEqual(high.items.map((i) => i.price), [549, 299]);
});

test('GET /catalog/tests?q=blood matches CBC by name', async () => {
  await seedCatalog();
  const body = (await getCatalog('?q=blood')).json();
  assert.deepEqual(body.items.map((i) => i.code), ['complete-blood-count-cbc']);
});

test('GET /catalog/tests with lat/lng/radius excludes far labs', async () => {
  await seedCatalog();
  const body = (await getCatalog('?lat=12.9&lng=77.5&radius=1000')).json();
  const cbc = body.items.find((i) => i.code === 'complete-blood-count-cbc');
  assert.equal(body.items.length, 2);
  assert.equal(cbc.labCount, 1);
  assert.equal(cbc.price, 299);
  assert.equal(cbc.turnaroundHours, 6);
});
