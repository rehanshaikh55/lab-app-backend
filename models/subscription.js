import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lab:                { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  test:               { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  frequency:          { type: String, enum: ['MONTHLY', 'WEEKLY', 'CUSTOM'], required: true },
  customIntervalDays: { type: Number },
  nextBookingDate:    { type: Date, required: true },
  autoPayment:        { type: Boolean, default: false },
  status:             { type: String, enum: ['ACTIVE', 'PAUSED', 'CANCELLED'], default: 'ACTIVE' },
  lastRunAt:          { type: Date },
  retryCount:         { type: Number, default: 0 },
}, { timestamps: true });

subscriptionSchema.index({ user: 1, status: 1, nextBookingDate: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
