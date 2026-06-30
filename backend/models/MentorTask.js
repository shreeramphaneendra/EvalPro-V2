const mongoose = require('mongoose');

// Admin configures what mentor marks are required for a given semester/program/year
// e.g. Sem 6, B.Tech, 2025-26 → internship (max 25) + activity points (always)
const mentorTaskSchema = new mongoose.Schema({
  department:   { type: String, required: true },
  program:      { type: String, required: true },
  semester:     { type: Number, required: true },
  academicYear: { type: String, required: true },
  components: [{
    key:      { type: String, required: true },  // 'activityPoints', 'internship', 'upskilling', 'custom'
    label:    { type: String, required: true },  // display name
    maxMarks: { type: Number, required: true },
    mandatory:{ type: Boolean, default: true },
    description:{ type: String, default: '' }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
}, { timestamps: true });

mentorTaskSchema.index({ department:1, program:1, semester:1, academicYear:1 }, { unique: true });
module.exports = mongoose.model('MentorTask', mentorTaskSchema);
