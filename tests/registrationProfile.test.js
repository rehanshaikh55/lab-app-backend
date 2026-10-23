import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import { backfillRegistrationStep } from '../scripts/backfillPatientRedesign.js';

let app, token;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });

const fullConsent = [
  { kind: 'TOS', given: true },
  { kind: 'PRIVACY', given: true },
  { kind: 'HEALTH_RECORDS', given: true },
];

beforeEach(async () => {
  await User.deleteMany({});
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Asha', email: 'a@x.com', password: 'pass1234', birthDate: '1990-01-01', consents: fullConsent },
  });
  token = res.json().accessToken;
});

const auth = () => ({ authorization: `Bearer ${token}` });
const put = (payload) => app.inject({ method: 'PUT', url: '/api/profile', headers: auth(), payload });
const me = async () => (await app.inject({ method: 'GET', url: '/api/me', headers: auth() })).json();
const year = new Date().getFullYear();

test('new signup has registrationStep 0', async () => {
  const body = await me();
  assert.equal((body.user ?? body).registrationStep, 0);
});

test('PUT /profile stores health fields and derives birthDate from age', async () => {
  const res = await put({ age: 29, weight: 65.5, height: 165, bloodGroup: 'O+', registrationStep: 1 });
  assert.equal(res.statusCode, 200);
  const u = (await me()); const user = u.user ?? u;
  assert.equal(user.weight, 65.5);
  assert.equal(user.height, 165);
  assert.equal(user.bloodGroup, 'O+');
  assert.equal(user.registrationStep, 1);
  assert.equal(new Date(user.birthDate).getFullYear(), year - 29);
});

test('PUT /profile rejects invalid values', async () => {
  for (const payload of [
    { weight: 19 }, { height: 251 }, { bloodGroup: 'O++' }, { name: 'A' }, { name: 'Asha@' },
  ]) {
    const res = await put(payload);
    assert.equal(res.statusCode, 400, JSON.stringify(payload));
  }
});

test('registrationStep never decreases', async () => {
  assert.equal((await put({ registrationStep: 2 })).statusCode, 200);
  assert.equal((await put({ registrationStep: 1 })).statusCode, 200);
  const u = await me();
  assert.equal((u.user ?? u).registrationStep, 2);
});

test('POST /me/dependents accepts age and child relation', async () => {
  const res = await app.inject({
    method: 'POST', url: '/api/me/dependents', headers: auth(),
    payload: { name: 'Arjun Rao', relation: 'child', age: 0 },
  });
  assert.equal(res.statusCode, 201); // existing route convention (create)
  const deps = res.json().dependents ?? res.json();
  const dep = deps[deps.length - 1];
  assert.equal(dep.relation, 'child');
  assert.equal(new Date(dep.birthDate).getFullYear(), year);
});

test('backfillRegistrationStep sets 2 where missing', async () => {
  const { insertedId } = await User.collection.insertOne({ name: 'Old', email: 'old@x.com', roles: ['CUSTOMER'] });
  await backfillRegistrationStep();
  const raw = await User.collection.findOne({ _id: insertedId });
  assert.equal(raw.registrationStep, 2);
  const mine = await User.findOne({ email: 'a@x.com' });
  assert.equal(mine.registrationStep, 0);
});

test('legacy user (no registrationStep) logs in, reads as 2, and is not locked to 0 by save()', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('pass1234', 4);
  const { insertedId } = await User.collection.insertOne({
    name: 'Old Timer', email: 'legacy@x.com', passwordHash, roles: ['CUSTOMER'],
  });
  const login = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { email: 'legacy@x.com', password: 'pass1234' },
  });
  assert.equal(login.statusCode, 200);
  assert.equal(login.json().user.registrationStep, 2);
  const res = await app.inject({
    method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${login.json().accessToken}` },
  });
  assert.equal(res.json().user.registrationStep, 2);
  const raw = await User.collection.findOne({ _id: insertedId });
  assert.equal(raw.registrationStep, undefined); // login save() must not persist a default
  await backfillRegistrationStep();
  assert.equal((await User.collection.findOne({ _id: insertedId })).registrationStep, 2);
});

test('signup response user reports registrationStep 0', async () => {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Bina', email: 'b@x.com', password: 'pass1234', birthDate: '1990-01-01', consents: fullConsent },
  });
  assert.equal(res.json().user.registrationStep, 0);
});
