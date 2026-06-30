const router  = require('express').Router();
const { protect, studentOnly } = require('../middleware/auth');
const Subject     = require('../models/Subject');
const Teacher     = require('../models/Teacher');
const TheoryMarks = require('../models/TheoryMarks');
const LabMarks    = require('../models/LabMarks');
const MentoringRecord = require('../models/MentoringRecord');

const auth = [protect, studentOnly];

// ── MY SUBJECTS ───────────────────────────────────────────────────────────
router.get('/my-subjects', auth, async (req, res) => {
  try {
    if (req.user.status === 'Graduated') return res.json([]);
    const { program, branch, semester } = req.user;
    const subjects = await Subject.find({
      program, department: branch, semester,
      $or: [
        { type: { $in: ['theory','lab','none'] } },
        { type: 'elective', _id: { $in: req.user.electives || [] } }
      ]
    }).populate('sectionTeachers.teacher','name designation')
      .populate('batchTeachers.teacher','name');
    res.json(subjects);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MY MARKS ──────────────────────────────────────────────────────────────
router.get('/my-marks', auth, async (req, res) => {
  try {
    const [theory, lab] = await Promise.all([
      TheoryMarks.find({ student: req.user._id, status: { $in: ['submitted','approved'] } }).populate('teacher','name')
        .populate('subject','name code type semester')
        .populate('teacher','name')
        .lean(),
      LabMarks.find({ student: req.user._id, status: { $in: ['submitted','approved'] } }).populate('teacher','name')
        .populate('subject','name code type semester')
        .populate('teacher','name')
        .lean()
    ]);
    res.json({ theory, lab });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MY TEACHERS ───────────────────────────────────────────────────────────
router.get('/my-teachers', auth, async (req, res) => {
  try {
    const { program, branch, semester, section } = req.user;
    const subjects = await Subject.find({ program, department: branch, semester })
      .populate('sectionTeachers.teacher','name employeeId designation department')
      .populate('batchTeachers.teacher','name employeeId designation');
    const teacherMap = {};
    subjects.forEach(s => {
      s.sectionTeachers?.forEach(st => {
        if (!st.teacher) return;
        if (section && st.section !== section) return;
        const t = st.teacher;
        if (!teacherMap[t._id]) teacherMap[t._id] = { teacher: t, subjects: [] };
        teacherMap[t._id].subjects.push({ name: s.name, code: s.code, type: s.type, section: st.section });
      });
      s.batchTeachers?.forEach(bt => {
        if (!bt.teacher) return;
        if (section && bt.section !== section) return;
        const t = bt.teacher;
        if (!teacherMap[t._id]) teacherMap[t._id] = { teacher: t, subjects: [] };
        teacherMap[t._id].subjects.push({ name: s.name, code: s.code, type: 'lab', batch: bt.batch, section: bt.section });
      });
    });
    res.json(Object.values(teacherMap));
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MY MENTOR ─────────────────────────────────────────────────────────────
router.get('/my-mentor', auth, async (req, res) => {
  try {
    const rec = await MentoringRecord.findOne({ student: req.user._id })
      .populate('mentor','name employeeId designation phone email');
    res.json(rec);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── AVAILABLE ELECTIVES ───────────────────────────────────────────────────
router.get('/electives', auth, async (req, res) => {
  try {
    const { program, branch, semester } = req.user;
    const electives = await Subject.find({ program, department: branch, semester, type: 'elective' })
      .populate('assignedTeacher','name department');
    res.json(electives);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ENROLL / UNENROLL ELECTIVE ────────────────────────────────────────────
router.post('/electives/enroll', auth, async (req, res) => {
  try {
    const { subjectId, action } = req.body;
    const Student = require('../models/Student');
    if (action === 'enroll') {
      await Student.findByIdAndUpdate(req.user._id, { $addToSet: { electives: subjectId } });
    } else {
      await Student.findByIdAndUpdate(req.user._id, { $pull: { electives: subjectId } });
    }
    const updated = await Student.findById(req.user._id).select('-password');
    res.json(updated);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MY SUPPLIES & STATUS ──────────────────────────────────────────────────
router.get('/my-status', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .select('-password')
      .populate('supplies.subject', 'name code semester type');
    res.json({
      status: student.status,
      supplies: student.supplies || [],
      semester: student.semester,
      program: student.program
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT ACTIVITY POINTS — semester-wise + total ──────────────────────
router.get('/activity-points', auth, async (req, res) => {
  try {
    const MentoringRecord = require('../models/MentoringRecord');
    const records = await MentoringRecord.find({ student: req.user._id })
      .select('semester academicYear activityPoints')
      .sort({ semester: 1 });

    const semPoints = records.map(r => ({
      semester:       r.semester,
      academicYear:   r.academicYear,
      activityPoints: r.activityPoints ?? 0
    }));

    const total    = semPoints.reduce((s, r) => s + (r.activityPoints || 0), 0);
    const achieved = total >= 60;

    res.json({ semPoints, total, achieved, required: 60 });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
