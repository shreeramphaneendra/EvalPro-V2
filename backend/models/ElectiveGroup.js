const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  teacher:    { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  splitLabel: { type: String, default: 'A' },
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
});

const electiveSubjectSchema = new mongoose.Schema({
  subjectCode:     { type: String, required: true },
  subjectName:     { type: String, required: true },
  hasLab:          { type: Boolean, default: false },
  labCode:         { type: String, default: '' },
  labName:         { type: String, default: '' },
  minEnrollment:   { type: Number, default: 5 },
  assignments:     [assignmentSchema],
  status:          { type: String, enum: ['pending','running','cancelled'], default: 'pending' },
  enrollmentCount: { type: Number, default: 0 },
});

const electiveGroupSchema = new mongoose.Schema({
  department:        { type: String, required: true },
  program:           { type: String, required: true },
  // currentSemester — semester students are IN when registering (e.g. Sem 4)
  currentSemester:   { type: Number, required: true },
  // targetSemester — semester they are registering FOR (e.g. Sem 5)
  targetSemester:    { type: Number, required: true },
  academicYear:      { type: String, required: true },
  slotLabel:         { type: String, required: true },
  slotType:          { type: String, enum: ['professional','open'], default: 'professional' },
  subjects:          [electiveSubjectSchema],
  registrationOpen:  { type: Date, required: true },
  registrationClose: { type: Date, required: true },
  resultDeclared:    { type: Boolean, default: false },
  status:            { type: String, enum: ['draft','open','closed','allotted'], default: 'draft' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
}, { timestamps: true });

module.exports = mongoose.model('ElectiveGroup', electiveGroupSchema);
