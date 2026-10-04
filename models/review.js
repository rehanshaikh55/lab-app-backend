import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lab:     { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
}, { timestamps: true });

reviewSchema.index({ lab: 1, createdAt: -1 });
reviewSchema.index({ user: 1, booking: 1 }, { unique: true, sparse: true });

export default mongoose.model('Review', reviewSchema);
