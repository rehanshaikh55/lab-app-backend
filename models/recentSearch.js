import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind:  { type: String, enum: ['LAB', 'TEST', 'PACKAGE', 'QUERY'], required: true },
  value: { type: String, required: true },
  ref:   { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

schema.index({ user: 1, createdAt: -1 });

export default mongoose.model('RecentSearch', schema);
