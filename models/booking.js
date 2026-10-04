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

const patientSnapshotSchema = new mongoose.Schema({
  dependentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  name:        { type: String },
  relation:    { type: String },
  gender:      { type: String },
  birthDate:   { type: Date },
  isSelf:      { type: Boolean, default: true },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lab:          { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  tests:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true }],
  package:      { type: mongoose.Schema.Types.ObjectId, ref: 'HealthPackage', default: null },
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  scheduledDate:{ type: Date, required: true },
  slot: {
    start: { type: String, required: true }, // '10:00'
    end:   { type: String },                 // '10:30'
  },
  status: {
    type: String,
    enum: [
      'PENDING', 'CONFIRMED', 'ASSISTANT_ASSIGNED', 'ON_THE_WAY', 'ARRIVED',
      'COLLECTED', 'PROCESSING', 'COMPLETED', 'RESCHEDULED', 'NO_SHOW', 'CANCELLED',
    ],
    default: 'PENDING',
  },
  cancelBy:        { type: String, enum: ['CUSTOMER', 'LAB', 'SYSTEM', null], default: null },
  rescheduleCount: { type: Number, default: 0 },
  visitOtp:           { type: String },
  visitOtpVerifiedAt: { type: Date, default: null },
  visitNotes:         { type: String, maxlength: 500 },
  code:           { type: String, unique: true, sparse: true, index: true },
  labAssistant:   { type: mongoose.Schema.Types.ObjectId, ref: 'LabAssistant', default: null },
  collectionType: { type: String, enum: ['HOME', 'IN_LAB'], required: true },
  userAddress:    addressSnapshotSchema,
  patient:        patientSnapshotSchema,
  totalAmount:    { type: Number, required: true },
  homeCollectionFee: { type: Number, default: 0 },
  paymentMethod:  { type: String, enum: ['ONLINE', 'PAY_AT_LAB'], default: 'ONLINE' },
  reports: [{
    test:   { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    _id: false,
  }],
  cancelReason:   { type: String },
  slotHoldExpiry: { type: Date },   // 15-min hold for PENDING bookings
  idempotencyKey: { type: String }, // for subscription-triggered bookings
}, { timestamps: true });

bookingSchema.index({ lab: 1, scheduledDate: 1 });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ subscription: 1 });
bookingSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model('Booking', bookingSchema);
