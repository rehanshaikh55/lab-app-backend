import mongoose from 'mongoose';

const appContentSchema = new mongoose.Schema({
  key:     { type: String, required: true, unique: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

export default mongoose.model('AppContent', appContentSchema);
