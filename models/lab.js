import mongoose from 'mongoose';

const dayScheduleSchema = new mongoose.Schema({
  open:     { type: String },  // '09:00'
  close:    { type: String },  // '18:00'
  isClosed: { type: Boolean, default: false },
}, { _id: false });

const labSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:  { type: String, required: true },
  address: {
    line1:   { type: String },
    line2:   { type: String },
    city:    { type: String },
    state:   { type: String },
    zipCode: { type: String },
    country: { type: String, default: 'India' },
  },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  phone:          { type: String },
  email:          { type: String },
  certifications: [{ type: String }], // ['NABL', 'CAP', 'ISO']
  openingHours: {
    monday:    dayScheduleSchema,
    tuesday:   dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday:  dayScheduleSchema,
    friday:    dayScheduleSchema,
    saturday:  dayScheduleSchema,
    sunday:    dayScheduleSchema,
  },
  slotMatrix: {
    duration:           { type: Number, default: 30 }, // minutes
    intervalMinutes:    { type: Number, default: 30 },
    maxBookingsPerSlot: { type: Number, default: 5 },
  },
  rating:       { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  isVerified:   { type: Boolean, default: false },
}, { timestamps: true });

labSchema.index({ location: '2dsphere' });
labSchema.index({ owner: 1, isActive: 1 });

export default mongoose.model('Lab', labSchema);
