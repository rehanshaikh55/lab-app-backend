import mongoose from 'mongoose';

export const LEAD_TYPES = ['LAB_PARTNER', 'IOS_WAITLIST'];
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'CLOSED'];
export const LEAD_PHONE_PATTERN = /^[6-9]\d{9}$/;

const leadSchema = new mongoose.Schema({
  type: { type: String, enum: LEAD_TYPES, required: true },
  name: {
    type: String,
    trim: true,
    required() { return this.type === 'LAB_PARTNER'; },
    maxlength: 120,
  },
  labName: { type: String, trim: true, maxlength: 160 },
  phone: { type: String, required: true, match: LEAD_PHONE_PATTERN },
  email: { type: String, trim: true, maxlength: 254 },
  city: { type: String, trim: true, maxlength: 120 },
  branches: { type: String, trim: true, maxlength: 32 },
  message: { type: String, trim: true, maxlength: 2000 },
  source: { type: String, trim: true, required: true, maxlength: 200 },
  status: { type: String, enum: LEAD_STATUSES, default: 'NEW', required: true },
}, { timestamps: true });

export default mongoose.model('Lead', leadSchema);
