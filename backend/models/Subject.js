const mongoose = require('mongoose');
const { PROGRAM_KEYS } = require('../utils/programs');

const subjectSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  code:         { type: String, required: true, trim: true, uppercase: true },
  type:         { type: String, enum: ['theory','lab','elective','none'], required: true },
  program:      { type: String, enum: PROGRAM_KEYS, required: true, default: 'B.Tech' },
  department:   { type: String, required: true },
  semester:     { type: Number, required: true, min: 1 },
  credits:      { type: Number, default: 3 },
  academicYear: { type: String, default: '2025-26' },

  // Theory:
  // One teacher per section  →  [{ section:'1', teacher:id }, { section:'2', teacher:id }]
  sectionTeachers: [{
    section: { type: String, required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
  }],

  // Lab:
  // One teacher per section+batch  →  [{ section:'1', batch:'B1', teacher:id }, ...]
  batchTeachers: [{
    section: { type: String, required: true },
    batch:   { type: String, enum: ['B1','B2','B3'] },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
  }],

  // Elective:
  // Multiple teachers, each handles a roll number range
  // e.g. Teacher A: 160124737001–160124737030, Teacher B: 160124737031–160124737060
  // fromRoll and toRoll are stored as strings for flexible matching
  electiveTeachers: [{
    teacher:  { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    fromRoll: { type: String, default: '' },  // e.g. '160124737001'
    toRoll:   { type: String, default: '' }   // e.g. '160124737030'
  }],

  electiveGroup: { type: String, default: null },
  isLocked:      { type: Boolean, default: false },
  status:        { type: String, enum: ['draft','submitted','approved'], default: 'draft' },
  markEntryDeadline: { type: Date, default: null }  // Admin sets deadline for teacher mark entry
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
