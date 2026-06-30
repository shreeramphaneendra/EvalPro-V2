const router  = require('express').Router();
const { protect, teacherOnly } = require('../middleware/auth');
const Subject     = require('../models/Subject');
const Student     = require('../models/Student');
const ExamConfig  = require('../models/ExamConfig');
const TheoryMarks = require('../models/TheoryMarks');
const LabMarks    = require('../models/LabMarks');
const MentoringRecord = require('../models/MentoringRecord');
const MentorTask      = require('../models/MentorTask');

const auth = [protect, teacherOnly];

// ── ACADEMIC YEAR HELPER ──────────────────────────────────────────────────
const getAcademicYear = () => {
  try {
    const configPath = require('path').join(__dirname, '../config.json');
    return JSON.parse(require('fs').readFileSync(configPath, 'utf8')).academicYear || '2025-26';
  } catch { return process.env.ACADEMIC_YEAR || '2025-26'; }
};

// ── GET MY SUBJECTS ───────────────────────────────────────────────────────
router.get('/my-subjects', auth, async (req, res) => {
  try {
    const tid = req.user._id.toString();
    // Get all subjects and filter — handles ObjectId string mismatch issues
    const allSubs = await Subject.find({})
      .populate('sectionTeachers.teacher','name')
      .populate('batchTeachers.teacher','name employeeId')
      .populate('electiveTeachers.teacher','name employeeId');
    const subjects = allSubs.filter(s => {
      const inSection  = (s.sectionTeachers  || []).some(st => st.teacher?._id?.toString() === tid);
      const inBatch    = (s.batchTeachers    || []).some(bt => bt.teacher?._id?.toString() === tid);
      const inElective = (s.electiveTeachers || []).some(et => et.teacher?._id?.toString() === tid);
      return inSection || inBatch || inElective;
    });

    const result = subjects.map(s => {
      const obj = s.toObject();
      // For theory: which sections does this teacher handle?
      obj.mySections = s.sectionTeachers
        .filter(st => st.teacher?._id?.toString() === tid)
        .map(st => st.section);
      // For lab: which section+batch combos?
      obj.myBatches = s.batchTeachers
        .filter(bt => bt.teacher?._id?.toString() === tid)
        .map(bt => ({ section: bt.section, batch: bt.batch }));
      // For elective: roll number range
      const myElective = s.electiveTeachers?.find(et => et.teacher?._id?.toString() === tid);
      obj.myElectiveRange = myElective ? { fromRoll: myElective.fromRoll, toRoll: myElective.toRoll } : null;
      return obj;
    });
    res.json(result);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── GET STUDENTS FOR A SUBJECT (teacher sees only their section) ──────────
router.get('/students', auth, async (req, res) => {
  try {
    const tid = req.user._id.toString();
    const { subjectId, batch, section } = req.query;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    // Determine which section(s) this teacher is assigned to for this subject
    let allowedSections;
    if (subject.type === 'lab') {
      // Batch teachers — find sections this teacher handles
      const myEntries = subject.batchTeachers.filter(bt => bt.teacher?.toString() === tid);
      allowedSections = [...new Set(myEntries.map(bt => bt.section))];
    } else {
      const myEntries = subject.sectionTeachers.filter(st => st.teacher?.toString() === tid);
      allowedSections = myEntries.map(st => st.section);
    }

    // If section is explicitly passed (e.g. teacher selects from dropdown), use it
    // but only if it's in their allowed sections
    const targetSection = section && allowedSections.includes(section) ? section : null;

    const query = {
      program: subject.program,
      branch:  subject.department,
      semester: subject.semester,
      ...(targetSection
        ? { section: targetSection }
        : allowedSections.length > 0 ? { section: { $in: allowedSections } } : {})
    };
    if (subject.type === 'lab' && batch) query.labBatch = batch;
    if (subject.type === 'elective') {
      // Find this teacher's roll number range for this elective
      const myEntry = subject.electiveTeachers?.find(et => et.teacher?.toString() === tid);
      query.electives = subjectId;
      if (myEntry?.fromRoll && myEntry?.toRoll) {
        // Filter enrolled students whose USN falls within the assigned range
        query.usn = { $gte: myEntry.fromRoll.toUpperCase(), $lte: myEntry.toRoll.toUpperCase() };
      }
      // If no range assigned, teacher sees all enrolled students
    }

    const students = await Student.find(query).select('-password').sort({ section: 1, usn: 1 });
    res.json(students);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── EXAM CONFIG: GET ───────────────────────────────────────────────────────
router.get('/exam-config', auth, async (req, res) => {
  try {
    const { subjectId, examType, section } = req.query;
    // Try section-specific config first, fall back to global (section: null)
    let config = section
      ? await ExamConfig.findOne({ subject: subjectId, examType, section })
      : null;
    if (!config) config = await ExamConfig.findOne({ subject: subjectId, examType, section: null });
    res.json(config || null);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── EXAM CONFIG: SAVE/UPDATE ───────────────────────────────────────────────
router.post('/exam-config', auth, async (req, res) => {
  try {
    const { subjectId, examType, questions, section } = req.body;
    // section: null/undefined = applies to all sections (global)
    // section: '1' = only for section 1
    const sectionKey = section || null;
    const totalMax = questions.reduce((s, q) => s + (q.maxMarks || 0), 0);
    const config = await ExamConfig.findOneAndUpdate(
      { subject: subjectId, examType, section: sectionKey },
      { questions, totalMax, configuredBy: req.user._id, section: sectionKey },
      { upsert: true, new: true }
    );
    res.json(config);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── THEORY MARKS: GET FULL SHEET ──────────────────────────────────────────
router.get('/theory-sheet', auth, async (req, res) => {
  try {
    const { subjectId, examType } = req.query;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const tid1 = req.user._id.toString();
    const requestedSection = req.query.section ? String(req.query.section) : null;
    let studentsQuery1 = { program: subject.program, branch: subject.department, semester: subject.semester };
    if (subject.type === 'elective') {
      studentsQuery1.electives = subjectId;
      const myEl1 = subject.electiveTeachers?.find(et => et.teacher?.toString() === tid1);
      if (myEl1?.fromRoll && myEl1?.toRoll)
        studentsQuery1.usn = { $gte: myEl1.fromRoll.toUpperCase(), $lte: myEl1.toRoll.toUpperCase() };
    } else {
      // Robust section matching — handles both ObjectId and string comparison
      const mySecs1 = (subject.sectionTeachers || [])
        .filter(st => st.teacher && (st.teacher.toString() === tid1 || st.teacher?._id?.toString() === tid1))
        .map(st => st.section);
      const allowedSections = mySecs1.length > 0 ? mySecs1 : null;
      if (requestedSection && (allowedSections === null || allowedSections.includes(requestedSection))) {
        studentsQuery1.section = requestedSection;
      } else if (allowedSections) {
        studentsQuery1.section = { $in: allowedSections };
      }
      // If no sections found for this teacher — they may be global (admin teaching all sections)
    }
    const students = await Student.find(studentsQuery1).select('-password').sort({ section:1, usn: 1 });
    const records  = await TheoryMarks.find({ subject: subjectId }).lean();
    const config   = await ExamConfig.findOne({ subject: subjectId, examType });
    const recMap   = {};
    records.forEach(r => { recMap[r.student.toString()] = r; });

    const sheet = students.map(s => ({
      student: { id: s._id, name: s.name, usn: s.usn, section: s.section, status: s.status, isRepeating: s.status === 'Detained' },
      record: recMap[s._id.toString()] || null
    }));
    res.json({ sheet, config });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── THEORY MARKS: BULK SAVE ───────────────────────────────────────────────
router.post('/theory-marks/bulk-save', auth, async (req, res) => {
  try {
    const { subjectId, examType, rows } = req.body;
    const academicYear = getAcademicYear(); // always use server-side year — never trust client
    // Load ExamConfig ONCE before the loop (not per row — avoids N+1 queries)
    const examCfg = await ExamConfig.findOne({ subject: subjectId, examType });
    for (const row of rows) {
      // Find existing doc — try current year first, then any year (handles migration from old year)
      let tm = await TheoryMarks.findOne({ student: row.studentId, subject: subjectId, academicYear });
      if (!tm) {
        // Try to find with any academicYear (old doc exists from previous year label)
        tm = await TheoryMarks.findOne({ student: row.studentId, subject: subjectId });
        if (tm) {
          tm.academicYear = academicYear; // migrate to current year
        } else {
          tm = new TheoryMarks({ student: row.studentId, subject: subjectId, teacher: req.user._id, academicYear });
        }
      }
      // Migrate legacy 'approved' status → 'submitted'
      if (tm.status === 'approved') tm.status = 'submitted';

      const fieldMap = { CT1:'ct1', CT2:'ct2', ST1:'st1', ST2:'st2', ST3:'st3', ASGN1:'asgn1', ASGN2:'asgn2' };
      const key = fieldMap[examType];

      if (key) {
        // Validate per-question marks against config maxMarks
        if (examCfg && !row.isAbsent) {
          for (const rq of (row.questions || [])) {
            const cfgQ = examCfg.questions.find(cq => cq.qNo === rq.qNo);
            if (cfgQ && rq.marks !== null && rq.marks !== undefined) {
              if (Number(rq.marks) > cfgQ.maxMarks) {
                rq.marks = cfgQ.maxMarks; // Cap at configured max — never store impossible marks
              }
              if (Number(rq.marks) < 0) rq.marks = 0; // No negative marks
            }
          }
        }

        // Compute total applying either/or best-group logic if config has pairs
        let total = null;
        if (!row.isAbsent) {
          const cfg = examCfg; // already loaded above
          if (cfg && cfg.questions.some(q => q.eitherOrPair)) {
            // Build pair map
            const pairMap = {};
            cfg.questions.forEach(q => {
              if (q.eitherOrPair && q.groupId) {
                if (!pairMap[q.eitherOrPair]) pairMap[q.eitherOrPair] = [];
                if (!pairMap[q.eitherOrPair].includes(q.groupId))
                  pairMap[q.eitherOrPair].push(q.groupId);
              }
            });
            // For each pair, find best group
            const bestGroups = {};
            Object.entries(pairMap).forEach(([pair, groups]) => {
              let best = groups[0], bestTotal = -1;
              groups.forEach(g => {
                const gTotal = cfg.questions
                  .filter(cq => cq.groupId === g && cq.eitherOrPair === pair)
                  .reduce((s, cq) => {
                    const entered = (row.questions||[]).find(rq => rq.qNo === cq.qNo);
                    return s + (Number(entered?.marks)||0);
                  }, 0);
                if (gTotal > bestTotal) { best = g; bestTotal = gTotal; }
              });
              bestGroups[pair] = best;
            });
            // Sum: skip questions whose group is not the best for its pair
            total = (row.questions||[]).reduce((s, rq) => {
              const cfgQ = cfg.questions.find(cq => cq.qNo === rq.qNo);
              if (cfgQ?.eitherOrPair && cfgQ?.groupId) {
                if (bestGroups[cfgQ.eitherOrPair] !== cfgQ.groupId) return s; // not best group
              }
              return s + (Number(rq.marks)||0);
            }, 0);
          } else {
            total = (row.questions || []).reduce((s,q) => s + (q.marks || 0), 0);
          }
        }
        tm[key] = { questions: row.questions || [], total, isAbsent: row.isAbsent || false };
      } else if (examType === 'ATTENDANCE') {
        const pct = row.totalConducted > 0 ? Math.round((row.attended / row.totalConducted) * 100) : 0;
        tm.attendance = {
          totalConducted:     row.totalConducted,
          attended:           row.attended,
          percentage:         pct,
          medicalCondonation: row.medicalCondonation || false
        };
      } else {
        return res.status(400).json({ message: `Unknown examType: ${examType}. Valid values: CT1 CT2 ST1 ST2 ST3 ASGN1 ASGN2 ATTENDANCE` });
      }

      tm.compute();
      await tm.save();
    }
    res.json({ saved: rows.length });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── THEORY: GET OVERALL CIE SHEET ─────────────────────────────────────────
router.get('/theory-overall', auth, async (req, res) => {
  try {
    const { subjectId } = req.query;
    const subject = await Subject.findById(subjectId);
    const tid2 = req.user._id.toString();
    let studentsQuery2 = { program: subject.program, branch: subject.department, semester: subject.semester };
    if (subject.type === 'elective') {
      studentsQuery2.electives = subjectId;
      const myEl2 = subject.electiveTeachers?.find(et => et.teacher?.toString() === tid2);
      if (myEl2?.fromRoll && myEl2?.toRoll)
        studentsQuery2.usn = { $gte: myEl2.fromRoll.toUpperCase(), $lte: myEl2.toRoll.toUpperCase() };
    } else {
      const mySecs2 = (subject.sectionTeachers || [])
        .filter(st => st.teacher && (st.teacher.toString() === tid2 || st.teacher?._id?.toString() === tid2))
        .map(st => st.section);
      if (mySecs2.length > 0) studentsQuery2.section = { $in: mySecs2 };
      // If no sections — show all students (admin teaching all sections)
    }
    const students = await Student.find(studentsQuery2).select('-password').sort({ section:1, usn: 1 });
    const records  = await TheoryMarks.find({ subject: subjectId }).lean();
    const recMap   = {};
    records.forEach(r => { recMap[r.student.toString()] = r; });
    const sheet = students.map(s => ({ student: { id: s._id, name: s.name, usn: s.usn, section: s.section, isRepeating: s.status==='Detained' }, record: recMap[s._id.toString()] || null }));
    res.json(sheet);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── LAB MARKS: GET WEEKLY SHEET ───────────────────────────────────────────
router.get('/lab-sheet', auth, async (req, res) => {
  try {
    const { subjectId, batch } = req.query;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const tid = req.user._id.toString();

    // Find which sections this teacher handles for this batch
    const myEntries = subject.batchTeachers.filter(bt =>
      bt.teacher?.toString() === tid && bt.batch === batch
    );
    const mySections = [...new Set(myEntries.map(bt => bt.section))];

    // Filter students by batch AND the teacher's assigned sections
    const studentQuery = {
      program: subject.program, branch: subject.department,
      semester: subject.semester, labBatch: batch
    };
    if (mySections.length > 0) studentQuery.section = { $in: mySections };

    const students = await Student.find(studentQuery).select('-password').sort({ section:1, usn:1 });
    const records  = await LabMarks.find({ subject: subjectId, batch }).lean();
    const recMap   = {};
    records.forEach(r => { recMap[r.student.toString()] = r; });
    const sheet = students.map(s => ({
      student: { id: s._id, name: s.name, usn: s.usn, section: s.section,
                 isRepeating: s.status === 'Detained' },
      record: recMap[s._id.toString()] || null
    }));
    res.json(sheet);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── LAB MARKS: BULK SAVE WEEKLY ───────────────────────────────────────────
router.post('/lab-marks/bulk-save', auth, async (req, res) => {
  try {
    const { subjectId, batch, rows, saveType } = req.body;
    const academicYear = getAcademicYear();
    for (const row of rows) {
      let lm = await LabMarks.findOne({ student: row.studentId, subject: subjectId, batch, academicYear });
      if (!lm) lm = new LabMarks({ student: row.studentId, subject: subjectId, teacher: req.user._id, batch, academicYear });
      // Migrate legacy 'approved' status → 'submitted'
      if (lm.status === 'approved') lm.status = 'submitted';

      if (saveType === 'weekly') {
        lm.weeklyMarks = row.weeklyMarks || [];
      } else if (saveType === 'internal') {
        const total = row.isAbsent ? null : (row.questions || []).reduce((s,q) => s+(q.marks||0),0);
        const field = row.internalNo === 1 ? 'int1' : 'int2';
        lm[field] = { questions: row.questions||[], total, isAbsent: row.isAbsent||false };
      }

      lm.compute();
      await lm.save();
    }
    res.json({ saved: rows.length });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── LAB: GET OVERALL CIE ──────────────────────────────────────────────────
router.get('/lab-overall', auth, async (req, res) => {
  try {
    const { subjectId } = req.query;
    const subject  = await Subject.findById(subjectId);
    const students = await Student.find({ program: subject.program, branch: subject.department, semester: subject.semester }).select('-password').sort({ section:1, usn: 1 });
    const records  = await LabMarks.find({ subject: subjectId }).lean();
    const recMap   = {};
    records.forEach(r => { recMap[r.student.toString()] = r; });
    const sheet = students.map(s => ({ student: { id: s._id, name: s.name, usn: s.usn, section: s.section, isRepeating: s.status==='Detained' }, record: recMap[s._id.toString()] || null }));
    res.json(sheet);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MENTORING ─────────────────────────────────────────────────────────────
router.get('/my-mentees', auth, async (req, res) => {
  try {
    const records = await MentoringRecord.find({ mentor: req.user._id })
      .populate('student', 'name usn section semester branch program labBatch mentoringBatch')
      .sort({ 'student.usn': 1 });
    res.json(records);
  } catch(e) { res.status(500).json({ message: e.message }); }
});


// ── MENTOR BULK ENTRY — get task config + student list ────────────────────
router.get('/mentor-task', auth, async (req, res) => {
  try {
    const { program, semester } = req.query;
    const teacher = await require('../models/Teacher').findById(req.user._id).select('department');
    const dept = teacher?.department;
    const year = getAcademicYear();

    // Get task config from admin
    const task = await MentorTask.findOne({
      department: dept, program, semester:Number(semester), academicYear: year
    });

    // Get students this teacher is assigned as mentor for this specific program+semester
    // Deciding factor is Sem + Section — get all their mentoring records for this sem
    const myRecords = await MentoringRecord.find({
      mentor: req.user._id,
      semester: Number(semester)
    }).select('student section');

    if (!myRecords.length) {
      return res.json({ task: null, students: [] });
    }

    const myStudentIds = myRecords.map(r => r.student);
    const studentQuery = { _id: { $in: myStudentIds }, program };

    const students = await require('../models/Student').find(studentQuery)
      .select('name usn section semester status labBatch mentoringBatch')
      .sort({ section:1, usn:1 });

    // Get existing records
    const records = await MentoringRecord.find({
      student: { $in: students.map(s=>s._id) },
      $or: [
        { mentor: req.user._id },
        // Also get records where this teacher filled marks (even if not formal mentor)
      ]
    });

    res.json({
      task: task || null,
      students: await Promise.all(students.map(async s => {
        const rec = records.find(r => r.student.toString() === s._id.toString());
        // Get all-semester activity points for running total
        const allRecs = await MentoringRecord.find({ student: s._id })
          .select('semester activityPoints academicYear').sort({ semester:1 });
        const totalPoints = allRecs.reduce((sum,r)=>sum+(r.activityPoints||0),0);
        const semBreakdown = allRecs.map(r=>({ semester:r.semester, points:r.activityPoints||0, year:r.academicYear }));
        return {
          id:              s._id,
          name:            s.name,
          usn:             s.usn,
          section:         s.section,
          status:          s.status,
          activityPoints:  rec?.activityPoints ?? null,
          totalActivityPoints: totalPoints,
          semActivityBreakdown: semBreakdown,
          activityAchieved: totalPoints >= 60,
          componentMarks:  rec?.componentMarks || [],
          internshipMarks: rec?.internshipMarks ?? null,
          internshipTitle: rec?.internshipTitle || '',
          internshipStatus:rec?.internshipStatus || 'none',
        };
      }))
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MENTOR BULK SAVE — save marks for all students at once ────────────────
router.post('/mentor-bulk-save', auth, async (req, res) => {
  try {
    const { program, semester, rows } = req.body;
    // rows: [{ studentId, activityPoints, componentMarks:[{key,label,marks,maxMarks}], internshipMarks, internshipTitle, internshipStatus }]
    const year = getAcademicYear();
    const teacher = await require('../models/Teacher').findById(req.user._id).select('department');
    const dept = teacher?.department;

    let saved = 0;
    for (const row of rows) {
      let rec = await MentoringRecord.findOne({ student: row.studentId, mentor: req.user._id });
      if (!rec) {
        const student = await require('../models/Student').findById(row.studentId);
        if (!student) continue;
        rec = new MentoringRecord({
          student:        row.studentId,
          mentor:         req.user._id,
          mentoringBatch: student.mentoringBatch || 'M1',
          program:        student.program,
          branch:         dept,
          semester:       Number(semester),
          section:        String(student.section),
          academicYear:   year,
        });
      }
      if (row.activityPoints  !== undefined) rec.activityPoints  = row.activityPoints;
      if (row.internshipMarks !== undefined) rec.internshipMarks = row.internshipMarks;
      if (row.internshipTitle !== undefined) rec.internshipTitle = row.internshipTitle;
      if (row.internshipStatus!== undefined) rec.internshipStatus= row.internshipStatus;
      if (row.componentMarks?.length)        rec.componentMarks  = row.componentMarks;
      await rec.save();
      saved++;
    }
    res.json({ message: `Saved marks for ${saved} students`, saved });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MENTORING: SAVE MENTOR MARKS ────────────────────────────────────────
router.put('/mentoring/mentor-marks', auth, async (req, res) => {
  try {
    const { studentId, activityPoints, internshipMarks, internshipTitle, internshipStatus } = req.body;
    const rec = await MentoringRecord.findOne({ student: studentId, mentor: req.user._id });
    if (!rec) return res.status(404).json({ message: 'Mentoring record not found' });
    if (activityPoints   !== undefined) rec.activityPoints   = activityPoints;
    if (internshipMarks  !== undefined) rec.internshipMarks  = internshipMarks;
    if (internshipTitle  !== undefined) rec.internshipTitle  = internshipTitle;
    if (internshipStatus !== undefined) rec.internshipStatus = internshipStatus;
    await rec.save();
    res.json({ message: 'Mentor marks saved', record: rec });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/mentoring/add-meeting', auth, async (req, res) => {
  try {
    const { studentId, notes, date } = req.body;
    const rec = await MentoringRecord.findOne({ student: studentId, mentor: req.user._id });
    if (!rec) return res.status(404).json({ message: 'Mentoring record not found' });
    rec.meetings.push({ date: date || new Date(), notes });
    await rec.save();
    res.json(rec);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.put('/mentoring/remarks', auth, async (req, res) => {
  try {
    const { studentId, remarks } = req.body;
    const rec = await MentoringRecord.findOneAndUpdate({ student: studentId, mentor: req.user._id }, { remarks }, { new: true });
    res.json(rec);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── UNPUBLISH MARKS (recall published marks for correction) ───────────────
router.post('/marks/unpublish', auth, async (req, res) => {
  try {
    const { subjectId } = req.body;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.isLocked) return res.status(403).json({ message: 'Subject is locked by admin and cannot be recalled' });
    // Revert submitted → draft (students can no longer see marks)
    const unpubYear = getAcademicYear();
    await TheoryMarks.updateMany({ subject: subjectId, status: { $in: ['submitted','approved'] }, academicYear: unpubYear }, { $set: { status: 'draft' } });
    await LabMarks.updateMany(   { subject: subjectId, status: { $in: ['submitted','approved'] }, academicYear: unpubYear }, { $set: { status: 'draft' } });
    res.json({ message: 'Marks recalled — students can no longer see them. You can now make corrections.' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: UPDATE OWN PROFILE ──────────────────────────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, designation, phone } = req.body;
    const teacher = await require('../models/Teacher').findById(req.user._id);
    if (!teacher) return res.status(404).json({ message: 'Not found' });
    if (email && email !== teacher.email) {
      const taken = await require('../models/Teacher').findOne({ email, _id: { $ne: teacher._id } });
      if (taken) return res.status(400).json({ message: 'Email already in use by another teacher' });
    }
    if (name)        teacher.name        = name;
    if (email)       teacher.email       = email;
    if (designation) teacher.designation = designation;
    if (phone)       teacher.phone       = phone;
    await teacher.save();
    const { password: _, ...clean } = teacher.toObject();
    res.json({ user: clean });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MARKS APPROVAL ─────────────────────────────────────────────────────────
// Teacher submits a subject's marks for admin approval.
// Admin can then approve, making them visible to students.
// For now: teacher can self-approve (submit = approve) if admin hasn't locked.
router.post('/marks/submit', auth, async (req, res) => {
  try {
    const { subjectId } = req.body;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    if (subject.isLocked) return res.status(403).json({ message: 'Subject is locked by admin' });

    // Publish marks — draft → submitted, visible to students immediately
    const pubYear = getAcademicYear();
    // Migrate any legacy 'approved' docs to 'submitted'
    await TheoryMarks.updateMany({ subject: subjectId, status: 'approved' }, { $set: { status: 'submitted' } });
    await LabMarks.updateMany(   { subject: subjectId, status: 'approved' }, { $set: { status: 'submitted' } });
    // Publish all drafts for current academic year
    await TheoryMarks.updateMany({ subject: subjectId, status: 'draft', academicYear: pubYear }, { $set: { status: 'submitted' } });
    await LabMarks.updateMany(   { subject: subjectId, status: 'draft', academicYear: pubYear }, { $set: { status: 'submitted' } });
    res.json({ message: 'Marks published — students can now see their CIE marks' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── CO ATTAINMENT REPORT ──────────────────────────────────────────────────
// Calculates attainment for each CO based on question-wise marks
// Attainment = % of students who scored ≥50% of max marks for that CO's questions
router.get('/co-attainment', auth, async (req, res) => {
  try {
    const { subjectId, academicYear } = req.query;
    const year = academicYear || getAcademicYear();
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    // Get all exam configs for this subject
    const configs = await ExamConfig.find({ subject: subjectId });
    if (!configs.length) return res.json({ attainment: {}, message: 'No exam configurations found' });

    // Get all theory marks for this subject
    const allMarks = await TheoryMarks.find({ subject: subjectId, status: { $in: ['submitted','approved'] }, ...(year ? { academicYear: year } : {}) })
      .populate('student', 'name usn section');

    if (!allMarks.length) return res.json({ attainment: {}, message: 'No published marks found' });

    // Build CO → questions mapping across ALL exam types
    // coData[CO1] = { totalMaxMarks, students: { studentId: totalScored } }
    const coData = {};

    for (const cfg of configs) {
      const theoryKey = { CT1:'ct1', CT2:'ct2', ST1:'st1', ST2:'st2', ST3:'st3', ASGN1:'asgn1', ASGN2:'asgn2' }[cfg.examType];
      const labKey    = { LAB_INT1:'int1', LAB_INT2:'int2' }[cfg.examType];
      const examKey   = theoryKey || labKey;
      if (!examKey) continue;

      // Get appropriate marks records (theory or lab)
      const marksRecords = labKey
        ? await LabMarks.find({ subject: subjectId, status: { $in: ['submitted','approved'] } }).populate('student', 'name usn section')
        : allMarks;

      for (const q of cfg.questions) {
        const co = q.coNo || 'CO1';
        if (!coData[co]) coData[co] = { maxPerStudent: 0, studentScores: {} };
        coData[co].maxPerStudent += q.maxMarks;

        for (const rec of marksRecords) {
          const sid = rec.student._id.toString();
          if (!coData[co].studentScores[sid]) coData[co].studentScores[sid] = 0;
          const examRecord = rec[examKey];
          if (!examRecord || examRecord.isAbsent) continue;
          const qMark = (examRecord.questions || []).find(mq => mq.qNo === q.qNo);
          if (qMark?.marks) coData[co].studentScores[sid] += Number(qMark.marks) || 0;
        }
      }
    }

    // Calculate attainment for each CO
    // Attainment = % of students who scored ≥50% of CO max marks
    const studentCount = allMarks.length;
    const attainment = {};
    const threshold = 0.50; // 50% threshold — NBA requirement

    Object.entries(coData).forEach(([co, data]) => {
      if (data.maxPerStudent === 0) return;
      const targetScore = data.maxPerStudent * threshold;
      const attainedCount = Object.values(data.studentScores)
        .filter(score => score >= targetScore).length;
      const pct = studentCount > 0 ? Math.round((attainedCount / studentCount) * 100) : 0;

      attainment[co] = {
        co,
        maxMarks:      data.maxPerStudent,
        targetScore:   Math.ceil(targetScore),
        attainedCount,
        totalStudents: studentCount,
        attainmentPct: pct,
        level: pct >= 70 ? 3 : pct >= 60 ? 2 : pct >= 50 ? 1 : 0, // NBA levels
        status: pct >= 60 ? 'Attained' : 'Not Attained'
      };
    });

    // Sort by CO number
    const sorted = Object.fromEntries(
      Object.entries(attainment).sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true }))
    );

    res.json({
      subject: { name: subject.name, code: subject.code, semester: subject.semester },
      studentCount,
      threshold: `${threshold * 100}%`,
      attainment: sorted,
      overallAttainment: Object.values(sorted).length > 0
        ? Math.round(Object.values(sorted).reduce((s,v) => s + v.attainmentPct, 0) / Object.values(sorted).length)
        : 0
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER PENDING WORK SUMMARY ─────────────────────────────────────────
// Shows for each subject: what's configured, what's entered, what's published
router.get('/pending-work', auth, async (req, res) => {
  try {
    const tid = req.user._id;
    const year = getAcademicYear();

    // Get all subjects and filter by teacher — handles all ObjectId format variations
    const tidStr = tid.toString();
    const allSubjects = await Subject.find({}).lean();
    const subjects = allSubjects.filter(s => {
      const inSection  = (s.sectionTeachers  || []).some(st => st.teacher && st.teacher.toString() === tidStr);
      const inBatch    = (s.batchTeachers    || []).some(bt => bt.teacher && bt.teacher.toString() === tidStr);
      const inElective = (s.electiveTeachers || []).some(et => et.teacher && et.teacher.toString() === tidStr);
      return inSection || inBatch || inElective;
    });

    const THEORY_EXAMS = ['CT1','CT2','ASGN1','ASGN2','ST1','ST2','ST3','ATTENDANCE'];
    const LAB_EXAMS    = ['LAB_INT1','LAB_INT2'];
    const summary = [];

    for (const sub of subjects) {
      const isLab = sub.type === 'lab';
      const examTypes = isLab ? LAB_EXAMS : THEORY_EXAMS;

      // Count total students for this teacher in this subject
      let studentCount = 0;
      if (sub.type === 'lab') {
        const myBatches = sub.batchTeachers.filter(bt => bt.teacher?.toString() === tid.toString()).map(bt => bt.batch);
        const mySections = sub.batchTeachers.filter(bt => bt.teacher?.toString() === tid.toString()).map(bt => bt.section);
        studentCount = await require('../models/Student').countDocuments({
          program: sub.program, branch: sub.department, semester: sub.semester,
          labBatch: { $in: myBatches }
        });
      } else {
        const mySections = sub.sectionTeachers.filter(st => st.teacher?.toString() === tid.toString()).map(st => st.section);
        studentCount = await require('../models/Student').countDocuments({
          program: sub.program, branch: sub.department, semester: sub.semester,
          ...(mySections.length ? { section: { $in: mySections } } : {})
        });
      }

      // Check configuration status
      const configs = await ExamConfig.find({ subject: sub._id });
      const configuredExams = new Set(configs.map(c => c.examType));

      // Check marks entry status
      const theoryMarks = await TheoryMarks.find({ subject: sub._id, academicYear: year });
      const labMarks    = await LabMarks.find({ subject: sub._id, academicYear: year });
      const publishedCount = theoryMarks.filter(m => m.status === 'submitted' || m.status === 'approved').length +
                              labMarks.filter(m => m.status === 'submitted' || m.status === 'approved').length;
      const draftCount = theoryMarks.filter(m => m.status === 'draft').length +
                          labMarks.filter(m => m.status === 'draft').length;

      const examStatus = {};
      for (const et of examTypes) {
        const cfgKey = isLab ? et : et;
        const marksKey = { CT1:'ct1',CT2:'ct2',ASGN1:'asgn1',ASGN2:'asgn2',ST1:'st1',ST2:'st2',ST3:'st3' }[et];
        let enteredCount = 0;
        if (marksKey) {
          enteredCount = theoryMarks.filter(m => m[marksKey]?.total !== null && m[marksKey]?.total !== undefined).length;
        } else if (et === 'ATTENDANCE') {
          enteredCount = theoryMarks.filter(m => m.attendance?.percentage !== null && m.attendance?.percentage !== undefined).length;
        } else if (et === 'LAB_INT1') {
          enteredCount = labMarks.filter(m => m.int1?.total !== null && m.int1?.total !== undefined).length;
        } else if (et === 'LAB_INT2') {
          enteredCount = labMarks.filter(m => m.int2?.total !== null && m.int2?.total !== undefined).length;
        }
        examStatus[et] = {
          configured: configuredExams.has(et) || et === 'ATTENDANCE',
          entered:    enteredCount,
          total:      studentCount,
          complete:   studentCount > 0 && enteredCount >= studentCount
        };
      }

      const allComplete = Object.values(examStatus).every(e => e.complete);
      const anyEntered  = Object.values(examStatus).some(e => e.entered > 0);
      const isPublished = publishedCount > 0;

      summary.push({
        subject: {
          id:       sub._id,
          name:     sub.name,
          code:     sub.code,
          type:     sub.type,
          semester: sub.semester,
        },
        studentCount,
        examStatus,
        isPublished,
        allComplete,
        anyEntered,
        draftCount,
        publishedCount,
        status: isPublished ? 'published' : allComplete ? 'ready' : anyEntered ? 'in-progress' : 'not-started'
      });
    }

    res.json(summary);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MARK ENTRY DEADLINE (admin sets, teacher sees) ────────────────────────
// Stored in subject document via a simple deadline field

// ── BULK MARKS UPLOAD FROM EXCEL ──────────────────────────────────────────
// Teacher downloads a template with all students and question columns,
// fills marks in Excel, then uploads. System parses and saves.
const multerMemory = require('multer').memoryStorage ? require('multer')({ storage: require('multer').memoryStorage() }) : null;

router.get('/marks-template', auth, async (req, res) => {
  try {
    const { subjectId, examType } = req.query;
    const XLSX = require('xlsx');
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const examCfg = await ExamConfig.findOne({ subject: subjectId, examType });
    const tid = req.user._id.toString();

    // Get students for this teacher
    let studentQuery = { program: subject.program, branch: subject.department, semester: subject.semester };
    if (subject.type === 'lab') {
      const myBatches = subject.batchTeachers.filter(bt => bt.teacher?.toString() === tid).map(bt => bt.batch);
      if (myBatches.length) studentQuery.labBatch = { $in: myBatches };
    } else {
      const mySecs = subject.sectionTeachers.filter(st => st.teacher?.toString() === tid).map(st => st.section);
      if (mySecs.length) studentQuery.section = { $in: mySecs };
    }
    const students = await Student.find(studentQuery).select('name usn section').sort({ section:1, usn:1 });

    // Build header row
    const qs = examCfg?.questions || [];
    const headers = ['USN','Name','Section'];

    if (examType === 'ATTENDANCE') {
      headers.push('Total Conducted', 'Attended', 'Medical Condonation (YES/NO)');
    } else {
      qs.forEach(q => headers.push(`Q${q.qNo} (max ${q.maxMarks}) [${q.coNo}]`));
      headers.push('Absent (YES/NO)');
    }

    // Build data rows (pre-filled with student info, marks blank)
    const rows = [headers];
    students.forEach(s => {
      const row = [s.usn, s.name, s.section];
      if (examType === 'ATTENDANCE') {
        row.push('', '', 'NO');
      } else {
        qs.forEach(() => row.push(''));
        row.push('NO');
      }
      rows.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Style header row
    ws['!cols'] = headers.map((h,i) => ({ wch: i < 3 ? 18 : 22 }));

    XLSX.utils.book_append_sheet(wb, ws, `${examType} Marks`);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="${subject.code}_${examType}_template.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/marks-upload', auth, require('multer')({ storage: require('multer').memoryStorage() }).single('file'), async (req, res) => {
  try {
    const { subjectId, examType } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const XLSX = require('xlsx');
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) return res.status(400).json({ message: 'File has no data rows' });

    const academicYear = getAcademicYear();
    const examCfg = await ExamConfig.findOne({ subject: subjectId, examType });
    const qs = examCfg?.questions || [];

    const headers = rows[0]; // First row = headers
    const dataRows = rows.slice(1).filter(r => r[0]); // Skip empty rows

    const saved = [], errors = [];

    for (const row of dataRows) {
      try {
        const usn = String(row[0] || '').trim().toUpperCase();
        if (!usn) continue;

        const student = await Student.findOne({ usn });
        if (!student) { errors.push(`USN ${usn}: not found`); continue; }

        let tm = await TheoryMarks.findOne({ student: student._id, subject: subjectId, academicYear });
        if (!tm) tm = await TheoryMarks.findOne({ student: student._id, subject: subjectId }) || new TheoryMarks({ student: student._id, subject: subjectId, teacher: req.user._id, academicYear });
        if (tm.academicYear !== academicYear) tm.academicYear = academicYear;

        const fieldMap = { CT1:'ct1', CT2:'ct2', ST1:'st1', ST2:'st2', ST3:'st3', ASGN1:'asgn1', ASGN2:'asgn2' };
        const key = fieldMap[examType];

        if (examType === 'ATTENDANCE') {
          const conducted = Number(row[3]) || 0;
          const attended  = Number(row[4]) || 0;
          const medical   = String(row[5] || '').toUpperCase() === 'YES';
          const pct = conducted > 0 ? Math.round((attended / conducted) * 100) : 0;
          tm.attendance = { totalConducted: conducted, attended, percentage: pct, medicalCondonation: medical };
        } else if (key) {
          const isAbsent = String(row[row.length - 1] || '').toUpperCase() === 'YES';
          const questions = qs.map((q, qi) => {
            const rawMark = row[3 + qi]; // columns: USN, Name, Section, Q1, Q2...
            const marks = isAbsent ? null : Math.min(Math.max(Number(rawMark) || 0, 0), q.maxMarks);
            return { qNo: q.qNo, marks: isAbsent ? null : marks };
          });
          const total = isAbsent ? null : questions.reduce((s, q) => s + (q.marks || 0), 0);
          tm[key] = { questions, total, isAbsent };
        }

        tm.compute();
        await tm.save();
        saved.push(usn);
      } catch(rowErr) {
        errors.push(`Row ${row[0]}: ${rowErr.message}`);
      }
    }

    res.json({
      message: `Saved ${saved.length} records${errors.length ? `, ${errors.length} errors` : ''}`,
      saved: saved.length,
      errors: errors.length,
      errorDetails: errors
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── AI: MARKS ANOMALY DETECTION ───────────────────────────────────────────
// Called after teacher saves marks — detects unusual patterns
router.post('/ai/anomaly-check', auth, async (req, res) => {
  try {
    const { subjectId, examType } = req.body;
    const year = getAcademicYear();

    const subject = await Subject.findById(subjectId);
    const marks   = await TheoryMarks.find({ subject: subjectId, academicYear: year })
      .populate('student', 'name usn');

    if (marks.length < 3) return res.json({ anomalies: [], message: 'Not enough data for analysis' });

    const fieldMap = { CT1:'ct1', CT2:'ct2', ST1:'st1', ST2:'st2', ST3:'st3', ASGN1:'asgn1', ASGN2:'asgn2' };
    const key = fieldMap[examType];
    if (!key) return res.json({ anomalies: [], message: 'No anomaly check for this exam type' });

    const values = marks
      .filter(m => m[key]?.total != null && !m[key]?.isAbsent)
      .map(m => ({ name: m.student?.name, usn: m.student?.usn, score: m[key].total }));

    if (values.length < 3) return res.json({ anomalies: [], message: 'Not enough submitted data' });

    const scores = values.map(v => v.score);
    const mean   = scores.reduce((a,b)=>a+b,0) / scores.length;
    const std    = Math.sqrt(scores.reduce((s,v)=>s+Math.pow(v-mean,2),0)/scores.length);
    const max    = examType.startsWith('CT') ? 20 : examType.startsWith('ASGN') ? 10 : 5;
    const classAvgPct = Math.round((mean/max)*100);

    const anomalies = [];

    // 1. Students who scored > 2 std deviations below mean (potential outlier)
    values.forEach(v => {
      if (v.score < mean - 2*std && std > 1) {
        anomalies.push({ type:'outlier_low', student:v.name, usn:v.usn, score:v.score, detail:`Scored ${v.score}/${max} — significantly below class average of ${mean.toFixed(1)}` });
      }
    });

    // 2. Entire class performing poorly (< 40% average)
    if (classAvgPct < 40 && values.length >= 5) {
      anomalies.push({ type:'class_low', student:null, usn:null, score:mean, detail:`Class average is only ${classAvgPct}% (${mean.toFixed(1)}/${max}). Question paper may have been too difficult.` });
    }

    // 3. Zero scores that aren't marked absent
    values.filter(v => v.score === 0).forEach(v => {
      anomalies.push({ type:'zero_score', student:v.name, usn:v.usn, score:0, detail:`Scored 0/${max} but not marked absent. Verify if intentional.` });
    });

    // 4. Maximum possible score (everyone getting full marks — unlikely unless easy paper)
    const fullScorers = values.filter(v => v.score === max);
    if (fullScorers.length > values.length * 0.3 && values.length >= 5) {
      anomalies.push({ type:'many_full', student:null, usn:null, score:max, detail:`${fullScorers.length} students scored full marks (${max}/${max}). Verify question paper difficulty.` });
    }

    // 5. CT performance drop — compare CT1 vs CT2
    if (examType === 'CT2') {
      const ct1Marks = await TheoryMarks.find({ subject: subjectId, academicYear: year })
        .populate('student','name usn');
      const drops = [];
      marks.forEach(m2 => {
        const m1 = ct1Marks.find(m => m.student?._id?.toString() === m2.student?._id?.toString());
        if (m1?.ct1?.total != null && m2?.ct2?.total != null && !m1.ct1.isAbsent && !m2.ct2.isAbsent) {
          const drop = m1.ct1.total - m2.ct2.total;
          if (drop >= 8) drops.push({ name: m2.student?.name, usn: m2.student?.usn, ct1: m1.ct1.total, ct2: m2.ct2.total, drop });
        }
      });
      if (drops.length >= 3) {
        anomalies.push({
          type:'ct_drop',
          student:null, usn:null, score:null,
          detail:`${drops.length} students show a significant drop from CT1 to CT2 (≥8 marks). Check: ${drops.slice(0,3).map(d=>`${d.name}: ${d.ct1}→${d.ct2}`).join(', ')}${drops.length>3?'...':''}`
        });
      }
    }

    res.json({
      anomalies,
      stats: { count: values.length, mean: mean.toFixed(1), std: std.toFixed(1), classAvgPct, max },
      subject: { name: subject?.name, code: subject?.code },
      examType
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
