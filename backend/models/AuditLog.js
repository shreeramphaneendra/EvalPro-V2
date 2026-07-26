const mongoose = require('mongoose');

// Immutable record of who changed what and when.
// Written on every consequential action so mark disputes can be traced.
const auditLogSchema = new mongoose.Schema({
  actor:       { type: mongoose.Schema.Types.ObjectId, refPath: 'actorModel' },
  actorModel:  { type: String, enum: ['Teacher','Student'], default: 'Teacher' },
  actorName:   { type: String, required: true },   // denormalised — survives deletion
  actorRole:   { type: String, enum: ['admin','teacher','student','system'], default: 'teacher' },

  action:      { type: String, required: true },   // 'marks.publish', 'student.detain', ...
  category:    { type: String, enum: ['marks','student','teacher','subject','sliptest','elective','mentor','system','auth'], default: 'system' },
  severity:    { type: String, enum: ['info','warning','critical'], default: 'info' },

  targetType:  { type: String, default: '' },      // 'Student', 'Subject', ...
  targetId:    { type: mongoose.Schema.Types.ObjectId, default: null },
  targetLabel: { type: String, default: '' },      // human-readable, e.g. "Sujal (160124737058)"

  description: { type: String, required: true },
  before:      { type: mongoose.Schema.Types.Mixed, default: null },
  after:       { type: mongoose.Schema.Types.Mixed, default: null },

  department:   { type: String, default: '' },
  academicYear: { type: String, default: '' },
  ip:           { type: String, default: '' },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ department: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
