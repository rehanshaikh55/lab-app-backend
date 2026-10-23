import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import Coupon from '../models/coupon.js';
import { seedCoupons } from '../scripts/backfillPatientRedesign.js';
import bcrypt from 'bcryptjs';

let app, token, user, lab, t1, t2;

const openAllWeek = {
  monday:{open:'09:00',close:'18:00'}, tuesday:{open:'09:00',close:'18:00'},
  wednesday:{open:'09:00',close:'18:00'}, thursday:{open:'09:00',close:'18:00'},
  friday:{open:'09:00',close:'18:00'}, saturday:{open:'09:00',close:'18:00'},
  sunday:{open:'09:00',close:'18:00'},
};
const auth = () => ({ authorization: `Bearer ${token}` });
const evaluate = (code, amount) =>
  app.inject({ method: 'GET', url: `/api/coupons/${code}/evaluate?amount=${amount}`, headers: auth() });

before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Lab.deleteMany({}), Test.deleteMany({}), Booking.deleteMany({}), Coupon.deleteMany({})]);
  const owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123',12) });
  lab = await Lab.create({
    owner: owner._id, name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:5 },
    isActive:true, isVerified:true,
  });
  t1 = await Test.create({ lab: lab._id, name:'CBC', price:299, isActive:true });
  t2 = await Test.create({ lab: lab._id, name:'Lipid', price:549, isActive:true });
  user = await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  token = login.json().accessToken;
  await seedCoupons();
});

test('seedCoupons is idempotent', async () => {
  await seedCoupons();
  assert.equal(await Coupon.countDocuments({ code: 'LABZY50' }), 1);
});

test('LABZY50 caps at 200 and rounds half up', async () => {
  const a = await evaluate('LABZY50', 848);
  assert.equal(a.statusCode, 200);
  assert.deepEqual(a.json().coupon, { code: 'LABZY50', discount: 200, description: '50% off up to ₹200 on your first booking' });
  const b = await evaluate('labzy50', 299);
  assert.equal(b.json().coupon.discount, 150);
});

test('not first booking -> COUPON_INVALID; cancelled bookings do not count', async () => {
  const base = { user: user._id, lab: lab._id, tests: [t1._id], scheduledDate: new Date(), slot: { start: '10:00' }, collectionType: 'IN_LAB', totalAmount: 299 };
  await Booking.create({ ...base, status: 'CANCELLED' });
  assert.equal((await evaluate('LABZY50', 848)).statusCode, 200);
  await Booking.create({ ...base, status: 'CONFIRMED' });
  const res = await evaluate('LABZY50', 848);
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().type, 'https://labzy.in/errors/COUPON_INVALID');
  assert.equal(res.json().detail, 'LABZY50 is only for your first booking.');
});

test('unknown, expired, inactive and below-minimum coupons are rejected', async () => {
  const unknown = await evaluate('NOPE', 848);
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.json().detail, "We couldn't find that coupon. Check the code and try again.");

  await Coupon.updateOne({ code: 'LABZY50' }, { validUntil: new Date(Date.now() - 86400000) });
  const expired = await evaluate('LABZY50', 848);
  assert.equal(expired.statusCode, 400);
  assert.equal(expired.json().detail, 'This coupon has expired.');

  await Coupon.updateOne({ code: 'LABZY50' }, { validUntil: null, minOrder: 500 });
  const low = await evaluate('LABZY50', 299);
  assert.equal(low.statusCode, 400);
  assert.equal(low.json().detail, 'Add ₹201 more to use this coupon.');

  await Coupon.updateOne({ code: 'LABZY50' }, { minOrder: 0, isActive: false });
  assert.equal((await evaluate('LABZY50', 848)).statusCode, 400);
});

test('POST /bookings applies the coupon server-side', async () => {
  const res = await app.inject({ method:'POST', url:'/api/bookings', headers: auth(), payload: {
    labId: lab._id.toString(), testIds:[t1._id.toString(), t2._id.toString()],
    scheduledDate: '2026-06-04', slot:{ start:'10:00' }, collectionType:'IN_LAB', couponCode: 'labzy50',
  } });
  assert.equal(res.statusCode, 201);
  const b = res.json().booking;
  assert.equal(b.totalAmount, 648);
  assert.equal(b.discountAmount, 200);
  assert.equal(b.couponCode, 'LABZY50');
});

test('invalid coupon on POST /bookings does not hold a slot', async () => {
  const payload = {
    labId: lab._id.toString(), testIds:[t1._id.toString()],
    scheduledDate: '2026-06-04', slot:{ start:'11:00' }, collectionType:'IN_LAB', couponCode: 'NOPE',
  };
  const res = await app.inject({ method:'POST', url:'/api/bookings', headers: auth(), payload });
  assert.equal(res.statusCode, 400);
  assert.equal(await Booking.countDocuments({}), 0);
});
