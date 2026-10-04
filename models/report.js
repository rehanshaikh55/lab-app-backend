import mongoose from 'mongoose';

const parameterSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  value:   { type: String, required: true },
  unit:    { type: String },
  refLow:  { type: Number },
  refHigh: { type: Number },
  flag:    { type: String, enum: ['LOW', 'NORMAL', 'HIGH', null], default: null },
}, { _id: false });

const reportSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  test:    { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  file: {
    uri:             { type: String, required: true }, // Firebase Storage path
    storageProvider: { type: String, enum: ['FIREBASE', 'S3', 'LOCAL'], default: 'FIREBASE' },
    checksum:        { type: String }, // sha256
  },
  parameters:     [parameterSchema],
  remindRetestAt: { type: Date, default: null },
  issuedAt:       { type: Date, default: Date.now },
  isAccessible:   { type: Boolean, default: true },
  replacedAt:     { type: Date, default: null },
  replacedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  replaceReason:  String,
  expectedAt:     Date,
}, { timestamps: true });

reportSchema.index({ booking: 1 });
reportSchema.index({ remindRetestAt: 1 });

export default mongoose.model('Report', reportSchema);
