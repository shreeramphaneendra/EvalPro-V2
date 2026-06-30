const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { PROGRAM_KEYS } = require('../utils/programs');

const supplySchema = new mongoose.Schema({
  subject:     { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  subjectName: { type: String },
  subjectCode: { type: String },
  semester:    { type: Number },
  academicYear:{ type: String },
  cleared:     { type: Boolean, default: false },
  clearedOn:   { type: Date, default: null }
}, { _id: true });

const studentSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  usn:            { type: String, required: true, unique: true, uppercase: true },
  password:       { type: String, required: true },
  program:        { type: String, enum: PROGRAM_KEYS, required: true, default: 'B.Tech' },
  branch:         { type: String, required: true },
  semester:       { type: Number, required: true, min: 1 },
  section:        { type: String, required: true },
  labBatch:       { type: String, enum: ['B1','B2','B3','NA'], default: 'B1' },
  mentoringBatch: { type: String, default: '' },
  phone:          { type: String },
  electives:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],

  status:   { type: String, enum: ['Active','Detained','Graduated','PendingClearance'], default: 'Active' },
  supplies: { type: [supplySchema], default: [] },

  isFirstLogin: { type: Boolean, default: true },
  academicYear: { type: String, default: '2025-26' },
  role:         { type: String, default: 'student' }
}, { timestamps: true });

studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
studentSchema.methods.matchPassword = function(p) { return bcrypt.compare(p, this.password); };
studentSchema.methods.hasPendingSupplies = function() {
  return (this.supplies || []).some(s => !s.cleared);
};

module.exports = mongoose.model('Student', studentSchema);
