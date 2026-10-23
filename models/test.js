import mongoose from 'mongoose';
import { toCatalogCode } from '../services/_shared/catalogCode.js';

const testSchema = new mongoose.Schema({
  lab:                      { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  name:                     { type: String, required: true },
  category:                 { type: String, default: 'General' }, // e.g. 'Blood', 'Urine', 'Radiology', 'Cardiac'
  description:              { type: String },
  plainLanguageDescription: { type: String },
  price:                    { type: Number, required: true },
  sampleRequirements:       { type: String },
  turnaroundHours:          { type: Number, default: 24 },
  fastingHours:             { type: Number, default: 0 },
  sampleType:               { type: String, enum: ['Blood','Urine','Stool','Swab','Imaging','Other'], default: 'Blood' },
  isActive:                 { type: Boolean, default: true },
  catalogCode:              { type: String, index: true }, // cross-lab key
  mrp:                      { type: Number },
  parametersCount:          { type: Number, default: 1 },
  isPackage:                { type: Boolean, default: false },
  homeCollection:           { type: Boolean, default: true },
}, { timestamps: true });

testSchema.pre('validate', function () {
  if (this.catalogCode == null && this.name) this.catalogCode = toCatalogCode(this.name);
  if (this.mrp == null) this.mrp = this.price;
});

testSchema.index({ lab: 1, isActive: 1 });
testSchema.index({ catalogCode: 1, isActive: 1 });
testSchema.index({ name: 'text', category: 'text' }); // full-text search
testSchema.index({ category: 1 });
testSchema.index({ price: 1 });

export default mongoose.model('Test', testSchema);
