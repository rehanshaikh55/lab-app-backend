import crypto from 'crypto';
import Booking from '../models/booking.js';
import Transaction from '../models/transaction.js';
import Subscription from '../models/subscription.js';
import { Errors } from '../common/errors.js';
import { notifyBookingStatus, notify } from './notificationService.js';
import { generateInvoice } from './invoiceService.js';
import { issueRefund } from './refundService.js';
import { assertTransition } from './_shared/transitions.js';
import { recordEvent } from './_shared/events.js';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;

const usingStub = () => !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET;

const createRazorpayOrder = async ({ amount, currency, receipt }) => {
  // Lazy-require to avoid hard dependency in test environments without the SDK.
  let Razorpay;
  try {
    ({ default: Razorpay } = await import('razorpay'));
  } catch {
    return { id: `mock_order_${crypto.randomBytes(8).toString('hex')}` };
  }
  const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return rzp.orders.create({ amount: amount * 100, currency, receipt });
};

export const createIntent = async ({ user, bookingId }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== user._id.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}/payment-intent`);
  }
  if (booking.status !== 'PENDING') {
    throw Errors.INVALID_BOOKING_TRANSITION(`Booking ${booking.status} cannot accept new payments`);
  }

  let providerOrderId;
  if (usingStub()) {
    providerOrderId = `mock_order_${crypto.randomBytes(8).toString('hex')}`;
  } else {
    const order = await createRazorpayOrder({
      amount: booking.totalAmount,
      currency: 'INR',
      receipt: booking.code || booking._id.toString(),
    });
    providerOrderId = order.id;
  }

  const tx = await Transaction.create({
    user: user._id,
    booking: booking._id,
    amount: booking.totalAmount,
    currency: 'INR',
    provider: 'RAZORPAY',
    providerOrderId,
    status: 'CREATED',
  });

  return {
    transactionId: tx._id,
    providerOrderId,
    amount: booking.totalAmount,
    currency: 'INR',
    key: RAZORPAY_KEY_ID || 'mock_key',
  };
};

const verifySignature = (rawBody, signature) => {
  if (usingStub() && !RAZORPAY_WEBHOOK_SECRET) return true; // dev: allow stub webhooks
  if (!RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
};

export const handleRazorpayWebhook = async ({ rawBody, signature, payload }) => {
  if (!verifySignature(rawBody, signature)) throw Errors.WEBHOOK_SIGNATURE_INVALID();
  const event = payload?.event;

  if (event === 'payment.failed') {
    const entity = payload?.payload?.payment?.entity;
    const providerOrderId = entity?.order_id;
    if (!providerOrderId) return { handled: false };
    const tx = await Transaction.findOneAndUpdate(
      { providerOrderId },
      { status: 'FAILED' },
      { new: true },
    );
    if (!tx?.subscription) return { handled: !!tx };
    const sub = await Subscription.findById(tx.subscription);
    if (sub) {
      sub.consecutivePaymentFailures = (sub.consecutivePaymentFailures || 0) + 1;
      if (sub.consecutivePaymentFailures >= 2) {
        sub.status = 'PAUSED';
        sub.pauseUntil = null;
        await notify({ userId: sub.user, event: 'SUBSCRIPTION_PAUSED_PAYMENT',
          title: 'Subscription paused', body: 'Two payments failed — your subscription is paused.' });
      }
      await sub.save();
    }
    return { handled: true, transactionId: tx._id };
  }

  if (event !== 'payment.captured' && event !== 'order.paid') return { handled: false };

  const order = payload?.payload?.payment?.entity || payload?.payload?.order?.entity;
  const providerOrderId = order?.order_id || order?.id;
  const providerPaymentId = order?.id;
  if (!providerOrderId) return { handled: false };

  const tx = await Transaction.findOneAndUpdate(
    { providerOrderId },
    { providerPaymentId, status: 'CAPTURED' },
    { new: true },
  );
  if (!tx) return { handled: false };

  try {
    const dup = await Transaction.findOne({ booking: tx.booking, _id: { $ne: tx._id }, status: 'CAPTURED' });
    if (dup) {
      await issueRefund({ transactionId: tx._id, amount: tx.amount, reason: 'duplicate payment' });
    } else {
      const bookingForInvoice = await Booking.findById(tx.booking).populate('tests', 'name price');
      if (bookingForInvoice) {
        await generateInvoice({
          user: tx.user, booking: bookingForInvoice, transaction: tx, tests: bookingForInvoice.tests,
        });
      }
    }
  } catch (err) {
    console.warn('Invoice/double-pay handling failed (webhook still succeeds):', err.message);
  }

  if (tx.subscription) {
    await Subscription.findByIdAndUpdate(tx.subscription, { consecutivePaymentFailures: 0 });
  }

  const booking = await Booking.findById(tx.booking);
  if (!booking) return { handled: false };
  if (booking.status === 'PENDING') {
    const fromStatus = booking.status;
    assertTransition(fromStatus, 'CONFIRMED');
    booking.status = 'CONFIRMED';
    await booking.save();
    await recordEvent({ booking, fromStatus, toStatus: 'CONFIRMED', actorType: 'SYSTEM', reason: 'payment-captured' });
    notifyBookingStatus(booking).catch(() => {});
  }
  return { handled: true, bookingId: booking._id, transactionId: tx._id };
};
