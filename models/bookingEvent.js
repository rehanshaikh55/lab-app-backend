import mongoose from 'mongoose';

const bookingEventSchema = new mongoose.Schema({
  booking:    { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  fromStatus: String,
  toStatus:   { type: String, required: true },
  actorType:  { type: String, enum: ['CUSTOMER', 'LAB_OWNER', 'LAB_ASSISTANT', 'SYSTEM'], required: true },
  actorId:    { type: mongoose.Schema.Types.ObjectId },
  reason:     String,
  meta:       mongoose.Schema.Types.Mixed,
}, { timestamps: true });

bookingEventSchema.index({ booking: 1, createdAt: 1 });

export default mongoose.model('BookingEvent', bookingEventSchema);
