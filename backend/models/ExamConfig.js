const mongoose = require('mongoose');

// Each question/sub-part in the paper.
// groupId: groups sub-parts together under one parent question
//   e.g. 4a and 4b both have groupId='4'
// eitherOrPair: marks two groups as an either/or choice
//   e.g. groups '4' and '5' are paired → student answers Q4 OR Q5
//   stored as a string label, e.g. 'pair1' — all groups with same label are paired
const questionSchema = new mongoose.Schema({
  qNo:        { type: String, required: true }, // '1', '4a', '4b', '5a', '5b'
  coNo:       { type: String, default: 'CO1' },
  maxMarks:   { type: Number, required: true },
  groupId:    { type: String, default: '' },    // '4' for 4a+4b, '5' for 5a+5b
  eitherOrPair: { type: String, default: '' }   // 'pair1' on both group '4' and '5'
}, { _id: false });

const examConfigSchema = new mongoose.Schema({
  subject:  { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  examType: {
    type: String,
    enum: ['CT1','CT2','ST1','ST2','ST3','ASGN1','ASGN2','LAB_INT1','LAB_INT2'],
    required: true
  },
  // section: optional — if set, this config is only for that section.
  // If null/empty, it applies to ALL sections (default behaviour).
  section:      { type: String, default: null },
  questions:    [questionSchema],
  totalMax:     { type: Number, default: 0 },
  configuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
}, { timestamps: true });

// Unique per subject + examType + section (null = global for all sections)
examConfigSchema.index({ subject: 1, examType: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('ExamConfig', examConfigSchema);
