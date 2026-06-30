const mongoose = require('mongoose');

const questionMarkSchema = new mongoose.Schema({
  qNo:    { type: String },
  marks:  { type: Number, default: null },
  absent: { type: Boolean, default: false }
}, { _id: false });

const examResultSchema = new mongoose.Schema({
  questions:  [questionMarkSchema],
  total:      { type: Number, default: null },
  isAbsent:   { type: Boolean, default: false }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  totalConducted:    { type: Number, default: null },
  attended:          { type: Number, default: null },
  percentage:        { type: Number, default: null },
  marks:             { type: Number, default: null },   // /5, auto-computed
  medicalCondonation:{ type: Boolean, default: false }  // college-approved medical exemption
}, { _id: false });

const theoryMarksSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  academicYear: { type: String, default: '2025-26' },

  ct1:   { type: examResultSchema, default: () => ({}) },
  ct2:   { type: examResultSchema, default: () => ({}) },
  asgn1: { type: examResultSchema, default: () => ({}) },
  asgn2: { type: examResultSchema, default: () => ({}) },
  st1:   { type: examResultSchema, default: () => ({}) },
  st2:   { type: examResultSchema, default: () => ({}) },
  st3:   { type: examResultSchema, default: () => ({}) },
  attendance: { type: attendanceSchema, default: () => ({}) },

  computed: {
    ctAvg:    { type: Number, default: null },
    asgnAvg:  { type: Number, default: null },
    stAvg:    { type: Number, default: null },
    attMarks: { type: Number, default: null },
    total:    { type: Number, default: null }
  },

  status: { type: String, enum: ['draft','submitted','approved'], default: 'draft' }
}, { timestamps: true });

theoryMarksSchema.index({ student: 1, subject: 1, academicYear: 1 }, { unique: true });

// ── ATTENDANCE FORMULA ─────────────────────────────────────────────────────
// ≥85%          → 5 marks
// ≥80% to <85%  → 4 marks
// ≥75% to <80%  → 3 marks
// ≥70% to <75%  → 2 marks
// <70%           → 0 marks (detained) — unless medical condonation
// Medical condonation (≥60% to <70%) → 1 mark (college discretion)
// <60% even with medical → 0 marks (no entitlement)
const attMarksFromPct = (pct, medical = false) => {
  if (pct >= 85) return 5;
  if (pct >= 80) return 4;
  if (pct >= 75) return 3;
  if (pct >= 70) return 2;
  if (medical && pct >= 60) return 1;  // medical condonation: college discretion
  return 0;
};

theoryMarksSchema.methods.compute = function() {
  const ceil = n => Math.ceil(n);
  const avg2 = (a, b) => {
    const vals = [a, b].filter(v => v !== null && v !== undefined);
    return vals.length === 2 ? (vals[0] + vals[1]) / 2 : vals.length === 1 ? vals[0] : null;
  };

  // CT avg → ceil → /20
  const ct1 = this.ct1?.isAbsent ? 0 : (this.ct1?.total ?? null);
  const ct2 = this.ct2?.isAbsent ? 0 : (this.ct2?.total ?? null);
  const ctRaw = avg2(ct1, ct2);
  this.computed.ctAvg = ctRaw !== null ? ceil(ctRaw) : null;

  // Assignment avg → ceil → /10
  const a1 = this.asgn1?.isAbsent ? 0 : (this.asgn1?.total ?? null);
  const a2 = this.asgn2?.isAbsent ? 0 : (this.asgn2?.total ?? null);
  const asgnRaw = avg2(a1, a2);
  this.computed.asgnAvg = asgnRaw !== null ? ceil(asgnRaw) : null;

  // ST best 2 of 3 → avg → ceil → /5
  const sts = [
    this.st1?.isAbsent ? 0 : this.st1?.total,
    this.st2?.isAbsent ? 0 : this.st2?.total,
    this.st3?.isAbsent ? 0 : this.st3?.total
  ].filter(v => v !== null && v !== undefined);
  if (sts.length >= 2) {
    const best2 = sts.sort((a, b) => b - a).slice(0, 2);
    this.computed.stAvg = ceil((best2[0] + best2[1]) / 2);
  } else if (sts.length === 1) {
    this.computed.stAvg = ceil(sts[0]);
  }

  // Attendance → /5
  if (this.attendance?.percentage !== null && this.attendance?.percentage !== undefined) {
    const pct    = this.attendance.percentage;
    const medic  = this.attendance.medicalCondonation || false;
    const marks  = attMarksFromPct(pct, medic);
    this.computed.attMarks   = marks;
    this.attendance.marks    = marks;
  } else {
    this.computed.attMarks = this.attendance?.marks ?? null;
  }

  // CIE Total /40
  const parts = [this.computed.ctAvg, this.computed.asgnAvg, this.computed.stAvg, this.computed.attMarks];
  if (parts.some(p => p !== null)) {
    this.computed.total = parts.reduce((s, p) => s + (p ?? 0), 0);
  }
};

module.exports = mongoose.model('TheoryMarks', theoryMarksSchema);
