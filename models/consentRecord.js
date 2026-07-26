import mongoose from 'mongoose';

const consentRecordSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind:    { type: String, enum: ['TOS', 'PRIVACY', 'HEALTH_RECORDS', 'MARKETING'], required: true },
  version: { type: String, required: true },
  given:   { type: Boolean, required: true },
  ip:      { type: String },
  ua:      { type: String },
}, { timestamps: true });

consentRecordSchema.index({ user: 1, kind: 1, createdAt: -1 });

export default mongoose.model('ConsentRecord', consentRecordSchema);
