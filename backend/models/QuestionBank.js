const mongoose = require('mongoose');

// Reusable questions per subject. Teachers save from a slip test and import later.
const bankQuestionSchema = new mongoose.Schema({
  type:     { type: String, enum: ['mcq','short'], required: true },
  text:     { type: String, required: true },
  marks:    { type: Number, default: 1 },
  options:  [{ type: String }],
  correct:  { type: Number, default: null },
  hint:     { type: String, default: '' },
  topic:    { type: String, default: '' },
  difficulty:{ type: String, enum: ['easy','medium','hard'], default: 'medium' },
  timesUsed:{ type: Number, default: 0 },
  createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
}, { timestamps: true });

const questionBankSchema = new mongoose.Schema({
  subject:      { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  subjectCode:  { type: String, default: '' },
  department:   { type: String, default: '' },
  // Shared across the department so any teacher of the subject can reuse
  questions:    [bankQuestionSchema],
}, { timestamps: true });

questionBankSchema.index({ subject: 1 }, { unique: true });
module.exports = mongoose.model('QuestionBank', questionBankSchema);
