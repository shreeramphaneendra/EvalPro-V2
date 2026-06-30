const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student',    required: true },

  // How was it submitted?
  method:     { type: String, enum: ['online', 'offline'], required: true },

  // Online submission — Cloudinary file details
  fileUrl:  {
    type: String,
    default: '',
    validate: {
      validator: function(v) {
        // If set, must be a real URL — never allow 'false', 'undefined', or empty non-string
        if (!v) return true; // empty is fine (offline submission)
        return typeof v === 'string' && v.startsWith('http');
      },
      message: 'fileUrl must be a valid HTTP URL'
    }
  },
  fileName:   { type: String, default: '' },
  fileSize:   { type: Number, default: 0 },  // bytes
  publicId:   { type: String, default: '' },  // Cloudinary public_id for deletion

  // Offline — teacher manually marks as received
  markedByTeacher: { type: Boolean, default: false },

  isLate:     { type: Boolean, default: false },
  submittedAt:{ type: Date, default: Date.now }
}, { timestamps: true });

// One submission record per student per assignment
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
