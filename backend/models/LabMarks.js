const mongoose = require('mongoose');

const questionMarkSchema = new mongoose.Schema({
  qNo:    { type: String },
  marks:  { type: Number, default: null },
  absent: { type: Boolean, default: false }
}, { _id: false });

const internalSchema = new mongoose.Schema({
  questions: [questionMarkSchema],
  total:     { type: Number, default: null },
  isAbsent:  { type: Boolean, default: false }
}, { _id: false });

const weeklySchema = new mongoose.Schema({
  week:    { type: Number, required: true },
  date:    { type: Date, default: null },
  pep:     { type: Number, default: null, min: 0, max: 5 },   // Pre-Experiment Preparation
  exp:     { type: Number, default: null, min: 0, max: 10 },  // Experimentation
  pea:     { type: Number, default: null, min: 0, max: 5 },   // Post-Experiment Analysis
  record:  { type: Number, default: null, min: 0, max: 5 },
  conduct: { type: Number, default: null, min: 0, max: 5 },
  total:   { type: Number, default: null }
}, { _id: false });

const labMarksSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  batch:   { type: String, enum: ['B1', 'B2', 'B3'], required: true },
  academicYear: { type: String, default: '2025-26' },   // NEW: allows re-attempt in new year

  int1: { type: internalSchema, default: () => ({}) },
  int2: { type: internalSchema, default: () => ({}) },
  weeklyMarks: [weeklySchema],

  computed: {
    ali:   { type: Number, default: null },  // avg lab internals → ceil → /20
    awcie: { type: Number, default: null },  // avg weekly total → /30
    total: { type: Number, default: null }   // ali + awcie → /50
  },

  status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'draft' }
}, { timestamps: true });

labMarksSchema.index({ student: 1, subject: 1, batch: 1, academicYear: 1 }, { unique: true });

labMarksSchema.methods.compute = function() {
  const ceil = n => Math.ceil(n);

  // ALI: avg(int1, int2) → ceil
  // CBIT rule: if a student is ABSENT for one internal, only the attended
  // internal is used (absent is NOT averaged in as 0).
  const i1 = this.int1?.isAbsent ? null : (this.int1?.total ?? null);
  const i2 = this.int2?.isAbsent ? null : (this.int2?.total ?? null);
  const intVals = [i1, i2].filter(v => v !== null);
  if (intVals.length > 0) {
    this.computed.ali = ceil(intVals.reduce((a,b)=>a+b,0) / intVals.length);
  } else if (this.int1?.isAbsent && this.int2?.isAbsent) {
    this.computed.ali = 0; // absent for both internals
  }

  // AWCIE: avg of all entered weekly totals → out of 30
  // Only weeks with at least one mark entered are counted in the average.
  // Missing weeks are NOT treated as 0 (avg of conducted weeks only).
  const weeks = this.weeklyMarks || [];
  if (weeks.length > 0) {
    // Compute each week total first
    weeks.forEach(w => {
      const parts = [w.pep, w.exp, w.pea, w.record, w.conduct].filter(v => v !== null && v !== undefined);
      if (parts.length > 0) w.total = parts.reduce((a,b)=>a+b,0);
      // else: keep any total that was provided directly (import paths)
    });
    const weekTotals = weeks.map(w => w.total).filter(v => v !== null);
    if (weekTotals.length > 0) {
      const rawAvg = weekTotals.reduce((a,b)=>a+b,0) / weekTotals.length;
      this.computed.awcie = parseFloat(rawAvg.toFixed(2));
    }
  }

  if (this.computed.ali !== null || this.computed.awcie !== null) {
    this.computed.total = parseFloat(((this.computed.ali ?? 0) + (this.computed.awcie ?? 0)).toFixed(2));
  }
};

module.exports = mongoose.model('LabMarks', labMarksSchema);
