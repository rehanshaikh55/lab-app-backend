import mongoose from 'mongoose';

const subscriptionOccurrenceSchema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true, index: true },
  scheduledFor: { type: Date, required: true },
  state: { type: String,
    enum: ['REMINDED', 'AWAITING_APPROVAL', 'BOOKED', 'SKIPPED', 'NO_SLOT', 'PAYMENT_FAILED', 'COMPLETED'],
    required: true },
  booking:   { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  reason:    String,
  shiftedTo: Date,
}, { timestamps: true });

subscriptionOccurrenceSchema.index({ subscription: 1, scheduledFor: -1 });

export default mongoose.model('SubscriptionOccurrence', subscriptionOccurrenceSchema);
