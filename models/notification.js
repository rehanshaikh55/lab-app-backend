import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event:  { type: String, required: true },
  title:  { type: String, required: true },
  body:   { type: String },
  data:   { type: mongoose.Schema.Types.Mixed },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
