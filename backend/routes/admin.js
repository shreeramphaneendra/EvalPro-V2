const router  = require('express').Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const getGemini = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const multer  = require('multer');
const XLSX    = require('xlsx');
const { protect, adminOnly } = require('../middleware/auth');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const MentoringRecord = require('../models/MentoringRecord');
const TheoryMarks = require('../models/TheoryMarks');
const MentorTask  = require('../models/MentorTask');
const LabMarks    = require('../models/LabMarks');

const upload = multer({ storage: multer.memoryStorage() });
const auth = [protect, adminOnly];

// Helper: the department + programs this admin is scoped to.
const scopeOf = (req) => ({
  department: req.user.department,
  programs:   (req.user.programs && req.user.programs.length) ? req.user.programs : ['B.Tech']
});

// ── TEACHERS (scoped to admin's department) ────────────────────────────────
router.get('/teachers', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    res.json(await Teacher.find({ department }).select('-password').sort({ name: 1 }));
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/teachers', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const { name, employeeId, email, password, designation, phone, canBeMentor, isAdmin } = req.body;
    const exists = await Teacher.findOne({ $or: [{ email }, { employeeId: employeeId?.toUpperCase() }] });
    if (exists) return res.status(400).json({ message: 'Teacher already exists' });
    // Teacher belongs to the admin's department
    const teacher = await Teacher.create({
      name, employeeId, email, password: password || employeeId,
      department, designation, phone, canBeMentor,
      isAdmin: !!isAdmin,
      programs: isAdmin ? programs : ['B.Tech']
    });
    res.status(201).json({ ...teacher.toObject(), password: undefined });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.put('/teachers/:id', auth, async (req, res) => {
  try {
    const { name, designation, phone, canBeMentor, isAdmin } = req.body;
    const upd = { name, designation, phone, canBeMentor };
    if (isAdmin !== undefined) upd.isAdmin = !!isAdmin;
    const t = await Teacher.findByIdAndUpdate(req.params.id, upd, { new: true }).select('-password');
    res.json(t);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.delete('/teachers/:id', auth, async (req, res) => {
  try { await Teacher.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENTS (scoped to admin's department + programs) ─────────────────────
router.get('/students', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const { semester, section, program, status } = req.query;
    const q = { branch: department, program: { $in: programs } };
    if (program)  q.program  = program;          // optional narrower filter
    if (semester) q.semester = Number(semester);
    if (section)  q.section  = String(section);
    if (status)   q.status   = status;
    res.json(await Student.find(q).select('-password').sort({ program: 1, semester: 1, section: 1, usn: 1 }));
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/students', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { name, usn, program, semester, section, labBatch, mentoringBatch, phone } = req.body;
    const usnUpper = usn?.toUpperCase();
    if (!usnUpper || !name) return res.status(400).json({ message: 'USN and Name are required' });
    const exists = await Student.findOne({ usn: usnUpper });
    if (exists) return res.status(400).json({ message: 'Student already exists' });
    const student = await Student.create({
      name, usn: usnUpper, password: usnUpper,
      program: program || 'B.Tech', branch: department,
      semester: Number(semester), section: String(section),
      labBatch, mentoringBatch: mentoringBatch?.trim().toUpperCase(), phone
    });
    res.status(201).json({ ...student.toObject(), password: undefined });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.put('/students/:id', auth, async (req, res) => {
  try {
    const { name, labBatch, mentoringBatch, section, semester, program, phone } = req.body;
    const upd = { name, labBatch, mentoringBatch, phone };
    if (section  !== undefined) upd.section  = String(section);
    if (semester !== undefined) upd.semester = Number(semester);
    if (program  !== undefined) upd.program  = program;
    const s = await Student.findByIdAndUpdate(req.params.id, upd, { new: true }).select('-password');
    res.json(s);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.delete('/students/:id', auth, async (req, res) => {
  try { await Student.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch(e) { res.status(500).json({ message: e.message }); }
});

// ── BULK IMPORT STUDENTS via CSV/Excel ─────────────────────────────────────
router.post('/students/bulk-import', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { department, programs } = scopeOf(req);

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const created = [], errors = [];

    for (const row of rows) {
      try {
        const usn     = String(row['USN'] || row['usn'] || '').trim().toUpperCase();
        const name    = String(row['Name'] || row['name'] || row['NAME'] || '').trim();
        const program = String(row['Program'] || row['program'] || row['PROGRAM'] || 'B.Tech').trim();
        const sem     = Number(row['Semester'] || row['semester'] || row['SEM'] || 0);
        const sec     = String(row['Section'] || row['section'] || '1').trim();
        const labBatch= String(row['LabBatch'] || row['labBatch'] || row['Lab Batch'] || 'B1').trim();
        const menBatch= String(row['MentoringBatch'] || row['Mentoring Batch'] || '').trim().toUpperCase();

        if (!usn || !name || !sem) {
          errors.push({ row: usn || name || '(blank)', reason: 'Missing required fields (USN / Name / Semester)' }); continue;
        }
        if (!programs.includes(program)) {
          errors.push({ row: usn, reason: `Program "${program}" is outside your scope (${programs.join(', ')})` }); continue;
        }

        const exists = await Student.findOne({ usn });
        if (exists) { errors.push({ row: usn, reason: 'Already exists' }); continue; }

        await Student.create({
          name, usn, password: usn,
          program, branch: department,
          semester: sem, section: sec, labBatch, mentoringBatch: menBatch
        });
        created.push(usn);
      } catch(rowErr) {
        errors.push({ row: JSON.stringify(row).slice(0,40), reason: rowErr.message });
      }
    }

    res.json({ created: created.length, errors: errors.length, errorDetails: errors, createdList: created });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── SUBJECTS (scoped to admin's department + programs) ─────────────────────
router.get('/subjects', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const { semester, program } = req.query;
    const q = { department, program: { $in: programs } };
    if (program)  q.program  = program;
    if (semester) q.semester = Number(semester);
    res.json(await Subject.find(q)
      .populate('sectionTeachers.teacher', 'name employeeId')
      .populate('batchTeachers.teacher',   'name employeeId')
      .sort({ program: 1, semester: 1, name: 1 }));
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/subjects', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { name, code, type, program, semester, credits, academicYear, electiveGroup } = req.body;
    // Prevent duplicate subject (same code + program + dept + semester + year)
    const exists = await Subject.findOne({ code: code?.toUpperCase(), program, department, semester: Number(semester), academicYear: academicYear || '2025-26' });
    if (exists) return res.status(400).json({ message: `Subject ${code} already exists for ${program} Sem ${semester}` });
    const subject = await Subject.create({
      name, code, type,
      program: program || 'B.Tech', department,
      semester: Number(semester),
      credits, academicYear: academicYear || '2025-26',
      electiveGroup: electiveGroup || null
    });
    res.status(201).json(subject);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// Assign teachers to sections (theory) or section+batch (lab)
router.put('/subjects/:id/assign', auth, async (req, res) => {
  try {
    const { sectionTeachers, batchTeachers, electiveTeachers } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const update = {};
    if (subject.type === 'lab') {
      // Deduplicate: one teacher per section+batch
      const seen = new Set();
      update.batchTeachers = (batchTeachers || []).filter(bt => {
        const key = `${bt.section}-${bt.batch}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    } else if (subject.type === 'elective') {
      update.electiveTeachers = electiveTeachers || [];
    } else {
      // Deduplicate: one teacher per section
      const seen = new Set();
      update.sectionTeachers = (sectionTeachers || []).filter(st => {
        if (seen.has(st.section)) return false;
        seen.add(st.section); return true;
      });
    }

    const s = await Subject.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('sectionTeachers.teacher',  'name employeeId')
      .populate('batchTeachers.teacher',    'name employeeId')
      .populate('electiveTeachers.teacher', 'name employeeId');
    res.json(s);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.put('/subjects/:id', auth, async (req, res) => {
  try {
    const { isLocked, status, name, code, credits } = req.body;
    const s = await Subject.findByIdAndUpdate(req.params.id,
      { isLocked, status, name, code, credits },
      { new: true }
    ).populate('sectionTeachers.teacher','name')
     .populate('batchTeachers.teacher','name');
    res.json(s);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.delete('/subjects/:id', auth, async (req, res) => {
  try { await Subject.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ASSIGN MENTOR ──────────────────────────────────────────────────────────
router.post('/assign-mentor', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { mentorId, program, semester, section, mentoringBatch } = req.body;
    if (!mentorId)       return res.status(400).json({ message: 'Select a mentor teacher' });
    if (!semester)       return res.status(400).json({ message: 'Semester required' });
    if (!section)        return res.status(400).json({ message: 'Section required' });
    if (!mentoringBatch) return res.status(400).json({ message: 'Mentoring batch required (e.g. M1, M2)' });

    // Deciding factor: Sem + Section + MentoringBatch
    // Each section has multiple batches (M1, M2, M3) — each batch has its own mentor
    const students = await Student.find({
      branch:         department,
      program:        program || 'B.Tech',
      semester:       Number(semester),
      section:        String(section),
      mentoringBatch: mentoringBatch.trim().toUpperCase()
    });

    if (!students.length)
      return res.status(404).json({ message: `No students found in ${program} Sem ${semester} Sec ${section} Batch ${mentoringBatch}` });

    const results = [];
    for (const s of students) {
      // Find existing record for this student in this semester+batch
      let rec = await MentoringRecord.findOne({ student: s._id, semester: Number(semester), mentoringBatch: mentoringBatch.trim().toUpperCase() });
      if (!rec) {
        rec = new MentoringRecord({
          student:        s._id,
          mentor:         mentorId,
          mentoringBatch: mentoringBatch.trim().toUpperCase(),
          program:        program || 'B.Tech',
          branch:         department,
          semester:       Number(semester),
          section:        String(section),
          academicYear:   getConfig().academicYear || '2026-27'
        });
      } else {
        rec.mentor  = mentorId;
        rec.section = String(section);
      }
      await rec.save();
      results.push(rec);
    }
    res.json({ assigned: results.length, semester, section, mentoringBatch, program });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── GET MENTOR ASSIGNMENTS — which sem+sections is each mentor handling ──────
router.get('/mentor-assignments', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { program } = req.query;
    const year = getConfig().academicYear || '2025-26';

    // Get all unique mentor assignments grouped by teacher
    const records = await MentoringRecord.find({ branch: department, academicYear: year })
      .populate('mentor', 'name employeeId designation')
      .select('mentor semester section program student');

    // Group by mentor
    const mentorMap = {};
    records.forEach(r => {
      if (!r.mentor) return;
      const mid = r.mentor._id.toString();
      if (!mentorMap[mid]) {
        mentorMap[mid] = {
          teacher: { _id: r.mentor._id, name: r.mentor.name, employeeId: r.mentor.employeeId, designation: r.mentor.designation },
          assignments: {}
        };
      }
      // Group by Sem + Section + MentoringBatch
      const key = `${r.program}|Sem${r.semester}|Sec${r.section}|${r.mentoringBatch||'M1'}`;
      if (!mentorMap[mid].assignments[key]) mentorMap[mid].assignments[key] = { program: r.program, semester: r.semester, section: r.section, mentoringBatch: r.mentoringBatch||'M1', count: 0 };
      mentorMap[mid].assignments[key].count++;
    });

    const result = Object.values(mentorMap).map(m => ({
      teacher:     m.teacher,
      assignments: Object.values(m.assignments).sort((a,b) => a.semester-b.semester || a.section.localeCompare(b.section) || (a.mentoringBatch||'').localeCompare(b.mentoringBatch||''))
    }));

    res.json(result);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── GET STUDENTS FOR A MENTOR ASSIGNMENT ─────────────────────────────────────
router.get('/mentor-students', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { mentorId, program, semester, section } = req.query;
    const year = getConfig().academicYear || '2025-26';

    const query = {
      mentor:   mentorId,
      semester: Number(semester),
      section:  String(section),
      branch:   department,
    };
    if (req.query.mentoringBatch) query.mentoringBatch = req.query.mentoringBatch;
    const records = await MentoringRecord.find(query)
      .populate('student', 'name usn section semester status labBatch mentoringBatch');

    res.json(records.map(r => ({
      usn:            r.student?.usn,
      name:           r.student?.name,
      section:        r.student?.section,
      semester:       r.student?.semester,
      status:         r.student?.status,
      labBatch:       r.student?.labBatch,
      mentoringBatch: r.student?.mentoringBatch,
      activityPoints: r.activityPoints,
      isDetained:     r.student?.status === 'Detained'
    })));
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STATS (scoped) ──────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const [students, teachers, subjects] = await Promise.all([
      Student.countDocuments({ branch: department, program: { $in: programs } }),
      Teacher.countDocuments({ department }),
      Subject.countDocuments({ department, program: { $in: programs } })
    ]);
    res.json({ students, teachers, subjects, department, programs });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT STATUS: set Active / Detained ──────────────────────────────────
// (Graduated / PendingClearance are set automatically by promotion, but an
//  admin can still correct status manually here.)
router.put('/students/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active','Detained','Graduated','PendingClearance'].includes(status))
      return res.status(400).json({ message: 'Invalid status' });
    const s = await Student.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Student not found' });
    s.status = status;
    await s.save();
    res.json({ ...s.toObject(), password: undefined });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── SUPPLIES: add a backlog subject to a student ───────────────────────────
router.post('/students/:id/supplies', auth, async (req, res) => {
  try {
    const { subjectId } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    // avoid duplicate active supply for same subject
    if (student.supplies.some(s => s.subject?.toString() === subjectId && !s.cleared))
      return res.status(400).json({ message: 'Student already has an active supply for this subject' });
    student.supplies.push({
      subject: subject._id, subjectName: subject.name, subjectCode: subject.code,
      semester: subject.semester, academicYear: subject.academicYear, cleared: false
    });
    await student.save();
    res.json({ ...student.toObject(), password: undefined });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── SUPPLIES: mark a supply cleared (auto-graduate if it was the last one) ──
router.put('/students/:id/supplies/:supplyId/clear', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const supply = student.supplies.id(req.params.supplyId);
    if (!supply) return res.status(404).json({ message: 'Supply not found' });
    supply.cleared = true;
    supply.clearedOn = new Date();
    // If student was waiting only on backlogs to graduate, graduate them now.
    if (student.status === 'PendingClearance' && !student.hasPendingSupplies())
      student.status = 'Graduated';
    await student.save();
    res.json({ ...student.toObject(), password: undefined });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── SUPPLIES: remove a supply entry entirely ───────────────────────────────
router.delete('/students/:id/supplies/:supplyId', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    student.supplies.id(req.params.supplyId)?.deleteOne();
    if (student.status === 'PendingClearance' && !student.hasPendingSupplies())
      student.status = 'Graduated';
    await student.save();
    res.json({ ...student.toObject(), password: undefined });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── PROMOTION: preview a class before promoting ────────────────────────────
// Returns who will be promoted, held (detained), graduated, or pending clearance.
router.get('/promotion/preview', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const { program, semester, section } = req.query;
    if (!program || !semester) return res.status(400).json({ message: 'program and semester required' });
    const { semestersFor } = require('../utils/programs');
    const finalSem = Math.max(...semestersFor(program));

    const q = { branch: department, program, semester: Number(semester) };
    if (section) q.section = String(section);
    const students = await Student.find(q).select('-password').sort({ usn: 1 });

    const plan = students.map(s => {
      const pending = (s.supplies||[]).some(x => !x.cleared);
      if (s.status === 'Detained')      return { student: s, action: 'held',     reason: 'Detained — repeats semester' };
      if (s.status === 'Graduated')     return { student: s, action: 'none',     reason: 'Already graduated' };
      if (Number(semester) >= finalSem) {
        return pending
          ? { student: s, action: 'pending', reason: 'Final semester but has pending supplies' }
          : { student: s, action: 'graduate',reason: 'Completes final semester' };
      }
      return { student: s, action: 'promote', reason: pending ? 'Promoted (carries supplies)' : 'Promoted' };
    });
    res.json({ finalSem, plan });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── PROMOTION: execute ──────────────────────────────────────────────────────

// ── DETAINED STUDENT: REASSIGN TO ANOTHER BATCH ───────────────────────────
// A detained student repeats the semester with the junior batch. Admin moves
// them: new section + mentoring batch, reactivates them so they can register
// electives / take tests with the new batch. Old marks stay untouched
// (year-scoped, never deleted).
router.post('/students/:id/reassign', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { section, mentoringBatch, reactivate = true } = req.body;
    const s = await Student.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Student not found' });
    if (s.branch !== department && !req.user.isAdmin)
      return res.status(403).json({ message: 'Not your department' });

    const changes = [];
    if (section && String(section) !== s.section) {
      changes.push(`section ${s.section} → ${section}`);
      s.section = String(section);
    }
    if (mentoringBatch && mentoringBatch !== s.mentoringBatch) {
      changes.push(`batch ${s.mentoringBatch || '—'} → ${mentoringBatch}`);
      s.mentoringBatch = mentoringBatch;
      // Detach old mentor for the CURRENT semester so the junior batch's
      // mentor assignment (Sem+Section+Batch) picks this student up cleanly
      await MentoringRecord.updateMany(
        { student: s._id, semester: s.semester },
        { $unset: { mentor: 1 } }
      );
    }
    if (reactivate && s.status === 'Detained') {
      changes.push('status Detained → Active');
      s.status = 'Active';
    }
    await s.save();
    res.json({ message: changes.length
      ? `Reassigned: ${changes.join(', ')}. Re-run Assign Mentors for the new batch to link their mentor.`
      : 'No changes made', student: s });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/promotion/execute', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const { program, semester, section, holdIds = [] } = req.body;
    if (!program || !semester) return res.status(400).json({ message: 'program and semester required' });
    const { semestersFor } = require('../utils/programs');
    const finalSem = Math.max(...semestersFor(program));

    const q = { branch: department, program, semester: Number(semester) };
    if (section) q.section = String(section);
    const students = await Student.find(q);

    let promoted = 0, graduated = 0, pending = 0, held = 0;
    for (const s of students) {
      // Manual hold (checkbox) or already detained → stay
      if (holdIds.includes(s._id.toString()) || s.status === 'Detained') { held++; continue; }
      if (s.status === 'Graduated') continue;

      if (Number(semester) >= finalSem) {
        if (s.hasPendingSupplies()) { s.status = 'PendingClearance'; pending++; }
        else { s.status = 'Graduated'; graduated++; }
      } else {
        s.semester = Number(semester) + 1;
        promoted++;
        // Keep mentoring records in sync — same mentor, updated semester + academicYear
        await MentoringRecord.updateMany(
          { student: s._id, semester: Number(semester) },
          { semester: s.semester, academicYear: getConfig().academicYear || '2026-27' }
        );
      }
      await s.save();
    }
    res.json({ promoted, graduated, pending, held });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── RESET STUDENT PASSWORD (back to USN default) ────────────────────────
router.post('/students/:id/reset-password', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    // Reset to USN (uppercase) — student must change on next login
    student.password = student.usn.toUpperCase();
    student.isFirstLogin = true;
    await student.save();
    res.json({ message: `Password reset to ${student.usn}. Student must change it on next login.` });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── SYSTEM CONFIG (academic year, etc.) ─────────────────────────────────
// Store active academic year in a simple JSON file for persistence
const configPath = require('path').join(__dirname,'../config.json');
const getConfig = () => {
  try { return JSON.parse(require('fs').readFileSync(configPath,'utf8')); }
  catch { return { academicYear: process.env.ACADEMIC_YEAR || '2025-26' }; }
};
const saveConfig = (cfg) => {
  require('fs').writeFileSync(configPath, JSON.stringify(cfg, null, 2));
};

router.get('/config', auth, (req, res) => {
  res.json(getConfig());
});

router.put('/config', auth, (req, res) => {
  try {
    const { academicYear } = req.body;
    if (!academicYear || !/^\d{4}-\d{2}$/.test(academicYear))
      return res.status(400).json({ message: 'Invalid format. Use YYYY-YY e.g. 2025-26' });
    const cfg = { ...getConfig(), academicYear };
    saveConfig(cfg);
    res.json({ message: `Academic year updated to ${academicYear}`, config: cfg });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MARK ENTRY DEADLINE ────────────────────────────────────────────────────
router.put('/subjects/:id/deadline', auth, async (req, res) => {
  try {
    const { deadline } = req.body;
    const s = await Subject.findByIdAndUpdate(
      req.params.id,
      { markEntryDeadline: deadline ? new Date(deadline) : null },
      { new: true }
    );
    res.json({ message: deadline ? `Deadline set to ${new Date(deadline).toLocaleDateString()}` : 'Deadline cleared', subject: s });
  } catch(e) { res.status(500).json({ message: e.message }); }
});
// ── RESET TEACHER PASSWORD (back to employeeId default) ──────────────────
router.post('/teachers/:id/reset-password', auth, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    teacher.password = teacher.employeeId.toUpperCase();
    teacher.isFirstLogin = true;
    await teacher.save();
    res.json({ message: `Password reset to Employee ID: ${teacher.employeeId}. Teacher must change on next login.` });
  } catch(e) { res.status(500).json({ message: e.message }); }
});


// ── HOD OVERVIEW — detailed department stats for admin/HOD ────────────────
router.get('/hod-overview', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const year = getConfig().academicYear || '2025-26';

    // Students by status
    const [totalStudents, detainedCount, pendingClearance, activeStudents] = await Promise.all([
      Student.countDocuments({ branch: department, program: { $in: programs } }),
      Student.countDocuments({ branch: department, program: { $in: programs }, status: 'Detained' }),
      Student.countDocuments({ branch: department, program: { $in: programs }, status: 'PendingClearance' }),
      Student.countDocuments({ branch: department, program: { $in: programs }, status: 'Active' }),
    ]);

    // Teachers
    const totalTeachers = await Teacher.countDocuments({ department });

    // Subjects
    const subjects = await Subject.find({ department, program: { $in: programs } });
    const totalSubjects = subjects.length;

    // Marks publication status per subject
    const subjectStatus = [];
    for (const sub of subjects) {
      const [tCount, tPublished, lCount, lPublished] = await Promise.all([
        TheoryMarks.countDocuments({ subject: sub._id, academicYear: year }),
        TheoryMarks.countDocuments({ subject: sub._id, academicYear: year, status: { $in: ['submitted','approved'] } }),
        LabMarks.countDocuments({ subject: sub._id, academicYear: year }),
        LabMarks.countDocuments({ subject: sub._id, academicYear: year, status: { $in: ['submitted','approved'] } }),
      ]);
      const totalMarks = tCount + lCount;
      const published  = tPublished + lPublished;
      const hasDeadline = !!sub.markEntryDeadline;
      const deadlinePassed = hasDeadline && new Date() > new Date(sub.markEntryDeadline);
      const deadlineSoon   = hasDeadline && !deadlinePassed &&
        Math.ceil((new Date(sub.markEntryDeadline) - new Date()) / (1000*60*60*24)) <= 3;

      subjectStatus.push({
        id:   sub._id,
        name: sub.name,
        code: sub.code,
        type: sub.type,
        semester: sub.semester,
        totalMarks,
        published,
        deadline: sub.markEntryDeadline,
        deadlinePassed,
        deadlineSoon,
        status: published > 0 && published >= totalMarks ? 'published'
              : totalMarks > 0 ? 'in-progress'
              : 'not-started'
      });
    }

    // Attendance risk — students with <70% in any subject
    const lowAttendance = await TheoryMarks.find({
      academicYear: year,
      'attendance.percentage': { $lt: 70, $ne: null },
      'attendance.medicalCondonation': { $ne: true }
    }).populate('student', 'name usn section branch program')
      .populate('subject', 'name code semester');

    const atRisk = lowAttendance
      .filter(m => programs.includes(m.student?.program) && m.student?.branch === department)
      .map(m => ({
        student: { name: m.student?.name, usn: m.student?.usn, section: m.student?.section },
        subject: { name: m.subject?.name, code: m.subject?.code, semester: m.subject?.semester },
        attendance: m.attendance?.percentage
      }));

    res.json({
      academicYear: year,
      students: { total: totalStudents, active: activeStudents, detained: detainedCount, pendingClearance },
      teachers:  { total: totalTeachers },
      subjects:  { total: totalSubjects, published: subjectStatus.filter(s=>s.status==='published').length, inProgress: subjectStatus.filter(s=>s.status==='in-progress').length, notStarted: subjectStatus.filter(s=>s.status==='not-started').length },
      subjectStatus,
      atRisk,
      deadlineAlerts: subjectStatus.filter(s => s.deadlinePassed || s.deadlineSoon)
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── AI: DEPARTMENT REPORT GENERATOR ──────────────────────────────────────
router.post('/ai/department-report', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const year = getConfig().academicYear || '2025-26';

    // Gather all data
    const [students, teachers, subjects, theoryMarks, labMarks] = await Promise.all([
      Student.find({ branch: department, program: { $in: programs } }),
      Teacher.find({ department }),
      Subject.find({ department, program: { $in: programs } }),
      TheoryMarks.find({ academicYear: year }).populate('subject', 'name code semester'),
      LabMarks.find({ academicYear: year }).populate('subject', 'name code semester'),
    ]);

    // Build stats summary for AI
    const detained  = students.filter(s => s.status === 'Detained').length;
    const graduated = students.filter(s => s.status === 'Graduated').length;
    const supplies  = students.filter(s => (s.supplies||[]).some(x=>!x.cleared)).length;

    const publishedTheory = theoryMarks.filter(m => m.status === 'submitted');
    const avgCIE = publishedTheory.length
      ? (publishedTheory.reduce((s,m) => s + (m.computed?.total||0), 0) / publishedTheory.length).toFixed(1)
      : 'N/A';

    const attRisk = theoryMarks.filter(m =>
      m.attendance?.percentage != null && m.attendance.percentage < 70 &&
      !m.attendance.medicalCondonation
    ).length;

    const subjectStats = subjects.map(sub => {
      const tm = theoryMarks.filter(m => m.subject?._id?.toString() === sub._id.toString());
      const published = tm.filter(m => m.status === 'submitted').length;
      return { name: sub.name, code: sub.code, semester: sub.semester, totalStudents: tm.length, published, type: sub.type };
    });

    const prompt = `You are an academic performance analyst for the ${department} department at CBIT (Chaitanya Bharathi Institute of Technology), Hyderabad. Generate a concise, professional department CIE performance report for ${year}.

DATA SUMMARY:
- Department: ${department}
- Programs: ${programs.join(', ')}
- Total Students: ${students.length}
- Total Teachers: ${teachers.length}
- Total Subjects: ${subjects.length}
- Detained Students: ${detained}
- Students with Pending Supplies: ${supplies}
- Average CIE Score (published): ${avgCIE}/40
- Students at Attendance Risk (<70%): ${attRisk}
- Subject-wise publish status: ${subjectStats.map(s=>`${s.name}(Sem${s.semester}): ${s.published}/${s.totalStudents} published`).join(', ')}

Write a 3-4 paragraph professional report covering:
1. Overall department performance and CIE completion status
2. Attendance situation and detention risk
3. Areas of concern and recommendations
4. Positive highlights

Keep it factual, professional, suitable for an HOD to present at a department review meeting. Use actual numbers from the data provided.`;

    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ message: 'GEMINI_API_KEY not set in .env file' });
    const genAI = getGemini();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const reportText = result.response.text();

    res.json({
      report: reportText || 'Report generation failed',
      stats: { students: students.length, detained, supplies, avgCIE, attRisk, teachers: teachers.length, subjects: subjects.length }
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── AI: STUDENT RISK PREDICTOR ────────────────────────────────────────────
router.get('/ai/risk-prediction', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const year = getConfig().academicYear || '2025-26';

    const students = await Student.find({ branch: department, program: { $in: programs }, status: { $nin: ['Graduated'] } });
    // Filter marks by the students in this department — not by year
    // This handles cases where marks were saved under old academic year labels
    const studentIds = students.map(s => s._id);
    const theoryMarks = await TheoryMarks.find({ student: { $in: studentIds } })
      .populate('student', 'name usn section semester program');

    const riskStudents = [];

    for (const student of students) {
      const studentMarks = theoryMarks.filter(m => m.student?._id?.toString() === student._id.toString());
      if (!studentMarks.length) continue;

      const riskFactors = [];
      let riskScore = 0;

      // Check attendance — use computed attMarks (0=detained, 2=<75%, 3=<80% etc)
      const attRecords = studentMarks.filter(m => m.attendance?.percentage != null);
      const avgAtt = attRecords.length
        ? attRecords.reduce((s,m) => s + m.attendance.percentage, 0) / attRecords.length
        : null;

      // Also check via computed attMarks
      const attMarksList = studentMarks.filter(m => m.computed?.attMarks != null).map(m => m.computed.attMarks);
      const avgAttMarks  = attMarksList.length ? attMarksList.reduce((a,b)=>a+b,0)/attMarksList.length : null;

      if (avgAtt !== null) {
        if (avgAtt < 60)       { riskScore += 40; riskFactors.push(`Critical attendance: ${avgAtt.toFixed(0)}%`); }
        else if (avgAtt < 70)  { riskScore += 25; riskFactors.push(`Low attendance: ${avgAtt.toFixed(0)}%`); }
        else if (avgAtt < 75)  { riskScore += 10; riskFactors.push(`Borderline attendance: ${avgAtt.toFixed(0)}%`); }
      } else if (avgAttMarks !== null) {
        // Fallback: use attMarks (0=detained risk, 2=borderline)
        if (avgAttMarks === 0)      { riskScore += 40; riskFactors.push('Detained: attendance below 70%'); }
        else if (avgAttMarks <= 2)  { riskScore += 20; riskFactors.push(`Low attendance marks: ${avgAttMarks}/5`); }
        else if (avgAttMarks <= 3)  { riskScore += 10; riskFactors.push(`Borderline attendance: ${avgAttMarks}/5`); }
      }

      // Check CT performance — use computed ctAvg (scaled /20) or raw ct1.total/ct2.total
      const withCT1 = studentMarks.filter(m => m.ct1?.total != null && !m.ct1?.isAbsent);
      const withCT2 = studentMarks.filter(m => m.ct2?.total != null && !m.ct2?.isAbsent);

      // Use computed ctAvg if available, else use raw
      const computedCTs = studentMarks.filter(m => m.computed?.ctAvg != null);
      let ct1Avg = null, ct2Avg = null;

      if (withCT1.length) ct1Avg = withCT1.reduce((s,m)=>s+(m.ct1.total/20*100),0)/withCT1.length;
      if (withCT2.length) ct2Avg = withCT2.reduce((s,m)=>s+(m.ct2.total/20*100),0)/withCT2.length;

      if (ct1Avg !== null && ct1Avg < 40)  { riskScore += 20; riskFactors.push(`Poor CT1: ${ct1Avg.toFixed(0)}% (${(ct1Avg*20/100).toFixed(1)}/20)`); }
      if (ct2Avg !== null && ct2Avg < 40)  { riskScore += 20; riskFactors.push(`Poor CT2: ${ct2Avg.toFixed(0)}% (${(ct2Avg*20/100).toFixed(1)}/20)`); }
      if (ct1Avg !== null && ct2Avg !== null && ct1Avg > 60 && ct2Avg < 50) {
        riskScore += 15; riskFactors.push(`Performance drop: CT1 ${ct1Avg.toFixed(0)}% → CT2 ${ct2Avg.toFixed(0)}%`);
      }

      // Check overall CIE — include both submitted and approved
      const published = studentMarks.filter(m => ['submitted','approved'].includes(m.status) && m.computed?.total != null);
      if (published.length) {
        const avgCIE = published.reduce((s,m) => s + m.computed.total, 0) / published.length;
        if (avgCIE < 16)      { riskScore += 20; riskFactors.push(`Very low CIE: ${avgCIE.toFixed(1)}/40`); }
        else if (avgCIE < 22) { riskScore += 10; riskFactors.push(`Below average CIE: ${avgCIE.toFixed(1)}/40`); }
      }

      // Has existing supplies
      if ((student.supplies||[]).some(x=>!x.cleared)) {
        riskScore += 15; riskFactors.push('Has pending supply subjects');
      }

      if (riskScore >= 20) {
        riskStudents.push({
          student: { id: student._id, name: student.name, usn: student.usn, section: student.section, semester: student.semester },
          riskScore: Math.min(riskScore, 100),
          riskLevel: riskScore >= 50 ? 'high' : riskScore >= 30 ? 'medium' : 'low',
          riskFactors,
          avgAttendance: avgAtt ? Math.round(avgAtt) : null,
        });
      }
    }

    // Sort by risk score descending
    riskStudents.sort((a,b) => b.riskScore - a.riskScore);

    res.json({
      total: students.length,
      atRisk: riskStudents.length,
      high:   riskStudents.filter(s=>s.riskLevel==='high').length,
      medium: riskStudents.filter(s=>s.riskLevel==='medium').length,
      low:    riskStudents.filter(s=>s.riskLevel==='low').length,
      students: riskStudents.slice(0, 50) // top 50
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── CONSOLIDATED CIE SHEET — Admin only ──────────────────────────────────
router.get('/consolidated-cie', auth, async (req, res) => {
  try {
    const { program, semester } = req.query;
    if (!program || !semester)
      return res.status(400).json({ message: 'program and semester required' });

    const { department } = scopeOf(req);
    const year = getConfig().academicYear || '2025-26';
    const sem  = Number(semester);

    // 1. Get all subjects for this program+semester
    const subjects = await Subject.find({ department, program, semester:sem, type:{$ne:'none'} })
      .populate('sectionTeachers.teacher','name email phone')
      .populate('batchTeachers.teacher',  'name email phone')
      .populate('electiveTeachers.teacher','name email phone')
      .sort({ type:1, code:1 });

    if (!subjects.length)
      return res.status(404).json({ message: 'No subjects found for this program and semester' });

    const theorySubs   = subjects.filter(s=>s.type==='theory');
    const electiveSubs = subjects.filter(s=>s.type==='elective');
    const labSubs      = subjects.filter(s=>s.type==='lab');
    const allSubs      = [...theorySubs,...electiveSubs,...labSubs];

    // 2. Students
    const students = await Student.find({ branch:department, program, semester:sem }).sort({section:1,usn:1});
    if (!students.length)
      return res.status(404).json({ message: 'No students found' });

    // 3. Published marks
    const theoryMarks = await TheoryMarks.find({
      subject:{$in:subjects.map(s=>s._id)},
      status:{$in:['submitted','approved']}
    });
    const labMarks = await LabMarks.find({
      subject:{$in:labSubs.map(s=>s._id)},
      status:{$in:['submitted','approved']}
    });

    // 4. Mentor records for activity points + internship
    // MentoringRecord already required at top of file
    let mentorRecords = [];
    try {
      mentorRecords = await MentoringRecord.find({
        student:{$in:students.map(s=>s._id)}
      });
    } catch(e) {}

    // Helper — get mark
    const getT = (sid,subId) => theoryMarks.find(m=>m.student.toString()===sid.toString()&&m.subject.toString()===subId.toString())?.computed?.total ?? null;
    const getL = (sid,subId) => labMarks.find(m=>m.student.toString()===sid.toString()&&m.subject.toString()===subId.toString())?.computed?.total ?? null;
    const getMentorData = (sid) => mentorRecords.find(m=>m.student?.toString()===sid.toString());

    // 5. Build teacher map per subject per section
    const buildTeacherMap = (sub) => {
      const map = {};
      if (sub.type==='lab') {
        sub.batchTeachers?.forEach(bt => {
          const sn = String(bt.section);
          if (!map[sn]) map[sn]=[];
          if (bt.teacher) map[sn].push({name:bt.teacher.name,email:bt.teacher.email||'',phone:bt.teacher.phone||''});
        });
      } else if (sub.type==='elective') {
        map['all'] = sub.electiveTeachers?.filter(et=>et.teacher).map(et=>({name:et.teacher.name,email:et.teacher.email||'',phone:et.teacher.phone||''})) || [];
      } else {
        sub.sectionTeachers?.forEach(st => {
          const sn = String(st.section);
          if (!map[sn]) map[sn]=[];
          if (st.teacher) map[sn].push({name:st.teacher.name,email:st.teacher.email||'',phone:st.teacher.phone||''});
        });
      }
      return map;
    };

    // 6. Build payload for Python
    const sections = [...new Set(students.map(s=>String(s.section)))].sort();

    const payload = {
      dept:     department,
      year,
      program,
      semester: sem,
      subjects: allSubs.map(sub=>({
        _id:       sub._id.toString(),
        code:      sub.code,
        name:      sub.name,
        shortName: sub.name.length>8 ? sub.name.slice(0,7)+'.' : sub.name,
        type:      sub.type,
        teachers:  buildTeacherMap(sub)
      })),
      sections: sections.map(secNum => ({
        sectionNum: secNum,
        label:      `${department} - ${secNum}`,
        students:   students.filter(s=>String(s.section)===secNum).map(s => {
          const marks = {};
          allSubs.forEach(sub => {
            const score = sub.type==='lab' ? getL(s._id,sub._id) : getT(s._id,sub._id);
            if (score !== null) marks[sub._id.toString()] = score;
          });
          const mentor = getMentorData(s._id);
          return {
            usn:           s.usn,
            name:          s.name,
            marks,
            activityPoints: mentor?.activityPoints ?? null,
            internshipMarks: mentor?.internshipMarks ?? null
          };
        })
      }))
    };

    // 7. Generate Excel — cell by cell with proper merges and formatting
    const wb = XLSX.utils.book_new();
    const colLetter = n => { let s=''; n++; while(n>0){s=String.fromCharCode(65+(n-1)%26)+s;n=Math.floor((n-1)/26);} return s; };
    const cellRef   = (r,c) => colLetter(c)+(r+1);
    const setCell   = (ws,r,c,v) => { const ref=cellRef(r,c); ws[ref]={v,t:typeof v==='number'?'n':'s'}; };
    const addMerge  = (ws,r1,c1,r2,c2) => { if(!ws['!merges'])ws['!merges']=[]; ws['!merges'].push({s:{r:r1,c:c1},e:{r:r2,c:c2}}); };

    for (const sec of payload.sections) {
      const sName = `${department}-${sec.sectionNum}`.slice(0,31);
      const ws    = {};
      const allS  = payload.subjects;
      const tSubs = allS.filter(s=>s.type==='theory');
      const eSubs = allS.filter(s=>s.type==='elective');
      const lSubs = allS.filter(s=>s.type==='lab');
      const NC    = allS.length;
      const TC    = 3+NC;    // Total col index
      const AC    = 3+NC+1;  // Activity Points col index
      const LC    = AC;      // last col

      // ROW 0: College name — merged across all cols
      setCell(ws,0,0,'CHAITANYA BHARATHI INSTITUTE OF TECHNOLOGY(Autonomous), HYDERABAD-75');
      addMerge(ws,0,0,0,LC);

      // ROW 1: Title — merged
      setCell(ws,1,0,'CONSOLIDATED CIE MARKS');
      addMerge(ws,1,0,1,LC);

      // ROW 2: Program + Dept
      setCell(ws,2,0,`Program: ${payload.program}`); addMerge(ws,2,0,2,2);
      setCell(ws,2,4,`Name of the Department:`);      addMerge(ws,2,4,2,5);
      setCell(ws,2,6,payload.dept);                    addMerge(ws,2,6,2,LC);

      // ROW 3: Academic Year + Sem + Section
      setCell(ws,3,0,`Academic Year: ${payload.year}`); addMerge(ws,3,0,3,2);
      setCell(ws,3,4,'Class & Semester:');               addMerge(ws,3,4,3,5);
      setCell(ws,3,6,`B.E. & Sem ${payload.semester}`); addMerge(ws,3,6,3,7);
      setCell(ws,3,8,'Section:');
      setCell(ws,3,9,sec.label);                         addMerge(ws,3,9,3,LC);

      // ROW 4: blank
      // ROW 5: Group headers
      let col=3;
      if(tSubs.length){ setCell(ws,5,col,'Theory'); if(tSubs.length>1)addMerge(ws,5,col,5,col+tSubs.length-1); col+=tSubs.length; }
      if(eSubs.length){ setCell(ws,5,col,''); if(eSubs.length>1)addMerge(ws,5,col,5,col+eSubs.length-1); col+=eSubs.length; }
      if(lSubs.length){ setCell(ws,5,col,'Practicals'); if(lSubs.length>1)addMerge(ws,5,col,5,col+lSubs.length-1); col+=lSubs.length; }

      // ROW 6: Elective sub-header
      if(eSubs.length){ const ec=3+tSubs.length; setCell(ws,6,ec,'Professional Elective - I'); if(eSubs.length>1)addMerge(ws,6,ec,6,ec+eSubs.length-1); }

      // ROWS 5-7: S.NO / Roll No / Name — merged vertically
      setCell(ws,5,0,'S.NO');             addMerge(ws,5,0,7,0);
      setCell(ws,5,1,'Roll No');          addMerge(ws,5,1,7,1);
      setCell(ws,5,2,'Name of the Student'); addMerge(ws,5,2,7,2);
      setCell(ws,5,TC,'Total');           addMerge(ws,5,TC,7,TC);
      setCell(ws,5,AC,'Activity Points'); addMerge(ws,5,AC,7,AC);

      // ROW 6: Subject codes
      allS.forEach((sub,i)=>setCell(ws,6,3+i,sub.code));

      // ROW 7: Subject names + max marks
      let grandMax=0;
      allS.forEach((sub,i)=>{ setCell(ws,7,3+i,sub.name.length>8?sub.name.slice(0,7)+'.':sub.name); const m=sub.type==='lab'?50:40; grandMax+=m; });

      // ROW 8: Max marks
      allS.forEach((sub,i)=>setCell(ws,8,3+i,sub.type==='lab'?50:40));
      setCell(ws,8,TC,grandMax);

      // ROW 9: blank separator
      // DATA ROWS start at row 10
      const DR=10;
      sec.students.forEach((student,idx)=>{
        const r=DR+idx;
        setCell(ws,r,0,idx+1);
        setCell(ws,r,1,student.usn);
        setCell(ws,r,2,student.name.toUpperCase());
        let total=0;
        allS.forEach((sub,i)=>{
          const score=student.marks[sub._id];
          if(score!=null){ setCell(ws,r,3+i,score); total+=score; }
        });
        if(total>0) setCell(ws,r,TC,total);
        if(student.activityPoints!=null) setCell(ws,r,AC,student.activityPoints);
      });

      // Faculty table
      const lastDataRow = DR+sec.students.length;
      let fr=lastDataRow+2;
      setCell(ws,fr,0,'Sub-Code'); setCell(ws,fr,1,'Course Name'); setCell(ws,fr,2,'Name of the Faculty'); setCell(ws,fr,3,'Mail ID'); setCell(ws,fr,4,'Mobile Number');

      const addFacBlock=(label,subs)=>{
        if(!subs.length)return;
        fr++; setCell(ws,fr,0,label); addMerge(ws,fr,0,fr,LC);
        subs.forEach(sub=>{
          const teachers=sub.teachers[sec.sectionNum]||sub.teachers['all']||[{name:'—',email:'',phone:''}];
          teachers.forEach((t,ti)=>{
            fr++;
            if(ti===0){ setCell(ws,fr,0,sub.code); setCell(ws,fr,1,sub.name); }
            setCell(ws,fr,2,t.name||'—'); setCell(ws,fr,3,t.email||''); setCell(ws,fr,4,t.phone||'');
          });
        });
      };
      addFacBlock('Core Subjects',tSubs);
      addFacBlock('Professional Elective – I (PE-I)',eSubs);
      addFacBlock('Practicals',lSubs);

      // Set worksheet range
      ws['!ref'] = `A1:${colLetter(LC)}${fr+1}`;

      // Column widths
      ws['!cols']=[
        {wch:6},{wch:18},{wch:32},
        ...allS.map(()=>({wch:10})),
        {wch:9},{wch:16}
      ];

      // Row heights
      ws['!rows']=[];
      [22,18,15,15,8,15,14,14,14].forEach((h,i)=>{ ws['!rows'][i]={hpt:h}; });

      XLSX.utils.book_append_sheet(wb,ws,sName);
    }

    const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
    const fileName = `${department}_Sem${semester}_CIE_${year.replace('-','_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);

  } catch(e) {
    console.error('Consolidated CIE error:', e);
    res.status(500).json({ message: e.message });
  }
});

// ── CONSOLIDATED CIE PREVIEW DATA — for UI table view ────────────────────
router.get('/consolidated-cie/preview', auth, async (req, res) => {
  try {
    const { program, semester, section } = req.query;
    if (!program || !semester) return res.status(400).json({ message:'program and semester required' });

    const { department } = scopeOf(req);
    const year = getConfig().academicYear || '2025-26';
    const sem  = Number(semester);

    const subjects = await Subject.find({ department, program, semester:sem, type:{$ne:'none'} }).sort({type:1,code:1});
    const theorySubs=[]; const electiveSubs=[]; const labSubs=[];
    subjects.forEach(s=>{ if(s.type==='theory')theorySubs.push(s); else if(s.type==='elective')electiveSubs.push(s); else if(s.type==='lab')labSubs.push(s); });
    const allSubs=[...theorySubs,...electiveSubs,...labSubs];

    const studentQuery = { branch:department, program, semester:sem };
    if (section) studentQuery.section = section;
    const students = await Student.find(studentQuery).sort({section:1,usn:1});

    const theoryMarks = await TheoryMarks.find({ subject:{$in:allSubs.map(s=>s._id)}, status:{$in:['submitted','approved']} });
    const labMarks    = await LabMarks.find({    subject:{$in:labSubs.map(s=>s._id)},  status:{$in:['submitted','approved']} });

    let mentorRecords=[];
    try { mentorRecords=await MentoringRecord.find({student:{$in:students.map(s=>s._id)}}); } catch(e){}

    const getT=(sid,subId)=>theoryMarks.find(m=>m.student.toString()===sid.toString()&&m.subject.toString()===subId.toString())?.computed?.total??null;
    const getL=(sid,subId)=>labMarks.find(m=>m.student.toString()===sid.toString()&&m.subject.toString()===subId.toString())?.computed?.total??null;
    const getMentorData=(sid)=>mentorRecords.find(m=>m.student?.toString()===sid.toString());

    const sections=[...new Set(students.map(s=>String(s.section)))].sort();

    res.json({
      subjects: allSubs.map(s=>({_id:s._id,code:s.code,name:s.name,type:s.type,maxMarks:s.type==='lab'?50:40})),
      sections: sections.map(secNum=>({
        sectionNum:secNum,
        students: students.filter(s=>String(s.section)===secNum).map(s=>{
          const marks={};
          allSubs.forEach(sub=>{ const score=sub.type==='lab'?getL(s._id,sub._id):getT(s._id,sub._id); marks[sub._id.toString()]=score; });
          const mentor=getMentorData(s._id);
          const total=Object.values(marks).reduce((sum,v)=>sum+(v||0),0);
          return {usn:s.usn,name:s.name,marks,total,activityPoints:mentor?.activityPoints??null,internshipMarks:mentor?.internshipMarks??null};
        })
      })),
      year, program, semester:sem, department
    });
  } catch(e) { res.status(500).json({message:e.message}); }
});



// ── MENTOR TASK CONFIG ────────────────────────────────────────────────────

// GET — get current mentor task config for a semester
router.get('/mentor-task', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const { program, semester } = req.query;
    const year = getConfig().academicYear || '2025-26';
    const task = await MentorTask.findOne({ department, program, semester:Number(semester), academicYear:year });
    res.json(task || null);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// POST — create/update mentor task config
router.post('/mentor-task', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { program, semester, components } = req.body;
    const year = getConfig().academicYear || '2025-26';
    if (!components?.length) return res.status(400).json({ message: 'Add at least one component' });

    let task = await MentorTask.findOne({ department, program, semester:Number(semester), academicYear:year });
    if (!task) {
      task = new MentorTask({ department, program, semester:Number(semester), academicYear:year, createdBy:req.user._id });
    }
    task.components = components;
    await task.save();
    res.json(task);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// DELETE — remove mentor task config
router.delete('/mentor-task', auth, async (req, res) => {
  try {
    const { department } = scopeOf(req);
    const { program, semester } = req.query;
    const year = getConfig().academicYear || '2025-26';
    await MentorTask.deleteOne({ department, program, semester:Number(semester), academicYear:year });
    res.json({ message: 'Mentor task removed' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT LIST — section-wise with detained badge ───────────────────────
router.get('/student-list', auth, async (req, res) => {
  try {
    const { department, programs } = scopeOf(req);
    const { program, semester } = req.query;
    const query = { branch: department };
    if (program)  query.program  = program;
    if (semester) query.semester = Number(semester);
    else query.program = { $in: programs };

    const students = await Student.find(query)
      .select('name usn section semester program status branch labBatch mentoringBatch supplies')
      .sort({ section:1, usn:1 });

    // Group by section
    const sections = {};
    students.forEach(s => {
      const sec = String(s.section);
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push({
        name:           s.name,
        usn:            s.usn,
        section:        s.section,
        semester:       s.semester,
        program:        s.program,
        labBatch:       s.labBatch,
        mentoringBatch: s.mentoringBatch,
        status:         s.status,
        hasSupply:      (s.supplies||[]).some(x=>!x.cleared),
        isDetained:     s.status === 'Detained',
      });
    });

    res.json({
      total:    students.length,
      sections: Object.entries(sections).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))
        .map(([sec,studs])=>({ section:sec, count:studs.length, students:studs }))
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});


// ── ADMIN: STUDENT ACTIVITY POINTS SUMMARY ───────────────────────────────
router.get('/activity-points/:studentId', auth, async (req, res) => {
  try {
    const records = await MentoringRecord.find({ student: req.params.studentId })
      .select('semester academicYear activityPoints')
      .sort({ semester: 1 });

    const semPoints = records.map(r => ({
      semester:       r.semester,
      academicYear:   r.academicYear,
      activityPoints: r.activityPoints ?? 0
    }));
    const total   = semPoints.reduce((s,r) => s+(r.activityPoints||0), 0);
    res.json({ semPoints, total, achieved: total >= 60, required: 60 });
  } catch(e) { res.status(500).json({ message: e.message }); }
});


module.exports = router;
