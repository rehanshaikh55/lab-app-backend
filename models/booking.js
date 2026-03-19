import mongoose from 'mongoose';

const addressSnapshotSchema = new mongoose.Schema({
  line1:       { type: String },
  line2:       { type: String },
  city:        { type: String },
  state:       { type: String },
  zipCode:     { type: String },
  country:     { type: String },
  coordinates: { type: [Number] },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lab:          { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  tests:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true }],
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  scheduledDate:{ type: Date, required: true },
  slot: {
    start: { type: String, required: true }, // '10:00'
    end:   { type: String },                 // '10:30'
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'COLLECTED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
  },
  labAssistant:   { type: mongoose.Schema.Types.ObjectId, ref: 'LabAssistant', default: null },
  collectionType: { type: String, enum: ['HOME', 'IN_LAB'], required: true },
  userAddress:    addressSnapshotSchema,
  totalAmount:    { type: Number, required: true },
  report:         { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
  cancelReason:   { type: String },
  slotHoldExpiry: { type: Date },   // 15-min hold for PENDING bookings
  idempotencyKey: { type: String }, // for subscription-triggered bookings
}, { timestamps: true });

bookingSchema.index({ lab: 1, scheduledDate: 1 });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ subscription: 1 });
bookingSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model('Booking', bookingSchema);
