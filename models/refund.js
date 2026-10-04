import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  booking:     { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  amount:      { type: Number, required: true },
  reason:      String,
  state: { type: String, enum: ['INITIATED', 'PROCESSED', 'CREDITED', 'FAILED'], default: 'INITIATED' },
  providerRefundId: String,
  expectedAt:       Date,
}, { timestamps: true });

export default mongoose.model('Refund', refundSchema);
