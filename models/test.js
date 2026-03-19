import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  lab:                { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  name:               { type: String, required: true },
  description:        { type: String },
  price:              { type: Number, required: true },
  sampleRequirements: { type: String }, // 'Fasting 8 hours required'
  turnaroundHours:    { type: Number, default: 24 },
  isActive:           { type: Boolean, default: true },
}, { timestamps: true });

testSchema.index({ lab: 1, isActive: 1 });

export default mongoose.model('Test', testSchema);
