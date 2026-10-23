import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code:             { type: String, required: true, unique: true, uppercase: true, trim: true },
  description:      { type: String, default: '' },
  percentOff:       { type: Number },
  maxDiscount:      { type: Number },
  flatOff:          { type: Number },
  minOrder:         { type: Number, default: 0 },
  firstBookingOnly: { type: Boolean, default: false },
  validUntil:       { type: Date, default: null },
  isActive:         { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Coupon', couponSchema);
