import * as paymentService from '../services/paymentService.js';
import * as refundService from '../services/refundService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Invoice from '../models/invoice.js';
import Transaction from '../models/transaction.js';
import Refund from '../models/refund.js';
import Booking from '../models/booking.js';
import Test from '../models/test.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';

export const createIntent = asyncHandler(async (req, reply) =>
  reply.code(200).send(await paymentService.createIntent({
    user: req.user,
    bookingId: req.params.id,
  })));

export const razorpayWebhook = asyncHandler(async (req, reply) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const result = await paymentService.handleRazorpayWebhook({ rawBody, signature, payload });
  return reply.code(200).send(result);
});

export const listPayments = asyncHandler(async (req, reply) => {
  const [invoices, transactions] = await Promise.all([
    Invoice.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100),
    Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100),
  ]);
  const refunds = await Refund.find({ booking: { $in: transactions.map((t) => t.booking) } }).sort({ createdAt: -1 });
  return reply.code(200).send({ invoices, transactions, refunds });
});

export const getInvoice = asyncHandler(async (req, reply) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
  if (!invoice) throw Errors.NOT_FOUND('Invoice', `/invoices/${req.params.id}`);
  const signedUrl = invoice.pdfUri ? await storage.getSignedUrl(invoice.pdfUri) : null;
  return reply.code(200).send({ invoice, signedUrl });
});

export const requestRefund = asyncHandler(async (req, reply) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking || booking.user.toString() !== req.user._id.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${req.params.id}/refund`);
  }
  const tx = await Transaction.findOne({ booking: booking._id, status: 'CAPTURED' }).sort({ createdAt: -1 });
  if (!tx) throw Errors.NOT_FOUND('Captured transaction for this booking', `/bookings/${req.params.id}/refund`);

  let amount = tx.amount;
  const { testIds, reason } = req.body || {};
  if (testIds?.length) {
    const tests = await Test.find({ _id: { $in: testIds }, lab: booking.lab });
    amount = tests.reduce((sum, t) => sum + t.price, 0);
  }
  const refund = await refundService.issueRefund({ transactionId: tx._id, amount, reason });
  return reply.code(201).send({ refund });
});
