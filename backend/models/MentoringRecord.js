const mongoose = require('mongoose');

const mentoringSchema = new mongoose.Schema({
  student:       { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  mentor:        { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  mentoringBatch:{ type: String, required: true },
  program:       { type: String, default: 'B.Tech' },
  branch:        { type: String, default: 'IT' },
  semester:      { type: Number, required: true },
  section:       { type: String, required: true },
  meetings: [{
    date:  { type: Date, default: Date.now },
    notes: { type: String }
  }],
  remarks:          { type: String, default: '' },
  academicYear:     { type: String, default: '2025-26' },
  activityPoints:   { type: Number, default: null },
  internshipMarks:  { type: Number, default: null },
  internshipTitle:  { type: String, default: '' },
  internshipStatus: { type: String, enum:['none','completed','ongoing'], default:'none' },
  // Dynamic component marks — keyed by component key from MentorTask
  componentMarks: [{
    key:      { type: String },   // matches MentorTask component key
    label:    { type: String },
    marks:    { type: Number, default: null },
    maxMarks: { type: Number }
  }]
}, { timestamps: true });

mentoringSchema.index({ student: 1, mentor: 1 }, { unique: true });
module.exports = mongoose.model('MentoringRecord', mentoringSchema);
