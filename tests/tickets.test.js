import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import Ticket from '../models/ticket.js';
import bcrypt from 'bcryptjs';

let app, token, otherToken, userId, otherUserId, lab, testDoc;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}), Booking.deleteMany({}), Ticket.deleteMany({})]);
  const owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123',12) });
  lab = await Lab.create({
    owner: owner._id, name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:5 },
    isActive:true, isVerified:true,
  });
  testDoc = await Test.create({ lab: lab._id, name:'CBC', price:300, isActive:true });

  const user = await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  userId = user._id;
  const other = await User.create({ name:'Other', email:'d@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  otherUserId = other._id;

  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  token = login.json().accessToken;
  const otherLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'d@x.com', password:'pass123' } });
  otherToken = otherLogin.json().accessToken;
});

test('creating a ticket with category REFUND auto-sets priority HIGH; DELAY gets NORMAL', async () => {
  const refund = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'REFUND', subject: 'Refund please', message: 'I want a refund' },
  });
  assert.equal(refund.statusCode, 201);
  assert.equal(refund.json().ticket.priority, 'HIGH');
  assert.equal(refund.json().ticket.messages.length, 1);
  assert.equal(refund.json().ticket.messages[0].fromRole, 'CUSTOMER');

  const delay = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'DELAY', subject: 'Late arrival' },
  });
  assert.equal(delay.statusCode, 201);
  assert.equal(delay.json().ticket.priority, 'NORMAL');
});

test('creating a ticket with a bookingId belonging to another user throws NOT_FOUND (404)', async () => {
  const booking = await Booking.create({
    user: otherUserId, lab: lab._id, tests: [testDoc._id],
    scheduledDate: new Date('2026-06-04'), slot: { start: '10:00', end: '10:30' },
    collectionType: 'IN_LAB', totalAmount: 300, status: 'PENDING',
  });

  const res = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'DELAY', subject: 'Not my booking', bookingId: booking._id.toString() },
  });
  assert.equal(res.statusCode, 404);
});

test('POST /tickets/:id/messages appends a message and flips OPEN -> IN_PROGRESS', async () => {
  const create = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'OTHER', subject: 'A question' },
  });
  const id = create.json().ticket._id;
  assert.equal(create.json().ticket.state, 'OPEN');

  const res = await app.inject({
    method: 'POST', url: `/api/tickets/${id}/messages`, headers: { authorization: `Bearer ${token}` },
    payload: { text: 'Any update?' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ticket.state, 'IN_PROGRESS');
  assert.equal(res.json().ticket.messages.length, 1);
  assert.equal(res.json().ticket.messages[0].text, 'Any update?');
});

test('POST /tickets/:id/reopen succeeds within the 7-day window and fails past it', async () => {
  const create = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'OTHER', subject: 'Resolved one' },
  });
  const id = create.json().ticket._id;

  await Ticket.findByIdAndUpdate(id, { state: 'RESOLVED', resolvedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) });
  const recent = await app.inject({
    method: 'POST', url: `/api/tickets/${id}/reopen`, headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(recent.statusCode, 200);
  assert.equal(recent.json().ticket.state, 'OPEN');

  await Ticket.findByIdAndUpdate(id, { state: 'RESOLVED', resolvedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000) });
  const expired = await app.inject({
    method: 'POST', url: `/api/tickets/${id}/reopen`, headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(expired.statusCode, 400);
  assert.equal(expired.json().type, 'https://labzy.in/errors/VALIDATION_ERROR');
});

test('POST /tickets/:id/reopen on a non-RESOLVED ticket throws VALIDATION_ERROR (400)', async () => {
  const create = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'OTHER', subject: 'Still open' },
  });
  const id = create.json().ticket._id;

  const res = await app.inject({
    method: 'POST', url: `/api/tickets/${id}/reopen`, headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().type, 'https://labzy.in/errors/VALIDATION_ERROR');
});

test('GET /tickets only returns the authenticated user\'s own tickets and state filter works', async () => {
  await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'OTHER', subject: 'Mine 1' },
  });
  const mine2 = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'OTHER', subject: 'Mine 2' },
  });
  await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${otherToken}` },
    payload: { category: 'OTHER', subject: 'Theirs' },
  });

  const mineId = mine2.json().ticket._id;
  await Ticket.findByIdAndUpdate(mineId, { state: 'RESOLVED', resolvedAt: new Date() });

  const list = await app.inject({ method: 'GET', url: '/api/tickets', headers: { authorization: `Bearer ${token}` } });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().tickets.length, 2);
  assert.ok(list.json().tickets.every((t) => t.subject !== 'Theirs'));

  const otherList = await app.inject({ method: 'GET', url: '/api/tickets', headers: { authorization: `Bearer ${otherToken}` } });
  assert.equal(otherList.json().tickets.length, 1);
  assert.equal(otherList.json().tickets[0].subject, 'Theirs');

  const filtered = await app.inject({ method: 'GET', url: '/api/tickets?state=RESOLVED', headers: { authorization: `Bearer ${token}` } });
  assert.equal(filtered.statusCode, 200);
  assert.equal(filtered.json().tickets.length, 1);
  assert.equal(filtered.json().tickets[0].subject, 'Mine 2');
});

test('a user cannot GET /tickets/:id for another user\'s ticket (NOT_FOUND, 404)', async () => {
  const create = await app.inject({
    method: 'POST', url: '/api/tickets', headers: { authorization: `Bearer ${token}` },
    payload: { category: 'OTHER', subject: 'Private' },
  });
  const id = create.json().ticket._id;

  const res = await app.inject({
    method: 'GET', url: `/api/tickets/${id}`, headers: { authorization: `Bearer ${otherToken}` },
  });
  assert.equal(res.statusCode, 404);
});
