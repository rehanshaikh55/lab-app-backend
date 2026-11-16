import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// Keys are read when the module loads: real (test-mode) keys, separate webhook secret.
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret';

const { handleRazorpayWebhook } = await import('../services/paymentService.js');

const rawBody = JSON.stringify({ event: 'noop' });
const sign = (secret) => crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const call = (signature) => handleRazorpayWebhook({ rawBody, signature, payload: { event: 'noop' } });
const isSignatureError = (e) => /SIGNATURE/i.test(String(e.code || e.type || e.message));

test('webhook signed with the webhook secret is accepted', async () => {
  await assert.doesNotReject(call(sign('webhook-secret')));
});

test('webhook signed with the key secret is rejected', async () => {
  await assert.rejects(call(sign('key-secret')), isSignatureError);
});

test('short or missing signature is rejected as invalid, not a crash', async () => {
  await assert.rejects(call('abc'), isSignatureError);
  await assert.rejects(call(undefined), isSignatureError);
});
