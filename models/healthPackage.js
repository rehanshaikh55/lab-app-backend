import mongoose from 'mongoose';

const healthPackageSchema = new mongoose.Schema({
  lab:         { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', default: null },
  name:        { type: String, required: true },
  slug:        { type: String, required: true, unique: true, index: true },
  description: { type: String },
  category:    { type: String, default: 'General' },
  icon:        { type: String, default: 'package' },
  tests:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  price:       { type: Number, required: true },
  mrp:         { type: Number },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

healthPackageSchema.index({ category: 1, isActive: 1 });

export default mongoose.model('HealthPackage', healthPackageSchema);
