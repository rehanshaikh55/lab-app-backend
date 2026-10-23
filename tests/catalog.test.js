import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import { toCatalogCode } from '../services/_shared/catalogCode.js';
import { backfillCatalog } from '../scripts/backfillPatientRedesign.js';

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
