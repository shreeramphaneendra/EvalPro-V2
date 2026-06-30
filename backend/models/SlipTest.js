const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  qNo:      { type: Number, required: true },
  type:     { type: String, enum: ['mcq','short'], required: true },
  text:     { type: String, required: true },
  marks:    { type: Number, required: true },
  // MCQ fields
  options:  [{ type: String }],          // ['A) Newton', 'B) Einstein', ...]
  correct:  { type: Number, default: null }, // index of correct option (0-3)
  // Short answer fields
  hint:     { type: String, default: '' }, // optional answer hint for teacher
});

const slipTestSchema = new mongoose.Schema({
  subject:      { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher:      { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  slot:         { type: String, enum: ['ST1','ST2','ST3'], required: true },
  section:      { type: String, default: null }, // null = all sections
  title:        { type: String, required: true },
  instructions: { type: String, default: '' },
  questions:    [questionSchema],
  totalMarks:   { type: Number, required: true }, // sum of all question marks
  duration:     { type: Number, required: true }, // in minutes
  windowStart:  { type: Date, required: true },
  windowEnd:    { type: Date, required: true },
  status:       { type: String, enum: ['draft','active','closed'], default: 'draft' },
  academicYear: { type: String, default: '2026-27' },
}, { timestamps: true });

module.exports = mongoose.model('SlipTest', slipTestSchema);
