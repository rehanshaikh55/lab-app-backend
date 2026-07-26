import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import BookingEvent from '../models/bookingEvent.js';
import SlotCapacity from '../models/slotCapacity.js';
import bcrypt from 'bcryptjs';
import { runLabResponseSlaSweep } from '../scheduler/jobs/labResponseSlaJob.js';
import { reserveSlot } from '../services/slotCapacityService.js';

let app, lab, testDoc, user;

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}),
    Booking.deleteMany({}), BookingEvent.deleteMany({}), SlotCapacity.deleteMany({}),
  ]);
  const owner = await User.create({ name:'Owner', email:'sla-owner@x.com', roles:['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123',12) });
  lab = await Lab.create({
    owner: owner._id, name:'SLA Lab',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:1 },
    isActive:true, isVerified:true,
  });
  user = await User.create({ name:'Cust', email:'sla-cust@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  testDoc = await Test.create({ lab: lab._id, name:'CBC', price:300, isActive:true });
});

const makePendingBooking = async ({ createdAtOffsetMinutes, slotStart, scheduledDate = '2026-09-10' }) => {
  await reserveSlot({ labId: lab._id, scheduledDate, slotStart, maxPerSlot: 1 });
  const booking = await Booking.create({
    user: user._id, lab: lab._id, tests: [testDoc._id],
    scheduledDate: new Date(scheduledDate), slot: { start: slotStart, end: '10:30' },
    collectionType: 'IN_LAB', patient: { name: 'Cust', isSelf: true },
    totalAmount: 300, status: 'PENDING', paymentMethod: 'ONLINE',
    slotHoldExpiry: new Date(Date.now() + 10 * 60 * 1000),
  });
  // Mongoose's timestamps plugin ignores an explicit `createdAt` passed to findByIdAndUpdate
  // (it only ever sets createdAt on insert), so backdate it via the raw driver instead.
  await Booking.collection.updateOne(
    { _id: booking._id },
    { $set: { createdAt: new Date(Date.now() + createdAtOffsetMinutes * 60 * 1000) } },
  );
  return { id: booking._id, scheduledDate, slotStart };
};

test('auto-cancels a PENDING booking older than the lab responseSlaMinutes, releases its slot, and records a SYSTEM event', async () => {
  await Lab.findByIdAndUpdate(lab._id, { 'policy.responseSlaMinutes': 30 });
  const { id, scheduledDate, slotStart } = await makePendingBooking({ createdAtOffsetMinutes: -70, slotStart: '10:00' });

  const cancelled = await runLabResponseSlaSweep({ now: new Date() });
  assert.equal(cancelled, 1);

  const booking = await Booking.findById(id);
  assert.equal(booking.status, 'CANCELLED');
  assert.equal(booking.cancelBy, 'SYSTEM');
  assert.match(booking.cancelReason, /SLA/);

  const events = await BookingEvent.find({ booking: id });
  assert.equal(events.length, 1);
  assert.equal(events[0].actorType, 'SYSTEM');
  assert.equal(events[0].reason, 'lab-response-sla');
  assert.equal(events[0].toStatus, 'CANCELLED');

  // Slot was released — a new booking can reserve the same slot afterward.
  await reserveSlot({ labId: lab._id, scheduledDate, slotStart, maxPerSlot: 1 });
});

test('leaves a PENDING booking younger than its SLA deadline untouched', async () => {
  // default responseSlaMinutes = 120; booking is 70 min old (passes the 1h query pre-filter
  // but its 120-min deadline hasn't arrived yet).
  const { id } = await makePendingBooking({ createdAtOffsetMinutes: -70, slotStart: '11:00' });

  const cancelled = await runLabResponseSlaSweep({ now: new Date() });
  assert.equal(cancelled, 0);

  const booking = await Booking.findById(id);
  assert.equal(booking.status, 'PENDING');
  assert.equal(await BookingEvent.countDocuments({ booking: id }), 0);
});

test('a fresh PENDING booking (younger than the 1h pre-filter) is never touched', async () => {
  const { id } = await makePendingBooking({ createdAtOffsetMinutes: -5, slotStart: '12:00' });

  const cancelled = await runLabResponseSlaSweep({ now: new Date() });
  assert.equal(cancelled, 0);

  const booking = await Booking.findById(id);
  assert.equal(booking.status, 'PENDING');
});
