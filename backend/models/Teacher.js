const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { PROGRAM_KEYS } = require('../utils/programs');

const teacherSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  employeeId:   { type: String, required: true, unique: true, uppercase: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  department:   { type: String, required: true },
  designation:  { type: String, default: 'Assistant Professor' },
  phone:        { type: String },
  canBeMentor:  { type: Boolean, default: true },

  // ── Admin permission (merged role) ──
  // A teacher with isAdmin:true gets the Administration area for their
  // department. programs[] scopes which programs they administer.
  isAdmin:      { type: Boolean, default: false },
  programs:     { type: [String], enum: PROGRAM_KEYS, default: ['B.Tech'] },
  college:      { type: String, default: 'CBIT' },

  role:         { type: String, default: 'teacher' },
  isFirstLogin: { type: Boolean, default: true }
}, { timestamps: true });

teacherSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
teacherSchema.methods.matchPassword = function(p) { return bcrypt.compare(p, this.password); };

module.exports = mongoose.model('Teacher', teacherSchema);
