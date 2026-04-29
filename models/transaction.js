import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  booking:      { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  provider:     { type: String, enum: ['RAZORPAY', 'STRIPE', 'PAYTM'], default: 'RAZORPAY' },
  providerTxnId:{ type: String },
  amount:       { type: Number, required: true }, // paise (INR × 100)
  currency:     { type: String, default: 'INR' },
  status:       { type: String, enum: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  method:       { type: String, enum: ['UPI', 'CARD', 'WALLET', 'NETBANKING'] },
  webhookEvents:  [mongoose.Schema.Types.Mixed],
  idempotencyKey: { type: String, unique: true },
}, { timestamps: true });

transactionSchema.index({ provider: 1, providerTxnId: 1 });
transactionSchema.index({ booking: 1 });

export default mongoose.model('Transaction', transactionSchema);
