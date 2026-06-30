const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  qNo:          { type: Number, required: true },
  type:         { type: String, enum: ['mcq','short'] },
  selectedOption:{ type: Number, default: null }, // for MCQ: index chosen
  textAnswer:   { type: String, default: '' },    // for short answer
  isCorrect:    { type: Boolean, default: null }, // null = not yet graded
  marksAwarded: { type: Number, default: null },  // null = not graded
  maxMarks:     { type: Number },
});

const violationSchema = new mongoose.Schema({
  type:      { type: String }, // 'tab_switch', 'window_blur', 'fullscreen_exit', 'copy_paste'
  timestamp: { type: Date, default: Date.now },
  detail:    { type: String, default: '' },
});

const slipTestAttemptSchema = new mongoose.Schema({
  slipTest:      { type: mongoose.Schema.Types.ObjectId, ref: 'SlipTest', required: true },
  student:       { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject:       { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  slot:          { type: String, enum: ['ST1','ST2','ST3'] },
  answers:       [answerSchema],
  violations:    [violationSchema],
  violationCount:{ type: Number, default: 0 },
  startTime:     { type: Date },
  submitTime:    { type: Date },
  timeSpent:     { type: Number, default: 0 }, // seconds
  autoSubmitted: { type: Boolean, default: false },
  autoSubmitReason: { type: String, default: '' }, // 'tab_switch', 'time_up', 'violations'
  status:        { type: String, enum: ['not_started','in_progress','submitted'], default: 'not_started' },
  // Scoring
  mcqScore:      { type: Number, default: null }, // auto-calculated for MCQ
  shortScore:    { type: Number, default: null }, // manually entered by teacher
  totalRaw:      { type: Number, default: null }, // mcqScore + shortScore
  scaledScore:   { type: Number, default: null }, // scaled to /5
  graded:        { type: Boolean, default: false },
  // CIE integration
  pushedToCIE:   { type: Boolean, default: false },
}, { timestamps: true });

slipTestAttemptSchema.index({ slipTest: 1, student: 1 }, { unique: true });
module.exports = mongoose.model('SlipTestAttempt', slipTestAttemptSchema);
