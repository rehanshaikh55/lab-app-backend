import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'https://app.example.test';
process.env.CORS_ORIGINS = ' https://landing.example.test, https://second.example.test ';
process.env.BREVO_API_KEY = 'test-key';
process.env.EMAIL_FROM = 'sender@example.test';
process.env.LEAD_ALERT_EMAIL = 'leads@example.test';

const { buildApp } = await import('../app.js');

const waitlist = { type: 'IOS_WAITLIST', phone: '9876543210', source: '/download' };
const partner = { type: 'LAB_PARTNER', name: 'Lab Owner', phone: '6789012345', source: '/for-labs', branches: '4+' };

async function setup(t) {
  const { default: Lead } = await import('../models/lead.js');
  const app = await buildApp({ withAdmin: false });
  t.after(() => app.close());
  const saved = [];
  const mail = t.mock.method(globalThis, 'fetch', async () => ({ ok: true }));
  t.mock.method(Lead.collection, 'insertOne', async (lead) => {
    saved.push(lead);
    return { acknowledged: true, insertedId: lead._id };
  });
  const submit = (payload, remoteAddress = '192.0.2.1', headers) =>
    app.inject({ method: 'POST', url: '/api/leads', payload, remoteAddress, headers });
  return { app, submit, saved, mail };
}

test('accepts both lead types, persists NEW status, and sends a Brevo alert', async (t) => {
  const { submit, saved, mail } = await setup(t);
  for (const lead of [waitlist, { ...partner, status: 'CLOSED' }]) {
    const response = await submit(lead);
    assert.equal(response.statusCode, 201, response.body);
    assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow, noarchive');
    assert.deepEqual(response.json(), { ok: true });
  }

  assert.equal(saved.length, 2);
  assert.equal(saved[0].name, undefined);
  assert.equal(saved[1].name, partner.name);
  assert.equal(saved[1].branches, '4+');
  assert.equal(saved[1].status, 'NEW');
  assert.ok(saved[1].createdAt instanceof Date);
  assert.ok(saved[1].updatedAt instanceof Date);
  assert.equal(mail.mock.callCount(), 2);
  const [url, options] = mail.mock.calls[1].arguments;
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(options.headers['api-key'], 'test-key');
  assert.deepEqual(JSON.parse(options.body).to, [{ email: 'leads@example.test' }]);
});

test('rejects invalid lead types, names, mobile numbers and email addresses', async (t) => {
  const { submit, saved, mail } = await setup(t);
  const invalid = [
    { ...waitlist, type: 'OTHER' },
    { ...partner, name: undefined },
    { ...partner, name: '   ' },
    { ...waitlist, phone: undefined },
    { ...partner, phone: '5876543210' },
    { ...waitlist, phone: '+919876543210' },
    { ...waitlist, email: 'invalid' },
  ];
  for (const [index, payload] of invalid.entries()) {
    const response = await submit(payload, `192.0.2.${index + 1}`);
    assert.equal(response.statusCode, 400, response.body);
  }
  assert.equal(saved.length, 0);
  assert.equal(mail.mock.callCount(), 0);
});

test('silently discards honeypot submissions', async (t) => {
  const { submit, saved, mail } = await setup(t);
  const response = await submit({ ...waitlist, honeypot: 'filled' });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json(), { ok: true });
  assert.equal(saved.length, 0);
  assert.equal(mail.mock.callCount(), 0);
});

test('succeeds and keeps the lead when Brevo rejects the alert', async (t) => {
  const { submit, saved, mail } = await setup(t);
  mail.mock.mockImplementation(async () => ({ ok: false, status: 503 }));
  const response = await submit(waitlist);
  assert.equal(response.statusCode, 201);
  assert.equal(saved.length, 1);
  assert.equal(mail.mock.callCount(), 1);
});

test('confirms a saved lead while its alert email is still pending', async (t) => {
  const { app, submit, saved, mail } = await setup(t);
  await app.ready();
  let finishMail;
  const pendingMail = new Promise(resolve => { finishMail = resolve; });
  mail.mock.mockImplementation(() => pendingMail);
  const submission = submit(waitlist);
  let timeout;
  try {
    const response = await Promise.race([
      submission,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Submission waited for the alert email')), 2000);
      }),
    ]);
    assert.equal(response.statusCode, 201);
    assert.equal(saved.length, 1);
    assert.equal(mail.mock.callCount(), 1);
  } finally {
    clearTimeout(timeout);
    finishMail({ ok: true });
    await submission;
  }
});

test('rate limits the sixth submission from the same IP for one hour', async (t) => {
  const { submit, saved } = await setup(t);
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await submit(waitlist);
    assert.equal(response.statusCode, 201);
  }
  const limited = await submit(waitlist);
  assert.equal(limited.statusCode, 429);
  assert.ok(Number(limited.headers['retry-after']) > 3500);
  assert.equal((await submit(waitlist, '192.0.2.2')).statusCode, 201);
  assert.equal(saved.length, 6);
});

test('uses the client IP appended by the proxy for rate limiting', async (t) => {
  const { submit } = await setup(t);
  const proxy = '192.0.2.1';
  for (let attempt = 1; attempt <= 6; attempt++) {
    const response = await submit(waitlist, proxy, {
      'x-forwarded-for': `203.0.113.${attempt}, 198.51.100.1`,
    });
    assert.equal(response.statusCode, attempt <= 5 ? 201 : 429);
  }
  assert.equal((await submit(waitlist, proxy, { 'x-forwarded-for': '198.51.100.2' })).statusCode, 201);
});

test('allows configured origins and omits CORS permission for other origins', async (t) => {
  const { app } = await setup(t);
  for (const origin of [
    process.env.FRONTEND_URL,
    'https://labzy.co.in',
    'https://www.labzy.co.in',
    'https://labzy-web.onrender.com',
    'https://landing.example.test',
    'https://second.example.test',
    'https://unlisted.example.test',
  ]) {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/leads',
      headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
    });
    if (origin === 'https://unlisted.example.test') {
      assert.equal(response.headers['access-control-allow-origin'], undefined);
    } else {
      assert.equal(response.statusCode, 204);
      assert.equal(response.headers['access-control-allow-origin'], origin);
      assert.match(response.headers['access-control-allow-methods'], /POST/);
    }
  }
});
