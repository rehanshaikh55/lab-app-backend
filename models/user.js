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

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, unique: true, lowercase: true, trim: true },
  phone:        { type: String },
  passwordHash: { type: String },
  roles: {
    type: [String],
    enum: ['CUSTOMER', 'LAB_OWNER', 'LAB_ASSISTANT', 'ADMIN'],
    default: ['CUSTOMER'],
  },
  addresses: [addressSchema],
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
  },
  refreshToken:     { type: String },   // stored hashed
  fcmToken:         { type: String },
  isVerified:       { type: Boolean, default: false },
  resetToken:       { type: String },
  resetTokenExpiry: { type: Date },
  picture:          { type: String },
  gender:           { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
  birthDate:        { type: Date },
  profileCompleted: { type: Boolean, default: false },
  lastLoginAt:      { type: Date },
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });
userSchema.index({ email: 1 });

export default mongoose.model('User', userSchema);
