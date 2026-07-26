import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshTokenHash: { type: String, required: true },
  deviceId:         { type: String },
  deviceLabel:      { type: String },
  ua:               { type: String },
  ip:               { type: String },
  lastUsedAt:       { type: Date, default: Date.now },
}, { timestamps: true });

sessionSchema.index({ user: 1, lastUsedAt: -1 });

export default mongoose.model('Session', sessionSchema);
