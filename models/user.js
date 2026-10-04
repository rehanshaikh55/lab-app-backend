import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  label:   { type: String, default: 'Home' },
  line1:   { type: String },
  line2:   { type: String },
  city:    { type: String },
  state:   { type: String },
  zipCode: { type: String },
  country: { type: String, default: 'India' },
  coordinates: { type: [Number] }, // [lng, lat]
}, { _id: true });

const dependentSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  relation:  { type: String, enum: ['self', 'spouse', 'father', 'mother', 'son', 'daughter', 'sibling', 'other'], default: 'other' },
  gender:    { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  birthDate: { type: Date },
}, { _id: true, timestamps: true });

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, unique: true, lowercase: true, trim: true, sparse: true },
  phone:        { type: String },
  passwordHash: { type: String },
  roles: {
    type: [String],
    enum: ['CUSTOMER', 'LAB_OWNER', 'LAB_ASSISTANT', 'ADMIN'],
    default: ['CUSTOMER'],
  },
  addresses:  [addressSchema],
  dependents: [dependentSchema],
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
  },
  fcmToken:         { type: String },
  isVerified:       { type: Boolean, default: false },
  emailVerifiedAt:  { type: Date, default: null },
  resetToken:       { type: String },
  resetTokenExpiry: { type: Date },
  picture:          { type: String },
  gender:           { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  birthDate:        { type: Date },
  profileCompleted: { type: Boolean, default: false },
  lastLoginAt:      { type: Date },
  // Task 24: 30-day account-deletion grace period. Set by requestAccountDeletion,
  // cleared by cancelAccountDeletion, consumed (and reset to null) by accountDeletionJob.
  deletionScheduledAt: { type: Date, default: null, index: true },
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

export default mongoose.model('User', userSchema);
