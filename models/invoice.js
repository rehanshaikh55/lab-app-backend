import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  booking:     { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  number:      { type: String, required: true, unique: true },
  lines:    [{ description: String, amount: Number, qty: Number }],
  subtotal: Number,
  tax:      { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total:    Number,
  pdfUri:   { type: String, default: null }, // null if PDF storage upload failed/unavailable — see invoiceService.js
}, { timestamps: true });

invoiceSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Invoice', invoiceSchema);
