const mongoose = require('mongoose');

// One document per student per elective group
// Stores their 1st/2nd/3rd preference and final allotment
const electiveChoiceSchema = new mongoose.Schema({
  student:       { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  electiveGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'ElectiveGroup', required: true },
  department:    { type: String },
  program:       { type: String },
  semester:      { type: Number },
  academicYear:  { type: String },

  // Student's preferences (subjectCode strings)
  pref1: { type: String, required: true }, // 1st preference subject code
  pref2: { type: String, default: '' },    // 2nd preference
  pref3: { type: String, default: '' },    // 3rd preference

  // Admin's final allotment
  allottedSubjectCode: { type: String, default: null },
  allottedSubjectName: { type: String, default: '' },
  allottedSplitLabel:  { type: String, default: '' }, // 'A' or 'B'
  status: {
    type: String,
    enum: ['submitted','confirmed','rejected'],
    default: 'submitted'
  },
  rejectionReason: { type: String, default: '' },
  submittedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

electiveChoiceSchema.index({ student: 1, electiveGroup: 1 }, { unique: true });
module.exports = mongoose.model('ElectiveChoice', electiveChoiceSchema);
