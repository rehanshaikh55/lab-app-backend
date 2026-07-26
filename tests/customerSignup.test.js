import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import User from '../models/user.js';
import ConsentRecord from '../models/consentRecord.js';

let app;
before(async () => { app = await setupTestApp(); });
after(async () => { await teardownTestApp(app); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), ConsentRecord.deleteMany({})]); });

const fullConsent = [
  { kind: 'TOS',            given: true },
  { kind: 'PRIVACY',        given: true },
  { kind: 'HEALTH_RECORDS', given: true },
];

test('customer signup requires TOS+Privacy+HealthRecords consent', async () => {
  const partial = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Asha', email: 'a@x.com', password: 'pass1234',
      birthDate: '1990-01-01', consents: [{ kind: 'TOS', given: true }] },
  });
  assert.equal(partial.statusCode, 400);

  const ok = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Asha', email: 'a@x.com', password: 'pass1234',
      birthDate: '1990-01-01', consents: fullConsent },
  });
  assert.equal(ok.statusCode, 201);
  const body = ok.json();
  assert.ok(body.accessToken);
  assert.deepEqual(body.user.roles, ['CUSTOMER']);
  assert.equal((await ConsentRecord.countDocuments()), 3);
});

test('customer signup rejects users under 18', async () => {
  const minor = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Minor', email: 'm@x.com', password: 'pass1234',
      birthDate: '2020-01-01', consents: fullConsent },
  });
  assert.equal(minor.statusCode, 400);
  assert.match(minor.json().detail, /under 18/);
});

test('LAB_OWNER signup does not require consents', async () => {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { name: 'Owner', email: 'o@x.com', password: 'pass1234', role: 'LAB_OWNER' },
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json().user.roles, ['LAB_OWNER']);
});

test('POST /auth/consents persists additional consents post-signup', async () => {
  const reg = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { name: 'Ann', email: 'b@x.com', password: 'pass1234',
      birthDate: '1990-01-01', consents: fullConsent } });
  const token = reg.json().accessToken;
  const marketing = await app.inject({ method: 'POST', url: '/api/auth/consents',
    headers: { authorization: `Bearer ${token}` },
    payload: { consents: [{ kind: 'MARKETING', given: true }] } });
  assert.equal(marketing.statusCode, 200);
  assert.equal(marketing.json().recorded, 1);
});
