import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Review from '../models/review.js';
import HealthPackage from '../models/healthPackage.js';
import bcrypt from 'bcryptjs';

let app, lab, owner, token;

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
    User.deleteMany({}),
    Lab.deleteMany({}),
    Test.deleteMany({}),
    Review.deleteMany({}),
    HealthPackage.deleteMany({}),
  ]);
  owner = await User.create({ name:'Owner', email:'o@x.com', roles:['LAB_OWNER'] });
  lab = await Lab.create({
    owner: owner._id,
    name:'Lab A',
    location:{ type:'Point', coordinates:[77.5,12.9] },
    openingHours: openAllWeek,
    slotMatrix:{ duration:30, intervalMinutes:30, maxBookingsPerSlot:5 },
    isActive:true,
    isVerified:true,
  });
  // Create a customer for testing
  await User.create({ name:'Cust', email:'c@x.com', roles:['CUSTOMER'], passwordHash: await bcrypt.hash('pass123',12) });
  const login = await app.inject({ method:'POST', url:'/api/auth/login', payload:{ email:'c@x.com', password:'pass123' } });
  token = login.json().accessToken;
});

test('GET /api/labs/:id returns ratingDistribution with correct counts', async () => {
  // Create some users for reviews
  const user1 = await User.create({ name:'User1', email:'u1@x.com', roles:['CUSTOMER'] });
  const user2 = await User.create({ name:'User2', email:'u2@x.com', roles:['CUSTOMER'] });
  const user3 = await User.create({ name:'User3', email:'u3@x.com', roles:['CUSTOMER'] });

  // Create reviews with different ratings
  await Review.create({ user: user1._id, lab: lab._id, rating: 5 });
  await Review.create({ user: user2._id, lab: lab._id, rating: 5 });
  await Review.create({ user: user3._id, lab: lab._id, rating: 4 });

  const res = await app.inject({
    method: 'GET',
    url: `/api/labs/${lab._id.toString()}`,
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(res.statusCode, 200);
  const { lab: result } = res.json();
  assert.ok(result.ratingDistribution);
  assert.equal(result.ratingDistribution[1], 0);
  assert.equal(result.ratingDistribution[2], 0);
  assert.equal(result.ratingDistribution[3], 0);
  assert.equal(result.ratingDistribution[4], 1);
  assert.equal(result.ratingDistribution[5], 2);
});

test('GET /packages includes savings calculated from test prices', async () => {
  // Create tests with specific prices
  const test1 = await Test.create({ lab: lab._id, name: 'Test1', price: 300, isActive: true });
  const test2 = await Test.create({ lab: lab._id, name: 'Test2', price: 400, isActive: true });

  // Create a health package with these tests at a discounted price
  const pkg = await HealthPackage.create({
    lab: lab._id,
    name: 'Package A',
    slug: 'package-a',
    tests: [test1._id, test2._id],
    price: 500,
    isActive: true,
  });

  const res = await app.inject({
    method: 'GET',
    url: '/api/packages',
  });

  assert.equal(res.statusCode, 200);
  const result = res.json();
  assert.ok(result.packages);
  assert.equal(result.packages.length, 1);
  const returnedPkg = result.packages[0];
  assert.equal(returnedPkg.sumOfTests, 700); // 300 + 400
  assert.equal(returnedPkg.savings, 200); // 700 - 500
});

test('GET /packages/:slug includes savings calculated from test prices', async () => {
  // Create tests with specific prices
  const test1 = await Test.create({ lab: lab._id, name: 'TestX', price: 250, isActive: true });
  const test2 = await Test.create({ lab: lab._id, name: 'TestY', price: 350, isActive: true });

  // Create a health package with these tests
  const pkg = await HealthPackage.create({
    lab: lab._id,
    name: 'Package B',
    slug: 'package-b',
    tests: [test1._id, test2._id],
    price: 450,
    isActive: true,
  });

  const res = await app.inject({
    method: 'GET',
    url: `/api/packages/${pkg.slug}`,
  });

  assert.equal(res.statusCode, 200);
  const result = res.json();
  assert.ok(result.package);
  const returnedPkg = result.package;
  assert.equal(returnedPkg.sumOfTests, 600); // 250 + 350
  assert.equal(returnedPkg.savings, 150); // 600 - 450
});

test('savings is zero when package price is greater than or equal to sum of tests', async () => {
  // Create tests
  const test1 = await Test.create({ lab: lab._id, name: 'TestM', price: 200, isActive: true });

  // Create a health package with higher price than tests
  const pkg = await HealthPackage.create({
    lab: lab._id,
    name: 'Package C',
    slug: 'package-c',
    tests: [test1._id],
    price: 300,
    isActive: true,
  });

  const res = await app.inject({
    method: 'GET',
    url: '/api/packages',
  });

  assert.equal(res.statusCode, 200);
  const result = res.json();
  const returnedPkg = result.packages[0];
  assert.equal(returnedPkg.sumOfTests, 200);
  assert.equal(returnedPkg.savings, 0); // Math.max(0, 200 - 300) = 0
});
