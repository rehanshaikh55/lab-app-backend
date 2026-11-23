import Transaction from '../models/transaction.js';
import Refund from '../models/refund.js';
import { Errors } from '../common/errors.js';
import { razorpayConfigured, razorpayClient, toPaise } from './_shared/razorpay.js';

const EXPECTED_DAYS = 7; // Razorpay "normal" refunds settle in 5–7 working days

// Sum of refunds that have not failed; a failed refund frees its amount for a retry.
const refundedSoFar = async (transactionId) => {
  const rows = await Refund.aggregate([
    { $match: { transaction: transactionId, state: { $ne: 'FAILED' } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return rows[0]?.total || 0;
};

// Keep Transaction.status in step with its refunds: REFUNDED once fully refunded,
// back to CAPTURED if a refund later fails.
const syncTransactionStatus = async (tx) => {
  if (tx.status !== 'CAPTURED' && tx.status !== 'REFUNDED') return;
  const refunded = await refundedSoFar(tx._id);
  const next = refunded >= tx.amount ? 'REFUNDED' : 'CAPTURED';
  if (tx.status !== next) await Transaction.updateOne({ _id: tx._id }, { status: next });
};

export const issueRefund = async ({ transactionId, amount, reason }) => {
  const tx = await Transaction.findById(transactionId);
  if (!tx) throw Errors.NOT_FOUND('Transaction');
  if (!(amount > 0)) throw Errors.VALIDATION_ERROR('Refund amount must be greater than zero');

  const remaining = tx.amount - await refundedSoFar(tx._id);
  if (amount > remaining) {
    throw Errors.VALIDATION_ERROR(
      `Refund amount ₹${amount} exceeds remaining refundable balance ₹${remaining}`);
  }

  // Record the refund before calling Razorpay so a concurrent request sees the reserved amount.
  const refund = await Refund.create({
    booking: tx.booking,
    transaction: tx._id,
    amount,
    reason,
    state: 'INITIATED',
    expectedAt: new Date(Date.now() + EXPECTED_DAYS * 24 * 3600 * 1000),
  });

  if (!razorpayConfigured()) {
    // Stub mode (no keys): nothing to call.
    refund.providerRefundId = `mock_refund_${refund._id}`;
    await refund.save();
    await syncTransactionStatus(tx);
    return refund;
  }

  if (!tx.providerPaymentId) {
    refund.state = 'FAILED';
    refund.failureReason = 'Transaction has no captured payment id';
    await refund.save();
    throw Errors.VALIDATION_ERROR('This transaction has no captured payment to refund');
  }

  try {
    const rzp = await razorpayClient();
    const result = await rzp.payments.refund(tx.providerPaymentId, {
      amount: toPaise(amount),
      speed: 'normal',
      receipt: refund._id.toString(),
      notes: { bookingId: String(tx.booking), reason: String(reason || '').slice(0, 250) },
    });
    refund.providerRefundId = result.id;
    if (result.status === 'processed') refund.state = 'PROCESSED';
    await refund.save();
  } catch (err) {
    refund.state = 'FAILED';
    refund.failureReason = err?.error?.description || err?.message || 'Razorpay refund failed';
    await refund.save();
    throw Errors.PAYMENT_FAILED(`Refund failed: ${refund.failureReason}`);
  }

  await syncTransactionStatus(tx);
  return refund;
};

// Refund every captured payment on a cancelled booking. `fee` (rupees) is kept back once,
// across payments. Never throws: a cancellation must not fail because Razorpay did. Failed
// refunds stay as FAILED rows for an admin to retry.
export const refundCancelledBooking = async ({ booking, fee = 0, reason }) => {
  const txs = await Transaction.find({ booking: booking._id, status: 'CAPTURED' }).sort({ createdAt: 1 });
  let feeLeft = Math.max(0, fee);
  const refunds = [];
  for (const tx of txs) {
    const remaining = tx.amount - await refundedSoFar(tx._id);
    const kept = Math.min(feeLeft, remaining);
    feeLeft -= kept;
    const amount = remaining - kept;
    if (amount <= 0) continue;
    try {
      refunds.push(await issueRefund({ transactionId: tx._id, amount, reason }));
    } catch (err) {
      console.error(`[refunds] booking ${booking._id} tx ${tx._id}: ${err.detail || err.message}`);
    }
  }
  return refunds;
};

// Razorpay refund.processed / refund.failed webhooks.
export const applyRefundWebhook = async ({ event, entity }) => {
  if (!entity?.id) return { handled: false };
  const refund = await Refund.findOne({ providerRefundId: entity.id });
  if (!refund) return { handled: false };
  if (event === 'refund.processed') {
    refund.state = 'PROCESSED';
  } else if (event === 'refund.failed') {
    refund.state = 'FAILED';
    refund.failureReason = entity.error_description || 'Razorpay reported the refund failed';
  } else {
    return { handled: false };
  }
  await refund.save();
  const tx = await Transaction.findById(refund.transaction);
  if (tx) await syncTransactionStatus(tx);
  return { handled: true, refundId: refund._id };
};

export const listRefundsForTransaction = async (transactionId) =>
  Refund.find({ transaction: transactionId }).sort({ createdAt: -1 });
