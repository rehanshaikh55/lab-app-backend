import Transaction from '../models/transaction.js';
import Refund from '../models/refund.js';
import { Errors } from '../common/errors.js';

// Refund-tracking only — this project has no live Razorpay refund integration in scope (mirrors the
// existing createIntent/usingStub() stub-first pattern). Always produce a mock provider refund id.
export const issueRefund = async ({ transactionId, amount, reason }) => {
  const tx = await Transaction.findById(transactionId);
  if (!tx) throw Errors.NOT_FOUND('Transaction');

  const alreadyRefunded = await Refund.aggregate([
    { $match: { transaction: tx._id, state: { $ne: 'FAILED' } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const refundedSoFar = alreadyRefunded[0]?.total || 0;
  if (refundedSoFar + amount > tx.amount) {
    throw Errors.VALIDATION_ERROR(
      `Refund amount ₹${amount} exceeds remaining refundable balance ₹${tx.amount - refundedSoFar}`);
  }

  const providerRefundId = `mock_refund_${Date.now()}`;

  return Refund.create({
    booking: tx.booking,
    transaction: tx._id,
    amount,
    reason,
    state: 'INITIATED',
    providerRefundId,
    expectedAt: new Date(Date.now() + 5 * 24 * 3600 * 1000),
  });
};

export const listRefundsForTransaction = async (transactionId) =>
  Refund.find({ transaction: transactionId }).sort({ createdAt: -1 });
