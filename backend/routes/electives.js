const router        = require('express').Router();
const { protect, adminOnly, teacherOnly, studentOnly } = require('../middleware/auth');
const ElectiveGroup = require('../models/ElectiveGroup');
const ElectiveChoice= require('../models/ElectiveChoice');
const Student       = require('../models/Student');
const Teacher       = require('../models/Teacher');

const adminAuth   = [protect, adminOnly];
const studentAuth = [protect, studentOnly];
const teacherAuth = [protect, teacherOnly];

const getConfig = () => {
  try {
    const p = require('path').join(__dirname,'../config.json');
    return JSON.parse(require('fs').readFileSync(p,'utf8'));
  } catch { return { academicYear: '2026-27' }; }
};

// ═══════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════

router.get('/admin/groups', adminAuth, async (req, res) => {
  try {
    const admin  = await Teacher.findById(req.user._id).select('department');
    const { program, targetSemester } = req.query;
    const year   = getConfig().academicYear;
    const query  = { department: admin.department, academicYear: year };
    if (program)         query.program         = program;
    if (targetSemester)  query.targetSemester  = Number(targetSemester);
    const groups = await ElectiveGroup.find(query)
      .populate('subjects.assignments.teacher','name employeeId')
      .sort({ targetSemester:1, slotLabel:1 });
    res.json(groups);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/admin/groups', adminAuth, async (req, res) => {
  try {
    const admin = await Teacher.findById(req.user._id).select('department');
    const { program, currentSemester, targetSemester, slotLabel, slotType,
            subjects, registrationOpen, registrationClose } = req.body;

    if (!subjects?.length)
      return res.status(400).json({ message: 'Add at least one subject option' });
    if (!registrationOpen || !registrationClose)
      return res.status(400).json({ message: 'Set registration window' });
    if (!currentSemester || !targetSemester)
      return res.status(400).json({ message: 'Set current and target semester' });
    if (Number(targetSemester) !== Number(currentSemester) + 1)
      return res.status(400).json({ message: 'Target semester must be current + 1' });

    const group = new ElectiveGroup({
      department:       admin.department,
      program,
      currentSemester:  Number(currentSemester),
      targetSemester:   Number(targetSemester),
      academicYear:     getConfig().academicYear,
      slotLabel,
      slotType:         slotType||'professional',
      subjects:         subjects.map(s => ({
        subjectCode:    s.subjectCode,
        subjectName:    s.subjectName,
        hasLab:         s.hasLab||false,
        labCode:        s.labCode||'',
        labName:        s.labName||'',
        minEnrollment:  s.minEnrollment||5,
        assignments:    [],
        status:         'pending',
        enrollmentCount:0,
      })),
      registrationOpen:  new Date(registrationOpen),
      registrationClose: new Date(registrationClose),
      status:    'draft',
      createdBy: req.user._id,
    });
    await group.save();
    res.json(group);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.put('/admin/groups/:id', adminAuth, async (req, res) => {
  try {
    const group = await ElectiveGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    if (group.status === 'allotted')
      return res.status(400).json({ message: 'Cannot edit after allotment' });
    const { slotLabel, slotType, subjects, registrationOpen, registrationClose } = req.body;
    if (slotLabel)         group.slotLabel         = slotLabel;
    if (slotType)          group.slotType           = slotType;
    if (registrationOpen)  group.registrationOpen   = new Date(registrationOpen);
    if (registrationClose) group.registrationClose  = new Date(registrationClose);
    if (subjects) group.subjects = subjects.map(s => ({
      subjectCode:     s.subjectCode,
      subjectName:     s.subjectName,
      hasLab:          s.hasLab||false,
      labCode:         s.labCode||'',
      labName:         s.labName||'',
      minEnrollment:   s.minEnrollment||5,
      assignments:     s.assignments||[],
      status:          s.status||'pending',
      enrollmentCount: s.enrollmentCount||0,
    }));
    await group.save();
    res.json(group);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/admin/groups/:id/open', adminAuth, async (req, res) => {
  try {
    const group = await ElectiveGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    group.status = 'open';
    await group.save();
    res.json({ message: 'Registration opened — students can now submit preferences' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/admin/groups/:id/close', adminAuth, async (req, res) => {
  try {
    const group = await ElectiveGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    group.status = 'closed';
    for (const sub of group.subjects) {
      sub.enrollmentCount = await ElectiveChoice.countDocuments({
        electiveGroup: group._id, pref1: sub.subjectCode
      });
    }
    await group.save();
    res.json({ message: 'Registration closed', group });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Summary: enrollment counts + detained student flagging ────────────
router.get('/admin/groups/:id/summary', adminAuth, async (req, res) => {
  try {
    const group   = await ElectiveGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });

    const choices = await ElectiveChoice.find({ electiveGroup: req.params.id })
      .populate('student','name usn section status');

    const summary = group.subjects.map(sub => {
      const chose = choices.filter(c => c.pref1 === sub.subjectCode);
      return {
        subjectCode:     sub.subjectCode,
        subjectName:     sub.subjectName,
        hasLab:          sub.hasLab,
        labCode:         sub.labCode,
        labName:         sub.labName,
        minEnrollment:   sub.minEnrollment,
        status:          sub.status,
        assignments:     sub.assignments,
        enrollmentCount: chose.length,
        // Eligible = not detained
        eligibleCount:   chose.filter(c => c.student?.status !== 'Detained').length,
        students: chose.map(c => ({
          id:        c.student?._id,
          name:      c.student?.name,
          usn:       c.student?.usn,
          section:   c.student?.section,
          isDetained:c.student?.status === 'Detained',
          choiceId:  c._id,
          status:    c.status,
          pref2:     c.pref2,
          pref3:     c.pref3,
          allotted:  c.allottedSubjectCode,
        })),
        pref2Count: choices.filter(c => c.pref2 === sub.subjectCode).length,
        pref3Count: choices.filter(c => c.pref3 === sub.subjectCode).length,
      };
    });

    // Students who didn't submit — use currentSemester (what they're in now)
    const allStudents = await Student.find({
      branch: group.department, program: group.program,
      semester: group.currentSemester // FIX: query by currentSemester not targetSemester
    });
    const submitted = new Set(choices.map(c => c.student?._id?.toString()));
    const notSubmitted = allStudents
      .filter(s => !submitted.has(s._id.toString()))
      .map(s => ({ id:s._id, name:s.name, usn:s.usn, section:s.section, isDetained: s.status==='Detained' }));

    // Detained students who submitted (should be excluded from allotment)
    const detainedSubmitted = choices
      .filter(c => c.student?.status === 'Detained')
      .map(c => ({ id:c.student._id, name:c.student.name, usn:c.student.usn, choiceId:c._id }));

    res.json({ group, summary, notSubmitted, totalChoices: choices.length, detainedSubmitted });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Assign teacher to subject (with optional split) ───────────────────
router.post('/admin/groups/:id/assign-teacher', adminAuth, async (req, res) => {
  try {
    const { subjectCode, teacherId, splitLabel, studentIds } = req.body;
    const group = await ElectiveGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });
    const sub = group.subjects.find(s => s.subjectCode === subjectCode);
    if (!sub) return res.status(404).json({ message: 'Subject not found' });
    const existing = sub.assignments.find(a =>
      a.teacher?.toString() === teacherId && a.splitLabel === (splitLabel||'A')
    );
    if (existing) {
      existing.studentIds = studentIds||[];
    } else {
      sub.assignments.push({ teacher:teacherId, splitLabel:splitLabel||'A', studentIds:studentIds||[] });
    }
    sub.status = 'running';
    await group.save();
    res.json({ message: 'Teacher assigned', group });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── Finalize allotments ───────────────────────────────────────────────
// Fixes:
// 1. Detained students auto-excluded
// 2. pref2/pref3 fallback when subject cancelled
// 3. studentIds populated on assignments so teacher can see students
router.post('/admin/groups/:id/allot', adminAuth, async (req, res) => {
  try {
    const { allotments, cancelSubjects } = req.body;
    const group = await ElectiveGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Not found' });

    const validCodes = group.subjects.map(s => s.subjectCode);
    const cancelSet  = new Set(cancelSubjects||[]);

    // Mark cancelled subjects
    for (const code of cancelSet) {
      const sub = group.subjects.find(s => s.subjectCode === code);
      if (sub) sub.status = 'cancelled';
    }

    // Process each allotment
    for (const a of (allotments||[])) {
      const choice = await ElectiveChoice.findById(a.choiceId)
        .populate('student','status name usn');

      if (!choice) continue;

      // Skip detained students — reject them automatically
      if (choice.student?.status === 'Detained') {
        choice.status          = 'rejected';
        choice.rejectionReason = 'Student is detained due to attendance shortage — elective allotment deferred';
        await choice.save();
        continue;
      }

      // If student's allotted subject was cancelled, try fallback to pref2/pref3
      let finalCode = a.subjectCode;
      let finalName = a.subjectName;
      if (cancelSet.has(finalCode)) {
        // Try pref2
        if (choice.pref2 && !cancelSet.has(choice.pref2)) {
          const sub2 = group.subjects.find(s => s.subjectCode === choice.pref2);
          if (sub2) { finalCode = sub2.subjectCode; finalName = sub2.subjectName; }
        }
        // Try pref3
        else if (choice.pref3 && !cancelSet.has(choice.pref3)) {
          const sub3 = group.subjects.find(s => s.subjectCode === choice.pref3);
          if (sub3) { finalCode = sub3.subjectCode; finalName = sub3.subjectName; }
        }
        // No fallback — reject
        else {
          choice.status          = 'rejected';
          choice.rejectionReason = `${a.subjectCode} cancelled and no valid fallback preference — please contact admin`;
          await choice.save();
          continue;
        }
      }

      choice.allottedSubjectCode = finalCode;
      choice.allottedSubjectName = finalName;
      choice.allottedSplitLabel  = a.splitLabel||'';
      choice.status              = 'confirmed';
      await choice.save();
    }

    // Populate studentIds on each assignment so teacher can see their students
    for (const sub of group.subjects) {
      if (sub.status === 'cancelled') continue;
      // Get all confirmed choices for this subject
      const confirmed = await ElectiveChoice.find({
        electiveGroup: group._id,
        allottedSubjectCode: sub.subjectCode,
        status: 'confirmed'
      }).populate('student', 'usn');

      if (sub.assignments.length <= 1) {
        // Single teacher — gets all students
        if (sub.assignments.length === 1)
          sub.assignments[0].studentIds = confirmed.map(c => c.student._id);
      } else {
        // Multiple teachers (Split A/B):
        // 1. Choices with an explicit split label go to that split.
        // 2. Remaining students are sorted by roll number and split into
        //    contiguous equal chunks (first half -> A, second half -> B).
        const labels    = sub.assignments.map(a => a.splitLabel);
        const explicit  = confirmed.filter(ch => ch.allottedSplitLabel && labels.includes(ch.allottedSplitLabel));
        const remaining = confirmed.filter(ch => !ch.allottedSplitLabel || !labels.includes(ch.allottedSplitLabel))
          .sort((a, b) => String(a.student?.usn||'').localeCompare(String(b.student?.usn||'')));

        const buckets = {};
        labels.forEach(l => { buckets[l] = []; });
        explicit.forEach(ch => buckets[ch.allottedSplitLabel].push(ch));

        const chunk = Math.ceil(remaining.length / sub.assignments.length);
        sub.assignments.forEach((asgn, i) => {
          const slice = remaining.slice(i * chunk, (i + 1) * chunk);
          buckets[asgn.splitLabel].push(...slice);
        });

        // Save distribution + write the split label back to each choice
        for (const asgn of sub.assignments) {
          asgn.studentIds = buckets[asgn.splitLabel].map(ch => ch.student._id);
          for (const ch of buckets[asgn.splitLabel]) {
            if (ch.allottedSplitLabel !== asgn.splitLabel) {
              ch.allottedSplitLabel = asgn.splitLabel;
              await ch.save();
            }
          }
        }
      }
      sub.status = 'running';
    }

    group.status         = 'allotted';
    group.resultDeclared = true;
    await group.save();

    res.json({ message: 'Allotments finalized — students can see their results' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.delete('/admin/groups/:id', adminAuth, async (req, res) => {
  try {
    await ElectiveGroup.findByIdAndDelete(req.params.id);
    await ElectiveChoice.deleteMany({ electiveGroup: req.params.id });
    res.json({ message: 'Deleted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// STUDENT
// ═══════════════════════════════════════════════════════════════════════

// FIX: match student.semester against group.currentSemester (not targetSemester)
router.get('/student/available', studentAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.user._id);
    const year    = getConfig().academicYear;

    const groups = await ElectiveGroup.find({
      department:      student.branch,
      program:         student.program,
      currentSemester: student.semester, // student is in currentSemester right now
      academicYear:    year,
      status:          { $in: ['open','closed','allotted'] },
    }).select('-subjects.assignments.studentIds');

    const result = await Promise.all(groups.map(async g => {
      const choice = await ElectiveChoice.findOne({
        student: req.user._id, electiveGroup: g._id
      });
      return {
        group: {
          _id:               g._id,
          slotLabel:         g.slotLabel,
          slotType:          g.slotType,
          currentSemester:   g.currentSemester,
          targetSemester:    g.targetSemester,
          status:            g.status,
          registrationOpen:  g.registrationOpen,
          registrationClose: g.registrationClose,
          resultDeclared:    g.resultDeclared,
          subjects:          g.subjects.map(s => ({
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
            hasLab:      s.hasLab,
            labCode:     s.labCode,
            labName:     s.labName,
            status:      s.status,
          })),
        },
        choice: choice ? {
          _id:                 choice._id,
          pref1:               choice.pref1,
          pref2:               choice.pref2,
          pref3:               choice.pref3,
          status:              choice.status,
          allottedSubjectCode: choice.allottedSubjectCode,
          allottedSubjectName: choice.allottedSubjectName,
          allottedSplitLabel:  choice.allottedSplitLabel,
          rejectionReason:     choice.rejectionReason,
        } : null,
      };
    }));

    res.json(result);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

router.post('/student/submit', studentAuth, async (req, res) => {
  try {
    const { groupId, pref1, pref2, pref3 } = req.body;
    if (!pref1) return res.status(400).json({ message: '1st preference is required' });

    const group = await ElectiveGroup.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (group.status !== 'open')
      return res.status(400).json({ message: 'Registration is not open' });

    const now = new Date();
    if (now < new Date(group.registrationOpen))
      return res.status(400).json({ message: 'Registration has not started yet' });
    if (now > new Date(group.registrationClose))
      return res.status(400).json({ message: 'Registration deadline has passed' });

    // Check student is not detained
    const student = await Student.findById(req.user._id);
    if (student.status === 'Detained')
      return res.status(400).json({ message: 'Detained students cannot register for electives' });

    const validCodes = group.subjects.map(s => s.subjectCode);
    if (!validCodes.includes(pref1))
      return res.status(400).json({ message: 'Invalid 1st preference' });
    if (pref2 && !validCodes.includes(pref2))
      return res.status(400).json({ message: 'Invalid 2nd preference' });
    if (pref3 && !validCodes.includes(pref3))
      return res.status(400).json({ message: 'Invalid 3rd preference' });
    if (pref2 && pref2 === pref1)
      return res.status(400).json({ message: '2nd preference must differ from 1st' });
    if (pref3 && (pref3 === pref1 || pref3 === pref2))
      return res.status(400).json({ message: '3rd preference must differ from others' });

    const choice = await ElectiveChoice.findOneAndUpdate(
      { student: req.user._id, electiveGroup: groupId },
      {
        student:       req.user._id,
        electiveGroup: groupId,
        department:    student.branch,
        program:       student.program,
        semester:      group.targetSemester, // store the target sem they're registering for
        academicYear:  getConfig().academicYear,
        pref1, pref2: pref2||'', pref3: pref3||'',
        status:        'submitted',
        submittedAt:   new Date(),
      },
      { upsert:true, new:true }
    );

    res.json({ message: 'Preferences submitted successfully', choice });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════
// TEACHER — see their elective students (now works via populated studentIds)
// ═══════════════════════════════════════════════════════════════════════
router.get('/teacher/my-electives', teacherAuth, async (req, res) => {
  try {
    const year   = getConfig().academicYear;
    const groups = await ElectiveGroup.find({
      'subjects.assignments.teacher': req.user._id,
      academicYear: year,
    }).populate('subjects.assignments.teacher','name');

    const result = [];
    for (const group of groups) {
      for (const sub of group.subjects) {
        const myAssignments = sub.assignments.filter(
          a => a.teacher?._id?.toString() === req.user._id.toString()
        );
        if (!myAssignments.length) continue;
        for (const asgn of myAssignments) {
          const students = await Student.find({ _id: { $in: asgn.studentIds } })
            .select('name usn section semester').sort({ usn:1 });
          result.push({
            groupId:      group._id,
            slotLabel:    group.slotLabel,
            targetSemester: group.targetSemester,
            program:      group.program,
            subjectCode:  sub.subjectCode,
            subjectName:  sub.subjectName,
            hasLab:       sub.hasLab,
            labCode:      sub.labCode,
            labName:      sub.labName,
            splitLabel:   asgn.splitLabel,
            studentCount: students.length,
            students,
          });
        }
      }
    }
    res.json(result);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
