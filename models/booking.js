import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Ensures that a user must be associated with the booking
  },
  lab: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true, // Ensures that a lab must be associated with the booking
  },
  tests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true, // Ensures at least one test is selected
    },
  ],
  prescription: {
    type: String,
    default: null, // In case no prescription is uploaded
  },
  totalAmount: {
    type: Number,
    required: true, // Ensures total amount is provided
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  scheduledDate: {
    type: Date,
    required: true, // Ensures scheduled date is provided
  },
  reportUrl: {
    type: String,
    default: null, // If no report is available initially
  },
}, { timestamps: true });

export default mongoose.model('Booking', bookingSchema);
