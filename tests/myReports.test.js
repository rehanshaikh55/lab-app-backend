import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import Report from '../models/report.js';

let app, token, lab, testA, testB, customer, other, depId;

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

const mkBooking = (over) => Booking.create({
  user: customer._id, lab: lab._id, tests: [testA._id],
  scheduledDate: new Date('2026-09-10'), slot: { start: '10:00', end: '10:30' },
  collectionType: 'IN_LAB', patient: { name: 'Cust', isSelf: true },
  totalAmount: 300, status: 'COMPLETED', paymentMethod: 'ONLINE', ...over,
});

const mkReport = async (booking, testDoc, over = {}) => {
  const r = await Report.create({
    booking: booking._id, test: testDoc._id, file: { uri: 'reports/x.pdf' }, ...over,
  });
  await Booking.updateOne({ _id: booking._id }, { $push: { reports: { test: testDoc._id, report: r._id } } });
  return r;
};

const get = (qs = '') => app.inject({
  method: 'GET', url: `/api/me/reports${qs}`, headers: { authorization: `Bearer ${token}` },
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}),
    Booking.deleteMany({}), Report.deleteMany({}),
  ]);
  const owner = await User.create({ name: 'Owner', email: 'mr-owner@x.com', roles: ['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123', 12) });
  lab = await Lab.create({
    owner: owner._id, name: 'Lab A',
    location: { type: 'Point', coordinates: [77.5, 12.9] },
    slotMatrix: { duration: 30, intervalMinutes: 30, maxBookingsPerSlot: 5 },
    isActive: true, isVerified: true,
  });
  testA = await Test.create({ lab: lab._id, name: 'CBC', price: 300, isActive: true, turnaroundHours: 12 });
  testB = await Test.create({ lab: lab._id, name: 'Lipid Panel', price: 400, isActive: true, turnaroundHours: 24 });
  customer = await User.create({ name: 'Cust', email: 'mr-cust@x.com', roles: ['CUSTOMER'], passwordHash: await bcrypt.hash('pass123', 12) });
  other = await User.create({ name: 'Other', email: 'mr-other@x.com', roles: ['CUSTOMER'], passwordHash: await bcrypt.hash('pass123', 12) });
  depId = new mongoose.Types.ObjectId();
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'mr-cust@x.com', password: 'pass123' } });
  token = login.json().accessToken;
});

const seed = async () => {
  const done = await mkBooking({ scheduledDate: new Date('2026-09-01') });
  await mkReport(done, testA, {
    issuedAt: new Date('2026-09-03'),
    parameters: [
      { name: 'Hb', value: '9', unit: 'g/dL', flag: 'LOW' },
      { name: 'WBC', value: '7000', flag: 'NORMAL' },
    ],
  });
  const processing = await mkBooking({ status: 'PROCESSING', tests: [testB._id], scheduledDate: new Date('2026-09-10') });
  const depBooking = await mkBooking({
    scheduledDate: new Date('2026-09-02'),
    patient: { name: 'Asha', relation: 'mother', dependentId: depId, isSelf: false },
  });
  await mkReport(depBooking, testA, { issuedAt: new Date('2026-09-04') });
  const foreign = await mkBooking({ user: other._id });
  await mkReport(foreign, testA, { issuedAt: new Date('2026-09-05') });
  return { done, processing, depBooking };
};

test('default feed: own READY + PROCESSING rows, newest first, others excluded', async () => {
  const { done, processing } = await seed();
  const res = await get();
  assert.equal(res.statusCode, 200);
  const rows = res.json().reports;
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.status), ['PROCESSING', 'READY', 'READY']);
  const [pending, depRow, selfRow] = rows;
  assert.equal(pending._id, `pending-${processing._id}`);
  assert.equal(pending.title, 'Lipid Panel');
  assert.deepEqual(pending.testIds, [testB._id.toString()]);
  assert.equal(pending.issuedAt, null);
  assert.equal(new Date(pending.expectedAt).getTime(), new Date('2026-09-10').getTime() + 24 * 3600 * 1000);
  assert.equal(depRow.patient.dependentId, depId.toString());
  assert.equal(selfRow.bookingId, done._id.toString());
  assert.equal(selfRow.title, 'CBC');
  assert.equal(selfRow.parameters.length, 2);
  assert.equal(selfRow.parameters[0].flag, 'LOW');
  assert.equal(selfRow.lab.name, 'Lab A');
  assert.equal(selfRow.patient.dependentId, null);
  assert.ok(selfRow.catalogCodes.length === 1);
});

test('patient=self returns only own-patient rows', async () => {
  await seed();
  const rows = (await get('?patient=self')).json().reports;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.patient.dependentId === null));
});

test('patient=<dependentId> returns that dependent only, with relation', async () => {
  await seed();
  const rows = (await get(`?patient=${depId}`)).json().reports;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].patient.relation, 'mother');
  assert.equal(rows[0].patient.name, 'Asha');
});

test('replaced report is excluded and its replacement shown', async () => {
  const b = await mkBooking();
  const old = await mkReport(b, testA, { replacedAt: new Date(), isAccessible: false });
  const fresh = await Report.create({ booking: b._id, test: testA._id, file: { uri: 'reports/new.pdf' } });
  await Report.updateOne({ _id: old._id }, { replacedBy: fresh._id });
  await Booking.updateOne({ _id: b._id }, { reports: [{ test: testA._id, report: fresh._id }] });
  const rows = (await get()).json().reports;
  assert.equal(rows.length, 1);
  assert.equal(rows[0]._id, fresh._id.toString());
});

test('requires auth', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/me/reports' });
  assert.equal(res.statusCode, 401);
});
