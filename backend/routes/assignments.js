const router     = require('express').Router();

// Get current academic year from system config
const getAcademicYear = () => {
  try {
    const configPath = require('path').join(__dirname,'../config.json');
    return JSON.parse(require('fs').readFileSync(configPath,'utf8')).academicYear || '2025-26';
  } catch { return process.env.ACADEMIC_YEAR || '2025-26'; }
};

const multer     = require('multer');
const { protect, teacherOnly, studentOnly, activeStudentOnly } = require('../middleware/auth');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Subject    = require('../models/Subject');
const Student    = require('../models/Student');
const { uploadBuffer, deleteFile, isConfigured, inlineUrl, viewableUrl } = require('../utils/cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf','image/jpeg','image/png','image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── TEACHER: create or update an assignment/sliptest post ─────────────────────
router.post('/teacher/assignments', protect, teacherOnly, upload.single('attachment'), async (req, res) => {
  try {
    const { subjectId, title, description, dueDate, type, slotNo, formLink, mode } = req.body;
    const academicYear = req.body.academicYear || getAcademicYear();

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    // Build the document
    const doc = {
      subject: subjectId, teacher: req.user._id,
      title, description, dueDate: dueDate || null,
      type, slotNo: Number(slotNo),
      formLink: formLink || '',
      mode: mode || 'mixed',
      academicYear
    };

    // Attach question paper if uploaded
    if (req.file) {
      if (!isConfigured()) return res.status(503).json({ message: 'Cloudinary not configured. Add credentials to .env' });
      const safeName1 = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_');
      const result = await uploadBuffer(req.file.buffer, {
        public_id:        `evalpro/qpapers/${subjectId}_${type}${slotNo}_${Date.now()}_${safeName1}`,
        use_filename:     true,
        unique_filename:  false,
        original_filename: safeName1
      });
      // Hard validate — never store false/undefined as URL
      if (!result || !result.secure_url || typeof result.secure_url !== 'string' || !result.secure_url.startsWith('http')) {
        return res.status(500).json({ message: 'File upload failed — Cloudinary did not return a valid URL. Check your Cloudinary credentials in .env' });
      }
      doc.attachmentUrl  = inlineUrl(result.secure_url, req.file.originalname);
      doc.attachmentName = req.file.originalname;
    }

    // Upsert: one active assignment per slot per subject per year
    const assignment = await Assignment.findOneAndUpdate(
      { subject: subjectId, type, slotNo: Number(slotNo), academicYear },
      doc,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(assignment);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: get all assignments for my subjects ───────────────────────────────
router.get('/teacher/assignments', protect, teacherOnly, async (req, res) => {
  try {
    const { subjectId, academicYear = '2025-26' } = req.query;
    const q = { teacher: req.user._id, academicYear };
    if (subjectId) q.subject = subjectId;
    const assignments = await Assignment.find(q)
      .populate('subject', 'name code type semester section program')
      .sort({ subject: 1, type: 1, slotNo: 1 });
    res.json(assignments);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: get one assignment ───────────────────────────────────────────────
router.get('/teacher/assignments/:id', protect, teacherOnly, async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).populate('subject','name code');
    if (!a) return res.status(404).json({ message: 'Not found' });
    res.json(a);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: delete an assignment post ────────────────────────────────────────
router.delete('/teacher/assignments/:id', protect, teacherOnly, async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id);
    if (!a) return res.status(404).json({ message: 'Not found' });
    // Delete all submissions' Cloudinary files
    const subs = await Submission.find({ assignment: req.params.id });
    for (const s of subs) { if (s.publicId) await deleteFile(s.publicId).catch(()=>{}); }
    await Submission.deleteMany({ assignment: req.params.id });
    await a.deleteOne();
    res.json({ message: 'Assignment deleted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: get all submissions for an assignment ────────────────────────────
router.get('/teacher/assignments/:id/submissions', protect, teacherOnly, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('subject');
    if (!assignment) return res.status(404).json({ message: 'Not found' });

    // Get all students in this subject
    const sub = assignment.subject;
    const students = await Student.find({
      program: sub.program, branch: sub.department,
      semester: sub.semester, section: sub.section
    }).select('name usn labBatch').sort({ usn: 1 });

    // Get all submissions
    const submissions = await Submission.find({ assignment: req.params.id });
    const subMap = {};
    submissions.forEach(s => { subMap[s.student.toString()] = s; });

    // Merge: every student appears, with their submission (or null)
    const result = students.map(s => ({
      student: { id: s._id, name: s.name, usn: s.usn, labBatch: s.labBatch },
      submission: subMap[s._id.toString()] || null
    }));

    res.json({
      assignment,
      result,
      stats: {
        total: students.length,
        online:  submissions.filter(s=>s.method==='online').length,
        offline: submissions.filter(s=>s.method==='offline').length,
        notSubmitted: students.length - submissions.length
      }
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: mark a student as submitted offline ──────────────────────────────
router.post('/teacher/assignments/:id/mark-offline', protect, teacherOnly, async (req, res) => {
  try {
    const { studentId, received } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Not found' });

    if (received) {
      // Upsert offline submission record
      await Submission.findOneAndUpdate(
        { assignment: req.params.id, student: studentId },
        { assignment: req.params.id, student: studentId, method: 'offline',
          markedByTeacher: true, isLate: new Date() > assignment.dueDate,
          submittedAt: new Date() },
        { upsert: true, new: true }
      );
    } else {
      // Remove the offline mark
      await Submission.deleteOne({ assignment: req.params.id, student: studentId, method: 'offline' });
    }
    res.json({ message: received ? 'Marked as received' : 'Mark removed' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: get assignments for my subjects ──────────────────────────────────
router.get('/student/assignments', protect, studentOnly, async (req, res) => {
  try {
    // Find all subjects for this student's program/branch/sem/section
    // Only show assignments for current semester subjects
    // (after promotion, old semester assignments no longer appear)
    const subjects = await Subject.find({
      program: req.user.program, department: req.user.branch,
      semester: req.user.semester
    }).select('_id');
    const subjectIds = subjects.map(s => s._id);

    const assignments = await Assignment.find({
      subject: { $in: subjectIds },
      isActive: true
    }).populate('subject','name code type')
      .populate('teacher','name')
      .sort({ dueDate: 1 });

    // Attach each student's own submission status
    const result = await Promise.all(assignments.map(async a => {
      const submission = await Submission.findOne({ assignment: a._id, student: req.user._id });
      return {
        assignment: a,
        submission: submission || null,
        isOverdue: a.dueDate ? new Date() > a.dueDate : false
      };
    }));

    res.json(result);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: submit a file online ─────────────────────────────────────────────
router.post('/student/assignments/:id/submit', protect, activeStudentOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!isConfigured()) return res.status(503).json({ message: 'File uploads not configured yet. Submit physically to your teacher.' });

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (!assignment.isActive) return res.status(400).json({ message: 'Assignment is closed' });

    // Check if offline-only
    if (assignment.mode === 'offline')
      return res.status(400).json({ message: 'This assignment requires physical submission only' });

    // Sanitise filename for use in public_id
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Upload to Cloudinary
    const result = await uploadBuffer(req.file.buffer, {
      public_id:        `evalpro/submissions/${assignment._id}_${req.user._id}_${Date.now()}_${safeName}`,
      use_filename:     true,
      unique_filename:  false,
      original_filename: safeName
    });

    // Hard validate Cloudinary returned a real URL — never store false/undefined
    if (!result || !result.secure_url || typeof result.secure_url !== 'string' || !result.secure_url.startsWith('http')) {
      return res.status(500).json({ message: 'File upload failed — Cloudinary did not return a valid URL. Check your Cloudinary credentials in .env' });
    }

    const isLate = assignment.dueDate ? new Date() > assignment.dueDate : false;

    // Delete old Cloudinary file if resubmitting
    const existing = await Submission.findOne({ assignment: req.params.id, student: req.user._id });
    if (existing?.publicId) await deleteFile(existing.publicId).catch(() => {});

    const submission = await Submission.findOneAndUpdate(
      { assignment: req.params.id, student: req.user._id },
      {
        method:      'online',
        fileUrl:     inlineUrl(result.secure_url, req.file.originalname),
        fileName:    req.file.originalname,
        fileSize:    req.file.size,
        publicId:    result.public_id,
        isLate,
        submittedAt: new Date(),
        status:      existing ? 'resubmitted' : 'submitted'
      },
      { upsert: true, new: true }
    );
    res.json({ submission, isLate });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: retract online submission (before deadline) ──────────────────────
router.delete('/student/assignments/:id/submission', protect, activeStudentOnly, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (assignment?.dueDate && new Date() > assignment.dueDate)
      return res.status(400).json({ message: 'Cannot retract after the deadline' });
    const sub = await Submission.findOne({ assignment: req.params.id, student: req.user._id });
    if (!sub) return res.status(404).json({ message: 'No submission found' });
    if (sub.publicId) await deleteFile(sub.publicId).catch(()=>{});
    await sub.deleteOne();
    res.json({ message: 'Submission retracted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
