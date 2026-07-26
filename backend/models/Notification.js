const mongoose = require('mongoose');

// One document per recipient. Created in bulk (insertMany) when an event fires.
const notificationSchema = new mongoose.Schema({
  recipient:      { type: mongoose.Schema.Types.ObjectId, refPath: 'recipientModel', required: true },
  recipientModel: { type: String, enum: ['Student','Teacher'], required: true },

  type:  { type: String, enum: [
    'marks_published','sliptest_published','sliptest_result',
    'assignment_posted','assignment_graded',
    'elective_open','elective_result',
    'detention_applied','detention_lifted',
    'promotion','announcement'
  ], required: true },

  title: { type: String, required: true },
  body:  { type: String, default: '' },
  link:  { type: String, default: '' },     // in-app route to jump to
  icon:  { type: String, default: '🔔' },

  read:   { type: Boolean, default: false },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
