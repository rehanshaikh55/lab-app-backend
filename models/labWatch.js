import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  location:     { type: { type: String, default: 'Point' }, coordinates: { type: [Number], required: true } },
  radiusMeters: { type: Number, default: 5000 },
  notifiedAt:   { type: Date, default: null },
}, { timestamps: true });

schema.index({ location: '2dsphere' });

export default mongoose.model('LabWatch', schema);
