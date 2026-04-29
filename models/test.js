import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  lab:                { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  name:               { type: String, required: true },
  category:           { type: String, default: 'General' }, // e.g. 'Blood', 'Urine', 'Radiology', 'Cardiac'
  description:        { type: String },
  price:              { type: Number, required: true },
  sampleRequirements: { type: String },
  turnaroundHours:    { type: Number, default: 24 },
  isActive:           { type: Boolean, default: true },
}, { timestamps: true });

testSchema.index({ lab: 1, isActive: 1 });
testSchema.index({ name: 'text', category: 'text' }); // full-text search
testSchema.index({ category: 1 });
testSchema.index({ price: 1 });

export default mongoose.model('Test', testSchema);
