import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import Report from '../models/report.js';

let app, token, ownerToken, otherOwnerToken, lab, testA, testB, customer;

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}),
    Booking.deleteMany({}), Report.deleteMany({}),
  ]);
  const owner = await User.create({ name: 'Owner', email: 'rv2-owner@x.com', roles: ['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123', 12) });
  const otherOwner = await User.create({ name: 'Other Owner', email: 'rv2-other-owner@x.com', roles: ['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123', 12) });
  await User.create({ name: 'Other Lab Owner Lab', email: 'rv2-other-owner-noop@x.com', roles: ['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123', 12) });
  await Lab.create({
    owner: otherOwner._id, name: 'Other Lab',
    location: { type: 'Point', coordinates: [77.6, 12.8] },
    slotMatrix: { duration: 30, intervalMinutes: 30, maxBookingsPerSlot: 5 },
    isActive: true, isVerified: true,
  });
  lab = await Lab.create({
    owner: owner._id, name: 'Lab A',
    location: { type: 'Point', coordinates: [77.5, 12.9] },
    slotMatrix: { duration: 30, intervalMinutes: 30, maxBookingsPerSlot: 5 },
    isActive: true, isVerified: true,
  });
  testA = await Test.create({ lab: lab._id, name: 'CBC', price: 300, isActive: true, turnaroundHours: 12 });
  testB = await Test.create({ lab: lab._id, name: 'Lipid Panel', price: 400, isActive: true, turnaroundHours: 24 });
  customer = await User.create({ name: 'Cust', email: 'rv2-cust@x.com', roles: ['CUSTOMER'], passwordHash: await bcrypt.hash('pass123', 12) });

  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rv2-cust@x.com', password: 'pass123' } });
  token = login.json().accessToken;
  const ownerLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rv2-owner@x.com', password: 'pass123' } });
  ownerToken = ownerLogin.json().accessToken;
  const otherOwnerLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rv2-other-owner@x.com', password: 'pass123' } });
  otherOwnerToken = otherOwnerLogin.json().accessToken;
});

const makeProcessingBooking = async (tests = [testA, testB]) => Booking.create({
  user: customer._id, lab: lab._id, tests: tests.map((t) => t._id),
  scheduledDate: new Date('2026-09-10'), slot: { start: '10:00', end: '10:30' },
  collectionType: 'IN_LAB', patient: { name: 'Cust', isSelf: true },
  totalAmount: tests.reduce((s, t) => s + t.price, 0), status: 'PROCESSING', paymentMethod: 'ONLINE',
});

test('linking a report for one of two tests keeps booking PROCESSING; linking the last flips it to COMPLETED', async () => {
  const booking = await makeProcessingBooking();

  const first = await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a.pdf', checksum: 'sumA', testId: testA._id.toString() },
  });
  assert.equal(first.statusCode, 201);

  let reloaded = await Booking.findById(booking._id);
  assert.equal(reloaded.status, 'PROCESSING');
  assert.equal(reloaded.reports.length, 1);

  const second = await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/b.pdf', checksum: 'sumB', testId: testB._id.toString() },
  });
  assert.equal(second.statusCode, 201);

  reloaded = await Booking.findById(booking._id);
  assert.equal(reloaded.status, 'COMPLETED');
  assert.equal(reloaded.reports.length, 2);
});

test('re-linking a report for a test that already has one replaces (not duplicates) that entry', async () => {
  const booking = await makeProcessingBooking();

  await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a-v1.pdf', checksum: 'sumA1', testId: testA._id.toString() },
  });
  const relink = await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a-v2.pdf', checksum: 'sumA2', testId: testA._id.toString() },
  });
  assert.equal(relink.statusCode, 201);

  const reloaded = await Booking.findById(booking._id);
  assert.equal(reloaded.reports.length, 1);
  assert.equal(reloaded.reports[0].test.toString(), testA._id.toString());
  assert.equal(reloaded.reports[0].report.toString(), relink.json().report._id.toString());
});

test('PUT replace-report without a reason is rejected (400)', async () => {
  const booking = await makeProcessingBooking([testA]);
  const link = await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a.pdf', checksum: 'sumA', testId: testA._id.toString() },
  });
  const reportId = link.json().report._id;

  const res = await app.inject({
    method: 'PUT', url: `/api/partner/bookings/${booking._id}/reports/${reportId}`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a-fixed.pdf', checksum: 'sumAfixed' },
  });
  assert.equal(res.statusCode, 400);
});

test('PUT replace-report with a valid reason creates a fresh accessible report and retires the old one', async () => {
  const booking = await makeProcessingBooking([testA]);
  const link = await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a.pdf', checksum: 'sumA', testId: testA._id.toString() },
  });
  const oldReportId = link.json().report._id;

  const res = await app.inject({
    method: 'PUT', url: `/api/partner/bookings/${booking._id}/reports/${oldReportId}`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a-fixed.pdf', checksum: 'sumAfixed', reason: 'Wrong patient name on report' },
  });
  assert.equal(res.statusCode, 200);
  const freshReportId = res.json().report._id;
  assert.notEqual(freshReportId, oldReportId);

  const oldReport = await Report.findById(oldReportId);
  assert.equal(oldReport.isAccessible, false);
  assert.ok(oldReport.replacedAt);
  assert.equal(oldReport.replacedBy.toString(), freshReportId);
  assert.equal(oldReport.replaceReason, 'Wrong patient name on report');

  const freshReport = await Report.findById(freshReportId);
  assert.equal(freshReport.isAccessible, true);

  const reloaded = await Booking.findById(booking._id);
  assert.equal(reloaded.reports.length, 1);
  assert.equal(reloaded.reports[0].report.toString(), freshReportId);
});

test('a lab owner who does not own the booking\'s lab cannot replace its report (404)', async () => {
  const booking = await makeProcessingBooking([testA]);
  const link = await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a.pdf', checksum: 'sumA', testId: testA._id.toString() },
  });
  const reportId = link.json().report._id;

  const res = await app.inject({
    method: 'PUT', url: `/api/partner/bookings/${booking._id}/reports/${reportId}`,
    headers: { authorization: `Bearer ${otherOwnerToken}` },
    payload: { uri: 'reports/a-fixed.pdf', checksum: 'sumAfixed', reason: 'not my booking' },
  });
  assert.equal(res.statusCode, 404);
});

test('GET /partner/tat-board returns only PROCESSING bookings for the requesting lab owner with expectedAt/dueSoon/overdue', async () => {
  const processing = await makeProcessingBooking();
  await Booking.create({
    user: customer._id, lab: lab._id, tests: [testA._id],
    scheduledDate: new Date('2026-09-10'), slot: { start: '11:00', end: '11:30' },
    collectionType: 'IN_LAB', patient: { name: 'Cust', isSelf: true },
    totalAmount: testA.price, status: 'COMPLETED', paymentMethod: 'ONLINE',
  });

  const res = await app.inject({
    method: 'GET', url: '/api/partner/tat-board',
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(res.statusCode, 200);
  const { items } = res.json();
  assert.equal(items.length, 1);
  assert.equal(items[0]._id, processing._id.toString());
  assert.ok('expectedAt' in items[0]);
  assert.ok('dueSoon' in items[0]);
  assert.ok('overdue' in items[0]);
});

test('GET /bookings/:id/report returns { reports: [...] }, excluding reports marked inaccessible by a replace', async () => {
  const booking = await makeProcessingBooking();
  const linkA = await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a.pdf', checksum: 'sumA', testId: testA._id.toString() },
  });
  await app.inject({
    method: 'POST', url: `/api/partner/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/b.pdf', checksum: 'sumB', testId: testB._id.toString() },
  });

  const before2 = await app.inject({
    method: 'GET', url: `/api/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(before2.statusCode, 200);
  assert.equal(before2.json().reports.length, 2);

  const oldReportId = linkA.json().report._id;
  await app.inject({
    method: 'PUT', url: `/api/partner/bookings/${booking._id}/reports/${oldReportId}`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { uri: 'reports/a-fixed.pdf', checksum: 'sumAfixed', reason: 'correction' },
  });

  const after2 = await app.inject({
    method: 'GET', url: `/api/bookings/${booking._id}/report`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(after2.statusCode, 200);
  assert.equal(after2.json().reports.length, 2);
  assert.ok(after2.json().reports.every((r) => r.signedUrl));
});
