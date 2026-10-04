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
  lockedAt:           { type: Date, default: null },
  retryCount:         { type: Number, default: 0 },

  preferredTimeWindow: {
    start: { type: String, default: '09:00' },
    end:   { type: String, default: '12:00' },
  },
  preBookingReminderDays:    { type: Number, default: 3, min: 1, max: 7 },
  approvalMode:              { type: String, enum: ['AUTO_PAY', 'APPROVE_EACH_TIME'], default: 'APPROVE_EACH_TIME' },
  pauseUntil:                { type: Date, default: null },
  consecutivePaymentFailures:{ type: Number, default: 0 },
  collectionType:            { type: String, enum: ['HOME', 'IN_LAB'], default: 'IN_LAB' },
  userAddressId:             { type: mongoose.Schema.Types.ObjectId },
  dependentId:               { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

subscriptionSchema.index({ user: 1, status: 1, nextBookingDate: 1 });
subscriptionSchema.index({ status: 1, nextBookingDate: 1, lockedAt: 1 });

export default mongoose.model('Subscription', subscriptionSchema);
