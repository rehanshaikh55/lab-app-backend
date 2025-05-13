import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['user', 'lab'], default: 'user' },
  phone: String,
  address: String,
  resetToken: String,
  resetTokenExpiry: Date,
  picture: String,
}, { timestamps: true });

export default mongoose.model('User', userSchema);
