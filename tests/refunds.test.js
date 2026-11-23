import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// Live mode: real-looking keys, Razorpay replaced by a fake client below.
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret';

const { setupTestApp, teardownTestApp } = await import('./helpers/buildApp.js');
const { default: User } = await import('../models/user.js');
const { default: Lab } = await import('../models/lab.js');
const { default: Booking } = await import('../models/booking.js');
const { default: Transaction } = await import('../models/transaction.js');
const { default: Refund } = await import('../models/refund.js');
const { setRazorpayClientForTests } = await import('../services/_shared/razorpay.js');
const { issueRefund } = await import('../services/refundService.js');
const { cancelBooking } = await import('../services/bookingService.js');
const { rejectBooking } = await import('../services/partnerService.js');
const { handleRazorpayWebhook } = await import('../services/paymentService.js');

let app, owner, customer, lab, calls, failNext;

const fakeRazorpay = {
  payments: {
    refund: async (paymentId, opts) => {
      calls.push({ paymentId, ...opts });
      if (failNext) { failNext = false; throw { error: { description: 'Insufficient balance' } }; }
      return { id: `rfnd_${calls.length}`, status: 'processed' };
    },
  },
};

before(async () => { app = await setupTestApp(); setRazorpayClientForTests(fakeRazorpay); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  calls = []; failNext = false;
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Booking.deleteMany({}),
    Transaction.deleteMany({}), Refund.deleteMany({})]);
  owner = await User.create({ name: 'Owner', email: 'o@x.com', roles: ['LAB_OWNER'] });
  customer = await User.create({ name: 'Cust', email: 'c@x.com', roles: ['CUSTOMER'] });
  lab = await Lab.create({
    owner: owner._id, name: 'Lab A', location: { type: 'Point', coordinates: [72.5, 23.0] },
    isActive: true, isVerified: true,
    policy: { cancellationFee: 100, cancellationCutoffHours: 4 },
  });
});

// A booking paid online for ₹600, its slot `hoursAhead` from now (IST wall clock).
const paidBooking = async ({ status = 'CONFIRMED', hoursAhead = 48 } = {}) => {
  const at = new Date(Date.now() + hoursAhead * 3600 * 1000 + 330 * 60 * 1000); // shift to IST
  const pad = (n) => String(n).padStart(2, '0');
  const booking = await Booking.create({
    user: customer._id, lab: lab._id, tests: [], collectionType: 'IN_LAB', totalAmount: 600,
    scheduledDate: new Date(`${at.toISOString().slice(0, 10)}T00:00:00Z`),
    slot: { start: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}` }, status,
  });
  const tx = await Transaction.create({
    user: customer._id, booking: booking._id, amount: 600, providerOrderId: `order_${booking._id}`,
    providerPaymentId: `pay_${booking._id}`, status: 'CAPTURED',
  });
  return { booking, tx };
};

test('issueRefund sends paise, payment id and receipt to Razorpay and marks the payment refunded', async () => {
  const { tx } = await paidBooking();
  const refund = await issueRefund({ transactionId: tx._id, amount: 600, reason: 'test' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].paymentId, tx.providerPaymentId);
  assert.equal(calls[0].amount, 60000);
  assert.equal(calls[0].receipt, refund._id.toString());
  assert.equal(refund.providerRefundId, 'rfnd_1');
  assert.equal(refund.state, 'PROCESSED');
  assert.equal((await Transaction.findById(tx._id)).status, 'REFUNDED');
});

test('a Razorpay error records a FAILED refund, keeps the payment captured and allows a retry', async () => {
  const { tx } = await paidBooking();
  failNext = true;
  await assert.rejects(issueRefund({ transactionId: tx._id, amount: 600 }), /PAYMENT_FAILED|Refund failed/);

  const failed = await Refund.findOne({ transaction: tx._id });
  assert.equal(failed.state, 'FAILED');
  assert.equal(failed.failureReason, 'Insufficient balance');
  assert.equal((await Transaction.findById(tx._id)).status, 'CAPTURED');

  const retry = await issueRefund({ transactionId: tx._id, amount: 600 });
  assert.equal(retry.state, 'PROCESSED');
});

test('customer cancel well before the slot refunds the full amount', async () => {
  const { booking } = await paidBooking({ hoursAhead: 48 });
  await cancelBooking({ user: customer, bookingId: booking._id });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, 60000);
});

test('customer cancel inside the cutoff keeps the lab cancellation fee', async () => {
  const { booking } = await paidBooking({ hoursAhead: 2 });
  await cancelBooking({ user: customer, bookingId: booking._id });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, 50000); // ₹600 - ₹100 fee
});

test('customer cannot cancel after the sample is collected and nothing is refunded', async () => {
  const { booking } = await paidBooking({ status: 'COLLECTED' });
  await assert.rejects(cancelBooking({ user: customer, bookingId: booking._id }), /collected/);
  assert.equal(calls.length, 0);
  assert.equal((await Booking.findById(booking._id)).status, 'COLLECTED');
});

test('a booking without an online payment cancels without calling Razorpay', async () => {
  const { booking, tx } = await paidBooking();
  await Transaction.deleteOne({ _id: tx._id });
  await cancelBooking({ user: customer, bookingId: booking._id });
  assert.equal(calls.length, 0);
});

test('cancellation still succeeds when the refund fails, leaving a FAILED refund to retry', async () => {
  const { booking } = await paidBooking();
  failNext = true;
  await cancelBooking({ user: customer, bookingId: booking._id });
  assert.equal((await Booking.findById(booking._id)).status, 'CANCELLED');
  assert.equal((await Refund.findOne({ booking: booking._id })).state, 'FAILED');
});

test('lab rejection refunds the full amount, even inside the cutoff', async () => {
  const { booking } = await paidBooking({ hoursAhead: 1 });
  await rejectBooking({ userId: owner._id, bookingId: booking._id, reason: 'No reagent' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, 60000);
});

const signedWebhook = (payload) => {
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex');
  return handleRazorpayWebhook({ rawBody, signature, payload });
};

test('a payment captured for an already-cancelled booking is refunded', async () => {
  const { booking, tx } = await paidBooking({ status: 'CANCELLED' });
  await Transaction.updateOne({ _id: tx._id }, { status: 'CREATED' });
  await signedWebhook({
    event: 'payment.captured',
    payload: { payment: { entity: { order_id: tx.providerOrderId, id: tx.providerPaymentId } } },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].amount, 60000);
  assert.equal((await Booking.findById(booking._id)).status, 'CANCELLED');
});

test('refund.failed webhook marks the refund FAILED and the payment captured again', async () => {
  const { tx } = await paidBooking();
  const refund = await issueRefund({ transactionId: tx._id, amount: 600 });
  await signedWebhook({
    event: 'refund.failed',
    payload: { refund: { entity: { id: refund.providerRefundId, error_description: 'Bank rejected' } } },
  });
  const reloaded = await Refund.findById(refund._id);
  assert.equal(reloaded.state, 'FAILED');
  assert.equal(reloaded.failureReason, 'Bank rejected');
  assert.equal((await Transaction.findById(tx._id)).status, 'CAPTURED');
});
