import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  lab: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab' },
  name: String,
  description: String,
  price: Number,
  preparation: String, // e.g., fasting needed?
  sampleType: String, // blood, urine, etc.
  reportTime: String,
}, { timestamps: true });

export default mongoose.model('Test', testSchema);
