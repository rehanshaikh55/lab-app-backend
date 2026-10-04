import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import BookingEvent from '../models/bookingEvent.js';
import LabAssistant from '../models/labAssistant.js';
import bcrypt from 'bcryptjs';

let app, lab, testDoc;
let custToken, cust2Token, ownerToken, assistantToken;
let assistantDoc;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};

const futureThursday = '2026-06-04'; // a Thursday

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}),
    Booking.deleteMany({}), BookingEvent.deleteMany({}), LabAssistant.deleteMany({}),
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

  await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  await User.create({ name:'Cust2', email:'c2@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const assistantUser = await User.create({ name:'Assist', email:'a@x.com', roles:['LAB_ASSISTANT'], passwordHash: await bcrypt.hash('pass123',12) });
  assistantDoc = await LabAssistant.create({ user: assistantUser._id, lab: lab._id, name:'Assist', phone:'1234567890', isActive:true });

  const ownerLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'o@x.com', password:'pass123' } });
  ownerToken = ownerLogin.json().accessToken;
  const custLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  custToken = custLogin.json().accessToken;
  const cust2Login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c2@x.com', password:'pass123' } });
  cust2Token = cust2Login.json().accessToken;
  const assistantLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'a@x.com', password:'pass123' } });
  assistantToken = assistantLogin.json().accessToken;
});

const createConfirmedBooking = async (slotStart) => {
  const payload = { labId: lab._id.toString(), testIds:[testDoc._id.toString()], scheduledDate: futureThursday, slot:{ start: slotStart }, collectionType:'HOME' };
  const created = await app.inject({ method:'POST', url:'/api/bookings', headers:{ authorization:`Bearer ${custToken}` }, payload });
  assert.equal(created.statusCode, 201);
  const id = created.json().booking._id;
  const accept = await app.inject({ method:'POST', url:`/api/partner/bookings/${id}/accept`, headers:{ authorization:`Bearer ${ownerToken}` } });
  assert.equal(accept.statusCode, 200);
  return id;
};

const reassign = async (id) =>
  app.inject({
    method: 'POST', url: `/api/partner/bookings/${id}/reassign`,
    headers: { authorization: `Bearer ${ownerToken}` },
    payload: { assistantId: assistantDoc._id.toString() },
  });

test('reassignAssistant generates visitOtp, transitions CONFIRMED -> ASSISTANT_ASSIGNED, records a BookingEvent', async () => {
  const id = await createConfirmedBooking('10:00');
  const res = await reassign(id);
  assert.equal(res.statusCode, 200);
  const { booking } = res.json();
  assert.equal(booking.status, 'ASSISTANT_ASSIGNED');

  const dbBooking = await Booking.findById(id);
  assert.ok(dbBooking.visitOtp);
  assert.match(dbBooking.visitOtp, /^\d{4}$/);

  // One event from createConfirmedBooking's accept (PENDING -> CONFIRMED), one from reassign (CONFIRMED -> ASSISTANT_ASSIGNED).
  const events = await BookingEvent.find({ booking: id }).sort({ createdAt: 1 });
  assert.equal(events.length, 2);
  assert.equal(events[1].fromStatus, 'CONFIRMED');
  assert.equal(events[1].toStatus, 'ASSISTANT_ASSIGNED');
  assert.equal(events[1].actorType, 'LAB_OWNER');
});

test('assistant flow: start-journey -> arrived -> verify-otp (correct) walks ON_THE_WAY -> ARRIVED -> COLLECTED with LAB_ASSISTANT events', async () => {
  const id = await createConfirmedBooking('11:00');
  await reassign(id);
  const dbBooking = await Booking.findById(id);
  const otp = dbBooking.visitOtp;

  const start = await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/start-journey`, headers:{ authorization:`Bearer ${assistantToken}` } });
  assert.equal(start.statusCode, 200);
  assert.equal(start.json().booking.status, 'ON_THE_WAY');

  const arrived = await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/arrived`, headers:{ authorization:`Bearer ${assistantToken}` } });
  assert.equal(arrived.statusCode, 200);
  assert.equal(arrived.json().booking.status, 'ARRIVED');

  const verify = await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/verify-otp`, headers:{ authorization:`Bearer ${assistantToken}` }, payload:{ otp } });
  assert.equal(verify.statusCode, 200);
  assert.equal(verify.json().booking.status, 'COLLECTED');

  const events = await BookingEvent.find({ booking: id }).sort({ createdAt: 1 });
  // [0] CONFIRMED (accept, LAB_OWNER), [1] ASSISTANT_ASSIGNED (reassign, LAB_OWNER),
  // [2] ON_THE_WAY, [3] ARRIVED, [4] COLLECTED (all LAB_ASSISTANT)
  assert.equal(events.length, 5);
  const assistantEvents = events.slice(2);
  assert.deepEqual(assistantEvents.map(e => e.toStatus), ['ON_THE_WAY', 'ARRIVED', 'COLLECTED']);
  for (const e of assistantEvents) assert.equal(e.actorType, 'LAB_ASSISTANT');

  const finalBooking = await Booking.findById(id);
  assert.ok(finalBooking.visitOtpVerifiedAt);
});

test('verify-otp with wrong OTP returns 401 and does not change booking status', async () => {
  const id = await createConfirmedBooking('12:00');
  await reassign(id);
  await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/start-journey`, headers:{ authorization:`Bearer ${assistantToken}` } });
  await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/arrived`, headers:{ authorization:`Bearer ${assistantToken}` } });

  const verify = await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/verify-otp`, headers:{ authorization:`Bearer ${assistantToken}` }, payload:{ otp: '0000' } });
  assert.equal(verify.statusCode, 401);

  const dbBooking = await Booking.findById(id);
  assert.equal(dbBooking.status, 'ARRIVED');
  assert.equal(dbBooking.visitOtpVerifiedAt, null);
});

test('an assistant not assigned to a booking gets FORBIDDEN/BOOKING_NOT_FOUND on assistant-side endpoints', async () => {
  // Booking never reassigned -> booking.labAssistant stays null, so this assistant has no claim on it.
  const id = await createConfirmedBooking('13:00');
  const res = await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/start-journey`, headers:{ authorization:`Bearer ${assistantToken}` } });
  assert.equal(res.statusCode, 404);
  assert.equal(res.json().type, 'https://labzy.in/errors/BOOKING_NOT_FOUND');

  // A user with no LabAssistant record at all -> FORBIDDEN.
  await User.create({ name:'NoAssist', email:'na@x.com', roles:['LAB_ASSISTANT'], passwordHash: await bcrypt.hash('pass123',12) });
  const naLogin = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'na@x.com', password:'pass123' } });
  const naToken = naLogin.json().accessToken;
  const res2 = await app.inject({ method:'POST', url:`/api/assistant/bookings/${id}/start-journey`, headers:{ authorization:`Bearer ${naToken}` } });
  assert.equal(res2.statusCode, 403);
  assert.equal(res2.json().type, 'https://labzy.in/errors/FORBIDDEN');
});

test('POST /bookings/:id/visit-notes persists notes; GET /bookings/:id/visit-otp scoped to owning customer', async () => {
  const id = await createConfirmedBooking('14:00');
  await reassign(id);

  const notesRes = await app.inject({
    method: 'POST', url: `/api/bookings/${id}/visit-notes`,
    headers: { authorization: `Bearer ${custToken}` }, payload: { notes: 'gate code 4521' },
  });
  assert.equal(notesRes.statusCode, 200);
  assert.equal(notesRes.json().booking.visitNotes, 'gate code 4521');

  const dbBooking = await Booking.findById(id);
  assert.equal(dbBooking.visitNotes, 'gate code 4521');

  const otpRes = await app.inject({ method:'GET', url:`/api/bookings/${id}/visit-otp`, headers:{ authorization:`Bearer ${custToken}` } });
  assert.equal(otpRes.statusCode, 200);
  assert.equal(otpRes.json().otp, dbBooking.visitOtp);

  const otherRes = await app.inject({ method:'GET', url:`/api/bookings/${id}/visit-otp`, headers:{ authorization:`Bearer ${cust2Token}` } });
  assert.equal(otherRes.statusCode, 404);
  assert.equal(otherRes.json().type, 'https://labzy.in/errors/BOOKING_NOT_FOUND');
});

test('POST /bookings/:id/calls/connect returns a stub callId/virtualNumber and never calls out to a real provider', async () => {
  const id = await createConfirmedBooking('15:00');
  await reassign(id);

  const res = await app.inject({
    method: 'POST', url: `/api/bookings/${id}/calls/connect`,
    headers: { authorization: `Bearer ${custToken}` }, payload: { side: 'customer' },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.callId.startsWith('stub_'));
  assert.equal(body.virtualNumber, '+910000000000');
});
