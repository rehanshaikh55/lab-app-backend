import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Subscription from '../models/subscription.js';
import SubscriptionOccurrence from '../models/subscriptionOccurrence.js';
import Transaction from '../models/transaction.js';
import Booking from '../models/booking.js';

let app, token, lab, testDoc, user, runSubscriptionsJob;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};

before(async () => {
  app = await setupTestApp();
  // Dynamic import: scheduler/jobs/subscriptionsJob.js transitively imports
  // services/notificationService.js -> config/env.js, which reads JWT_SECRET from
  // process.env at module-evaluation time. A static top-level import would evaluate
  // that chain before setupTestApp() sets process.env.JWT_SECRET, permanently caching
  // JWT_SECRET as undefined for this process (ESM modules are evaluated once).
  ({ runSubscriptionsJob } = await import('../scheduler/jobs/subscriptionsJob.js'));
});
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}),
    Subscription.deleteMany({}), SubscriptionOccurrence.deleteMany({}),
    Transaction.deleteMany({}), Booking.deleteMany({}),
  ]);
  const owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123',12) });
  lab = await Lab.create({
    owner: owner._id, name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:5 },
    isActive:true, isVerified:true,
  });
  testDoc = await Test.create({ lab: lab._id, name:'CBC', price:300, isActive:true });
  user = await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  token = login.json().accessToken;
});

const createSub = async () => {
  const res = await app.inject({
    method:'POST', url:'/api/subscriptions',
    headers:{ authorization:`Bearer ${token}` },
    payload:{ labId: lab._id.toString(), testId: testDoc._id.toString(), frequency:'MONTHLY' },
  });
  assert.equal(res.statusCode, 201);
  return res.json().subscription;
};

// Forces the subscription to look "due soon" (1 day out, within the default 3-day
// preBookingReminderDays window) so the scheduler job will act on it this tick.
const forceDueSoon = async (subId, now) => {
  const nextBookingDate = new Date(now.getTime() + 24 * 3600 * 1000);
  await Subscription.findByIdAndUpdate(subId, { nextBookingDate });
  return nextBookingDate;
};

test('scheduler produces an AWAITING_APPROVAL occurrence for APPROVE_EACH_TIME subs, not an immediate booking', async () => {
  const sub = await createSub();
  assert.equal(sub.approvalMode, 'APPROVE_EACH_TIME'); // default
  const now = new Date();
  await forceDueSoon(sub._id, now);

  await runSubscriptionsJob({ now });

  const occ = await SubscriptionOccurrence.findOne({ subscription: sub._id });
  assert.ok(occ, 'expected an occurrence row to be created');
  assert.equal(occ.state, 'AWAITING_APPROVAL');
  assert.equal(await Booking.countDocuments({ subscription: sub._id }), 0);
});

test('POST /subscription-occurrences/:occId/approve books a slot and flips the occurrence to BOOKED', async () => {
  const sub = await createSub();
  const now = new Date();
  await forceDueSoon(sub._id, now);
  await runSubscriptionsJob({ now });
  const occ = await SubscriptionOccurrence.findOne({ subscription: sub._id, state: 'AWAITING_APPROVAL' });
  assert.ok(occ);

  const res = await app.inject({
    method: 'POST', url: `/api/subscription-occurrences/${occ._id}/approve`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().occurrence.state, 'BOOKED');
  assert.equal(await Booking.countDocuments({ subscription: sub._id }), 1);

  const reloaded = await SubscriptionOccurrence.findById(occ._id);
  assert.equal(reloaded.state, 'BOOKED');
  assert.ok(reloaded.booking);
});

test('POST /subscriptions/:id/skip-next creates a SKIPPED occurrence and advances nextBookingDate', async () => {
  const sub = await createSub();
  const before = await Subscription.findById(sub._id);

  const res = await app.inject({
    method: 'POST', url: `/api/subscriptions/${sub._id}/skip-next`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);

  const occ = await SubscriptionOccurrence.findOne({ subscription: sub._id, state: 'SKIPPED' });
  assert.ok(occ);
  const after = await Subscription.findById(sub._id);
  assert.ok(after.nextBookingDate.getTime() > before.nextBookingDate.getTime());
});

test('POST /subscriptions/:id/pause-until sets status to PAUSED and pauseUntil to the given date', async () => {
  const sub = await createSub();
  const until = '2026-08-01';

  const res = await app.inject({
    method: 'POST', url: `/api/subscriptions/${sub._id}/pause-until`,
    headers: { authorization: `Bearer ${token}` },
    payload: { until },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().subscription.status, 'PAUSED');
  assert.equal(new Date(res.json().subscription.pauseUntil).toISOString().slice(0, 10), until);
});

test('GET /subscriptions/:id/occurrences lists occurrence history for the owning user', async () => {
  const sub = await createSub();
  await app.inject({
    method: 'POST', url: `/api/subscriptions/${sub._id}/skip-next`,
    headers: { authorization: `Bearer ${token}` },
  });

  const res = await app.inject({
    method: 'GET', url: `/api/subscriptions/${sub._id}/occurrences`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().occurrences.length, 1);
  assert.equal(res.json().occurrences[0].state, 'SKIPPED');
});

test('two consecutive payment.failed webhook events pause the subscription', async () => {
  const sub = await createSub();
  await Transaction.create({ user: user._id, subscription: sub._id, amount: 300, provider: 'RAZORPAY', providerOrderId: 'order_fail_1', status: 'CREATED' });
  await Transaction.create({ user: user._id, subscription: sub._id, amount: 300, provider: 'RAZORPAY', providerOrderId: 'order_fail_2', status: 'CREATED' });

  const failedPayload = (orderId) => ({ event: 'payment.failed', payload: { payment: { entity: { order_id: orderId } } } });

  const r1 = await app.inject({ method: 'POST', url: '/api/payments/webhook', payload: failedPayload('order_fail_1') });
  assert.equal(r1.statusCode, 200);
  let reloaded = await Subscription.findById(sub._id);
  assert.equal(reloaded.consecutivePaymentFailures, 1);
  assert.equal(reloaded.status, 'ACTIVE');

  const r2 = await app.inject({ method: 'POST', url: '/api/payments/webhook', payload: failedPayload('order_fail_2') });
  assert.equal(r2.statusCode, 200);
  reloaded = await Subscription.findById(sub._id);
  assert.equal(reloaded.consecutivePaymentFailures, 2);
  assert.equal(reloaded.status, 'PAUSED');
});
