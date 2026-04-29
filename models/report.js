import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  test:    { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  file: {
    uri:             { type: String, required: true }, // Firebase Storage path
    storageProvider: { type: String, enum: ['FIREBASE', 'S3', 'LOCAL'], default: 'FIREBASE' },
    checksum:        { type: String }, // sha256
  },
  issuedAt:     { type: Date, default: Date.now },
  isAccessible: { type: Boolean, default: true },
}, { timestamps: true });

reportSchema.index({ booking: 1 });

export default mongoose.model('Report', reportSchema);
