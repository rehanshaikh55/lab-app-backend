import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Keys are read when the module loads, so make sure they are unset (stub mode).
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_WEBHOOK_SECRET;

const { handleRazorpayWebhook } = await import('../services/paymentService.js');

const saved = {};
const KEYS = ['NODE_ENV', 'PAYMENTS_ALLOW_UNSIGNED_STUB_WEBHOOKS'];
beforeEach(() => { for (const k of KEYS) saved[k] = process.env[k]; });
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});

const call = () => handleRazorpayWebhook({ rawBody: '{}', signature: '', payload: { event: 'noop' } });

test('production + no webhook secret: unsigned webhook is rejected', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.PAYMENTS_ALLOW_UNSIGNED_STUB_WEBHOOKS;
  await assert.rejects(call(), (e) => e.statusCode === 400 || e.statusCode === 401 || /SIGNATURE/i.test(String(e.code || e.message)));
});

test('production + no secret + explicit opt-in flag: accepted', async () => {
  process.env.NODE_ENV = 'production';
  process.env.PAYMENTS_ALLOW_UNSIGNED_STUB_WEBHOOKS = 'true';
  await assert.doesNotReject(call());
});

test('non-production stub mode: accepted', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.PAYMENTS_ALLOW_UNSIGNED_STUB_WEBHOOKS;
  await assert.doesNotReject(call());
});
