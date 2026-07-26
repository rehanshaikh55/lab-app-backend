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
  photos:       [{ url: String, caption: String }],
  description:  { type: String },
  amenities:    [{ type: String }],
  isActive:     { type: Boolean, default: true },
  isVerified:   { type: Boolean, default: false },
  policy: {
    responseSlaMinutes:        { type: Number, default: 120 }, // PRD §6.4 FR-10: 2 hours
    rescheduleCutoffHours:     { type: Number, default: 4 },   // PRD §6.4 FR-8
    maxReschedulesPerBooking:  { type: Number, default: 2 },   // PRD §6.4 FR-8
    cancellationCutoffHours:   { type: Number, default: 4 },   // PRD §6.4 FR-9
    cancellationFee:           { type: Number, default: 0 },
    noShowFee:                 { type: Number, default: 0 },
    noShowGraceMinutes:        { type: Number, default: 30 },
    homeCollectionFee:         { type: Number, default: 0 },   // PRD §6.4 FR-3
    homeCollectionWaiverAbove: { type: Number, default: 0 },   // PRD §6.4 FR-3: fee waived above this order value
  },
}, { timestamps: true });

labSchema.index({ location: '2dsphere' });
labSchema.index({ owner: 1, isActive: 1 });

// PRD §6.2 — "Notify me when a lab joins near me" (empty-state action). A synchronous post-save
// hook was chosen over a scheduled job: lab activations are low-frequency writes (not a hot
// path), and users expect the notification promptly rather than on the next poll cycle. To avoid
// firing on every unrelated save (e.g. rating updates), we capture the "did this save just make
// the lab active" transition in pre('save') — `isModified()`/`isNew` are unreliable to read in
// post('save') because Mongoose resets the modified-paths tracking before post hooks run — and
// stash it on `$locals` for the post hook to read. The post hook does not await
// `notifyLabWatchers`, so a notification failure (or a slow geo query) never blocks or fails the
// lab save itself.
//
// `discoveryService.js` is imported lazily (dynamic import inside the hook) rather than
// statically at module scope: it transitively imports `config/env.js` (via
// `notificationService.js`), and `config/env.js` reads `process.env.*` into frozen `export
// const`s at first evaluation. Many tests import `models/lab.js` directly at the top of the test
// file, before `setupTestApp()` has set `JWT_SECRET`/`MONGO_URI`/etc — a static top-level import
// here would race that setup and could freeze those env-derived constants as `undefined` for the
// whole process. The dynamic import defers evaluation until a lab is actually saved, by which
// point env vars are always set.
labSchema.pre('save', function () {
  this.$locals.justActivated = this.isNew ? this.isActive : (this.isModified('isActive') && this.isActive);
});

labSchema.post('save', function (doc) {
  if (!doc.$locals.justActivated) return;
  import('../services/discoveryService.js')
    .then(({ notifyLabWatchers }) => notifyLabWatchers(doc))
    .catch(() => { /* never block/fail a lab save on notification errors */ });
});

export default mongoose.model('Lab', labSchema);
