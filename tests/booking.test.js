import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import BookingEvent from '../models/bookingEvent.js';
import bcrypt from 'bcryptjs';

let app, token, ownerToken, lab, testDoc;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}), BookingEvent.deleteMany({})]);
  const owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123',12) });
  lab = await Lab.create({
    owner: owner._id, name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:1 },
    isActive:true, isVerified:true,
  });
  testDoc = await Test.create({ lab: lab._id, name:'CBC', price:300, isActive:true });
  await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  token = login.json().accessToken;
  const ownerLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'o@x.com', password:'pass123' } });
  ownerToken = ownerLogin.json().accessToken;
});

const futureThursday = '2026-06-04'; // a Thursday

test('creates a booking (201) and rejects a second at a capacity-1 slot (409)', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'10:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(a.statusCode, 201);
  const b = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(b.statusCode, 409);
  assert.equal(b.json().type, 'https://labzy.in/errors/SLOT_UNAVAILABLE');
});

test('cancel releases the slot', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'12:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = a.json().booking._id;
  const cancel = await app.inject({ method:'POST', url:`/api/bookings/${id}/cancel`, headers:{ authorization:`Bearer ${token}` }, payload:{} });
  assert.equal(cancel.statusCode, 200);
  const again = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(again.statusCode, 201);
});

test('cancelling a booking records a BookingEvent (CUSTOMER -> CANCELLED)', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'13:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = a.json().booking._id;
  const cancel = await app.inject({ method:'POST', url:`/api/bookings/${id}/cancel`, headers:{ authorization:`Bearer ${token}` }, payload:{ reason:'changed my mind' } });
  assert.equal(cancel.statusCode, 200);

  const events = await BookingEvent.find({ booking: id });
  assert.equal(events.length, 1);
  assert.equal(events[0].fromStatus, 'PENDING');
  assert.equal(events[0].toStatus, 'CANCELLED');
  assert.equal(events[0].actorType, 'CUSTOMER');
  assert.equal(events[0].reason, 'changed my mind');
});

test('lab accepting a booking records a BookingEvent (LAB_OWNER -> CONFIRMED)', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'14:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = a.json().booking._id;

  const accept = await app.inject({ method:'POST', url:`/api/partner/bookings/${id}/accept`, headers:{ authorization:`Bearer ${ownerToken}` } });
  assert.equal(accept.statusCode, 200);

  const events = await BookingEvent.find({ booking: id });
  assert.equal(events.length, 1);
  assert.equal(events[0].fromStatus, 'PENDING');
  assert.equal(events[0].toStatus, 'CONFIRMED');
  assert.equal(events[0].actorType, 'LAB_OWNER');
});

test('GET /bookings/:id/events returns accumulated events in chronological order', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'15:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = a.json().booking._id;

  await app.inject({ method:'POST', url:`/api/partner/bookings/${id}/accept`, headers:{ authorization:`Bearer ${ownerToken}` } });
  const reject = await app.inject({ method:'POST', url:`/api/partner/bookings/${id}/reject`, headers:{ authorization:`Bearer ${ownerToken}` }, payload:{} });
  // acceptBooking moved status to CONFIRMED; rejecting again is an invalid transition (CONFIRMED -> CANCELLED is
  // actually valid per VALID_TRANSITIONS, so this second call succeeds and adds a second event).
  assert.equal(reject.statusCode, 200);

  const res = await app.inject({ method:'GET', url:`/api/bookings/${id}/events`, headers:{ authorization:`Bearer ${token}` } });
  assert.equal(res.statusCode, 200);
  const { events } = res.json();
  assert.equal(events.length, 2);
  assert.equal(events[0].toStatus, 'CONFIRMED');
  assert.equal(events[1].toStatus, 'CANCELLED');
  assert.ok(new Date(events[0].createdAt) <= new Date(events[1].createdAt));
});

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

test('HOME collectionType applies lab.policy.homeCollectionFee to totalAmount and stores it', async () => {
  await Lab.findByIdAndUpdate(lab._id, { 'policy.homeCollectionFee': 50, 'policy.homeCollectionWaiverAbove': 1000 });
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'09:00' }, collectionType:'HOME' };
  const res = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(res.statusCode, 201);
  const { booking } = res.json();
  assert.equal(booking.homeCollectionFee, 50);
  assert.equal(booking.totalAmount, testDoc.price + 50);
});

test('HOME collectionType fee is waived when cart total is at/above homeCollectionWaiverAbove', async () => {
  await Lab.findByIdAndUpdate(lab._id, { 'policy.homeCollectionFee': 50, 'policy.homeCollectionWaiverAbove': 100 });
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'09:30' }, collectionType:'HOME' };
  const res = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(res.statusCode, 201);
  const { booking } = res.json();
  assert.equal(booking.homeCollectionFee, 0);
  assert.equal(booking.totalAmount, testDoc.price);
});

test('new booking slotHoldExpiry is ~10 minutes out (not 15)', async () => {
  const before = Date.now();
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'17:00' }, collectionType:'IN_LAB' };
  const res = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(res.statusCode, 201);
  const { booking } = res.json();
  const delta = new Date(booking.slotHoldExpiry).getTime() - before;
  assert.ok(Math.abs(delta - 10 * 60 * 1000) < 5000, `expected ~10min hold, got ${delta}ms`);
});

test('rescheduleBooking more than the cutoff hours before the slot succeeds and increments rescheduleCount', async () => {
  const scheduledDate = fmtDate(daysFromNow(3));
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate, slot:{ start:'10:00' }, collectionType:'IN_LAB' };
  const created = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  assert.equal(created.statusCode, 201);
  const id = created.json().booking._id;

  const newDate = fmtDate(daysFromNow(4));
  const res = await app.inject({
    method:'POST', url:`/api/bookings/${id}/reschedule`, headers:{ authorization:`Bearer ${token}` },
    payload: { scheduledDate: newDate, slot:{ start:'11:00' } },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().booking.rescheduleCount, 1);
});

test('rescheduleBooking within the cutoff window throws RESCHEDULE_CUTOFF_PASSED (409)', async () => {
  const scheduledDate = fmtDate(daysFromNow(3));
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate, slot:{ start:'12:00' }, collectionType:'IN_LAB' };
  const created = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = created.json().booking._id;

  // Push the booking's own slot to just 1 hour from now (inside the default 4h cutoff).
  const Booking = (await import('../models/booking.js')).default;
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const hh = String(soon.getHours()).padStart(2, '0');
  const mm = String(soon.getMinutes()).padStart(2, '0');
  await Booking.findByIdAndUpdate(id, { scheduledDate: soon, slot: { start: `${hh}:${mm}`, end: `${hh}:${mm}` } });

  const res = await app.inject({
    method:'POST', url:`/api/bookings/${id}/reschedule`, headers:{ authorization:`Bearer ${token}` },
    payload: { scheduledDate: fmtDate(daysFromNow(5)), slot:{ start:'13:00' } },
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().type, 'https://labzy.in/errors/RESCHEDULE_CUTOFF_PASSED');
});

test('rescheduleBooking called more than maxReschedulesPerBooking times throws RESCHEDULE_LIMIT_REACHED (409)', async () => {
  const scheduledDate = fmtDate(daysFromNow(3));
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate, slot:{ start:'08:00' }, collectionType:'IN_LAB' };
  const created = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = created.json().booking._id;

  // default maxReschedulesPerBooking = 2 — first two succeed, third is rejected.
  const first = await app.inject({
    method:'POST', url:`/api/bookings/${id}/reschedule`, headers:{ authorization:`Bearer ${token}` },
    payload: { scheduledDate: fmtDate(daysFromNow(4)), slot:{ start:'08:30' } },
  });
  assert.equal(first.statusCode, 200);
  const second = await app.inject({
    method:'POST', url:`/api/bookings/${id}/reschedule`, headers:{ authorization:`Bearer ${token}` },
    payload: { scheduledDate: fmtDate(daysFromNow(5)), slot:{ start:'08:45' } },
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().booking.rescheduleCount, 2);

  const third = await app.inject({
    method:'POST', url:`/api/bookings/${id}/reschedule`, headers:{ authorization:`Bearer ${token}` },
    payload: { scheduledDate: fmtDate(daysFromNow(6)), slot:{ start:'09:15' } },
  });
  assert.equal(third.statusCode, 409);
  assert.equal(third.json().type, 'https://labzy.in/errors/RESCHEDULE_LIMIT_REACHED');
});

test('invalid transition still throws INVALID_BOOKING_TRANSITION (confirm an already-COMPLETED booking)', async () => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start:'16:00' }, collectionType:'IN_LAB' };
  const a = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${token}` }, payload });
  const id = a.json().booking._id;

  const Booking = (await import('../models/booking.js')).default;
  await Booking.findByIdAndUpdate(id, { status: 'COMPLETED' });

  const accept = await app.inject({ method:'POST', url:`/api/partner/bookings/${id}/accept`, headers:{ authorization:`Bearer ${ownerToken}` } });
  assert.equal(accept.statusCode, 409);
  assert.equal(accept.json().type, 'https://labzy.in/errors/INVALID_BOOKING_TRANSITION');

  const events = await BookingEvent.find({ booking: id });
  assert.equal(events.length, 0);
});
