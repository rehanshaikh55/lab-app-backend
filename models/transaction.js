import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  booking:           { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  subscription:      { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  provider:          { type: String, enum: ['RAZORPAY', 'STRIPE', 'PAYTM'], default: 'RAZORPAY' },
  providerOrderId:   { type: String },
  providerPaymentId: { type: String },
  amount:            { type: Number, required: true },  // rupees (display unit)
  currency:          { type: String, default: 'INR' },
  status:            { type: String, enum: ['CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'], default: 'CREATED' },
  method:            { type: String, enum: ['UPI', 'CARD', 'WALLET', 'NETBANKING'] },
  webhookEvents:     [mongoose.Schema.Types.Mixed],
  idempotencyKey:    { type: String, unique: true, sparse: true },
}, { timestamps: true });

transactionSchema.index({ provider: 1, providerOrderId: 1 });
transactionSchema.index({ booking: 1 });

export default mongoose.model('Transaction', transactionSchema);
