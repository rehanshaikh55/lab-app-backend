import mongoose from 'mongoose';

const labSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // if lab owners are users
  name: String,
  address: String,
  location: {
    lat: Number,
    lng: Number,
  },
  phone: String,
  email: String,
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Lab', labSchema);
