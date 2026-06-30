const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  subject:     { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  dueDate:     { type: Date, default: null },

  // 'assignment' = A1/A2, 'sliptest' = ST1/ST2/ST3
  type:        { type: String, enum: ['assignment', 'sliptest'], required: true },
  slotNo:      { type: Number, required: true }, // 1 or 2 for assignments; 1,2,3 for sliptests

  // Slip test only — Google Form link
  formLink:    { type: String, default: '' },

  // Assignment only — submission mode
  // 'online': students can upload files through portal
  // 'offline': physical submission only, portal used for visibility/tracking
  // 'mixed': both accepted (default — doesn't restrict anything)
  mode:        { type: String, enum: ['online','offline','mixed'], default: 'mixed' },

  // Optional question paper / reference file attached by teacher
  attachmentUrl:  { type: String, default: '' },
  attachmentName: { type: String, default: '' },

  academicYear: { type: String, default: '2025-26' },
  isActive:     { type: Boolean, default: true }
}, { timestamps: true });

// One active assignment per slot per subject per academic year
assignmentSchema.index({ subject: 1, type: 1, slotNo: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
