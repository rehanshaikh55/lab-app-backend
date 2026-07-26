import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import Transaction from '../models/transaction.js';
import Invoice from '../models/invoice.js';
import Refund from '../models/refund.js';
import BookingEvent from '../models/bookingEvent.js';
import bcrypt from 'bcryptjs';

let app, token, lab, testDoc, testDoc2, user;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}), Booking.deleteMany({}),
    Transaction.deleteMany({}), Invoice.deleteMany({}), Refund.deleteMany({}), BookingEvent.deleteMany({}),
  ]);
  const owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123',12) });
  lab = await Lab.create({
    owner: owner._id, name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:1 },
    isActive:true, isVerified:true,
  });
  testDoc = await Test.create({ lab: lab._id, name:'CBC', price:300, isActive:true });
  testDoc2 = await Test.create({ lab: lab._id, name:'Lipid Panel', price:500, isActive:true });
  user = await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  token = login.json().accessToken;
});

const futureThursday = '2026-06-04'; // a Thursday, matches convention used by tests/booking.test.js

const capturedPayload = (orderId, paymentId) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { order_id: orderId, id: paymentId } } },
});

const createBooking = async (authToken, { testIds, slotStart }) => {
  const payload = {
    labId: lab._id.toString(), testIds, scheduledDate: futureThursday,
    slot: { start: slotStart }, collectionType: 'IN_LAB',
  };
  const res = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${authToken}` }, payload });
  assert.equal(res.statusCode, 201);
  return res.json().booking;
};

const payAndCapture = async (bookingId, authToken) => {
  const intent = await app.inject({
    method:'POST', url:`/api/bookings/${bookingId}/payment-intent`, headers:{ authorization:`Bearer ${authToken}` },
  });
  assert.equal(intent.statusCode, 200);
  const { transactionId, providerOrderId } = intent.json();
  const webhook = await app.inject({
    method:'POST', url:'/api/payments/webhook', payload: capturedPayload(providerOrderId, `pay_${transactionId}`),
  });
  assert.equal(webhook.statusCode, 200);
  return { transactionId, providerOrderId };
};

test('payment.captured webhook creates an Invoice with lines/total matching the booking tests', async () => {
  const booking = await createBooking(token, { testIds: [testDoc._id.toString(), testDoc2._id.toString()], slotStart: '10:00' });
  const { transactionId } = await payAndCapture(booking._id, token);

  const invoice = await Invoice.findOne({ transaction: transactionId });
  assert.ok(invoice, 'invoice should be created');
  assert.equal(invoice.lines.length, 2);
  const total = testDoc.price + testDoc2.price;
  assert.equal(invoice.subtotal, total);
  assert.equal(invoice.total, total);
  assert.ok(invoice.pdfUri === null || typeof invoice.pdfUri === 'string');

  const reloadedBooking = await Booking.findById(booking._id);
  assert.equal(reloadedBooking.status, 'CONFIRMED');
});

test('a second payment.captured webhook on the same booking (double charge) creates a Refund instead of a second invoice', async () => {
  const booking = await createBooking(token, { testIds: [testDoc._id.toString()], slotStart: '10:30' });
  const { transactionId: tx1Id } = await payAndCapture(booking._id, token);

  const tx2 = await Transaction.create({
    user: user._id, booking: booking._id, amount: booking.totalAmount,
    provider: 'RAZORPAY', providerOrderId: 'order_dup_1', status: 'CREATED',
  });
  const webhook2 = await app.inject({
    method:'POST', url:'/api/payments/webhook', payload: capturedPayload('order_dup_1', 'pay_dup_1'),
  });
  assert.equal(webhook2.statusCode, 200);

  const refund = await Refund.findOne({ transaction: tx2._id });
  assert.ok(refund, 'a refund should be created for the duplicate payment');
  assert.equal(refund.reason, 'duplicate payment');
  assert.equal(refund.amount, booking.totalAmount);

  const invoiceCount = await Invoice.countDocuments({ booking: booking._id });
  assert.equal(invoiceCount, 1, 'no second invoice should be created for the duplicate payment');

  // sanity: the first transaction's invoice still references tx1
  const invoice = await Invoice.findOne({ booking: booking._id });
  assert.equal(invoice.transaction.toString(), tx1Id);
});

test('GET /me/payments returns invoices/transactions/refunds scoped to the authenticated user only', async () => {
  const booking1 = await createBooking(token, { testIds: [testDoc._id.toString()], slotStart: '11:00' });
  await payAndCapture(booking1._id, token);

  await User.create({ name:'Other', email:'other@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const otherLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'other@x.com', password:'pass123' } });
  const otherToken = otherLogin.json().accessToken;
  const booking2 = await createBooking(otherToken, { testIds: [testDoc2._id.toString()], slotStart: '11:30' });
  await payAndCapture(booking2._id, otherToken);

  const res = await app.inject({ method:'GET', url:'/api/me/payments', headers:{ authorization:`Bearer ${token}` } });
  assert.equal(res.statusCode, 200);
  const { invoices, transactions } = res.json();
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].booking, booking1._id.toString());
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].booking, booking1._id.toString());
});

test('GET /invoices/:id returns 404 for another user\'s invoice', async () => {
  const booking = await createBooking(token, { testIds: [testDoc._id.toString()], slotStart: '12:00' });
  const { transactionId } = await payAndCapture(booking._id, token);
  const invoice = await Invoice.findOne({ transaction: transactionId });

  await User.create({ name:'Other', email:'other2@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const otherLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'other2@x.com', password:'pass123' } });
  const otherToken = otherLogin.json().accessToken;

  const res = await app.inject({ method:'GET', url:`/api/invoices/${invoice._id}`, headers:{ authorization:`Bearer ${otherToken}` } });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().type, 'https://labzy.in/errors/NOT_FOUND');
});

test('POST /bookings/:id/refund without testIds refunds the full captured amount', async () => {
  const booking = await createBooking(token, { testIds: [testDoc._id.toString(), testDoc2._id.toString()], slotStart: '13:00' });
  await payAndCapture(booking._id, token);

  const res = await app.inject({
    method:'POST', url:`/api/bookings/${booking._id}/refund`, headers:{ authorization:`Bearer ${token}` }, payload:{},
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().refund.amount, booking.totalAmount);
  assert.equal(res.json().refund.state, 'INITIATED');
});

test('POST /bookings/:id/refund with testIds refunds only the sum of those tests\' prices', async () => {
  const booking = await createBooking(token, { testIds: [testDoc._id.toString(), testDoc2._id.toString()], slotStart: '13:30' });
  await payAndCapture(booking._id, token);

  const res = await app.inject({
    method:'POST', url:`/api/bookings/${booking._id}/refund`, headers:{ authorization:`Bearer ${token}` },
    payload: { testIds: [testDoc._id.toString()] },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().refund.amount, testDoc.price);
});

test('requesting a refund exceeding the remaining refundable balance throws VALIDATION_ERROR (400) on the second call', async () => {
  const booking = await createBooking(token, { testIds: [testDoc._id.toString()], slotStart: '14:00' });
  await payAndCapture(booking._id, token);

  const first = await app.inject({
    method:'POST', url:`/api/bookings/${booking._id}/refund`, headers:{ authorization:`Bearer ${token}` }, payload:{},
  });
  assert.equal(first.statusCode, 201);

  const second = await app.inject({
    method:'POST', url:`/api/bookings/${booking._id}/refund`, headers:{ authorization:`Bearer ${token}` }, payload:{},
  });
  assert.equal(second.statusCode, 400);
  assert.equal(second.json().type, 'https://labzy.in/errors/VALIDATION_ERROR');
});

test('POST /bookings/:id/refund on someone else\'s booking throws BOOKING_NOT_FOUND (404)', async () => {
  const booking = await createBooking(token, { testIds: [testDoc._id.toString()], slotStart: '14:30' });
  await payAndCapture(booking._id, token);

  await User.create({ name:'Other', email:'other3@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const otherLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'other3@x.com', password:'pass123' } });
  const otherToken = otherLogin.json().accessToken;

  const res = await app.inject({
    method:'POST', url:`/api/bookings/${booking._id}/refund`, headers:{ authorization:`Bearer ${otherToken}` }, payload:{},
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().type, 'https://labzy.in/errors/BOOKING_NOT_FOUND');
});
