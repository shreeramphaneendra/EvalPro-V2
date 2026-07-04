const router      = require('express').Router();
const { protect, teacherOnly, studentOnly } = require('../middleware/auth');
const SlipTest    = require('../models/SlipTest');
const SlipTestAttempt = require('../models/SlipTestAttempt');
const Student     = require('../models/Student');
const Subject     = require('../models/Subject');
const TheoryMarks = require('../models/TheoryMarks');

const teacherAuth = [protect, teacherOnly];
const studentAuth = [protect, studentOnly];

const getAcademicYear = () => {
  try {
    const p = require('path').join(__dirname,'../config.json');
    return JSON.parse(require('fs').readFileSync(p,'utf8')).academicYear || '2026-27';
  } catch { return '2026-27'; }
};

// ── TEACHER: CREATE/UPDATE SLIP TEST ──────────────────────────────────────
router.post('/create', teacherAuth, async (req, res) => {
  try {
    const {
      subjectId, slot, section, title, instructions,
      questions, duration, windowStart, windowEnd
    } = req.body;

    if (!questions?.length) return res.status(400).json({ message: 'Add at least one question' });
    if (!windowStart || !windowEnd) return res.status(400).json({ message: 'Set test window' });
    if (new Date(windowEnd) <= new Date(windowStart)) return res.status(400).json({ message: 'Window end must be after start' });
    if (!duration || duration < 1) return res.status(400).json({ message: 'Set a valid duration' });

    const totalMarks = questions.reduce((s,q) => s + (Number(q.marks)||0), 0);
    if (totalMarks === 0) return res.status(400).json({ message: 'Total marks cannot be 0' });

    // Check if one already exists for this slot+section
    const existing = await SlipTest.findOne({
      subject: subjectId, slot, section: section||null,
      teacher: req.user._id
    });

    if (existing) {
      // Update existing — this is a re-run of the test, so clear ALL old attempts
      // (otherwise students who attempted the previous run stay locked out with stale scores)
      const cleared = await SlipTestAttempt.deleteMany({ slipTest: existing._id });
      Object.assign(existing, { title, instructions, questions, totalMarks, duration,
        windowStart: new Date(windowStart), windowEnd: new Date(windowEnd), status:'draft' });
      await existing.save();
      return res.json({ ...existing.toObject(),
        _clearedAttempts: cleared.deletedCount,
        message: cleared.deletedCount > 0
          ? `Test updated · ${cleared.deletedCount} previous attempt(s) cleared — all students can attempt fresh`
          : 'Test updated' });
    }

    const test = new SlipTest({
      subject: subjectId, teacher: req.user._id,
      slot, section: section||null, title, instructions,
      questions, totalMarks, duration,
      windowStart: new Date(windowStart), windowEnd: new Date(windowEnd),
      academicYear: getAcademicYear()
    });
    await test.save();
    res.json(test);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: GET MY SLIP TESTS ────────────────────────────────────────────
router.get('/my-tests', teacherAuth, async (req, res) => {
  try {
    const { subjectId } = req.query;
    const query = { teacher: req.user._id };
    if (subjectId) query.subject = subjectId;
    const tests = await SlipTest.find(query)
      .populate('subject','name code semester')
      .sort({ createdAt: -1 });
    res.json(tests);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: GET AVAILABLE TESTS ──────────────────────────────────────────
router.get('/student/available', studentAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.user._id);
    const now = new Date();

    // Find tests for student's subjects/semester
    // Subject model uses 'department' field, Student model uses 'branch'
    const esc = s => String(s||'').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const subjects = await Subject.find({
      department: { $regex: `^${esc(student.branch)}$`, $options: 'i' },
      program:    { $regex: `^${esc(student.program)}$`, $options: 'i' },
      semester:   student.semester
    });
    const subjectIds = subjects.map(s => s._id);

    // Tests in their live window OR tests the student already attempted
    // (so scores stay visible after the window closes)
    const sectionMatch = { $or: [{ section: null }, { section: String(student.section) }, { section: Number(student.section) }] };
    const liveTests = await SlipTest.find({
      subject: { $in: subjectIds },
      status: 'active',
      windowStart: { $lte: now },
      windowEnd:   { $gte: now },
      ...sectionMatch
    }).populate('subject','name code');

    const myAttempts = await SlipTestAttempt.find({ student: req.user._id }).select('slipTest');
    const attemptedIds = myAttempts.map(a => a.slipTest);
    const attemptedTests = await SlipTest.find({
      _id: { $in: attemptedIds },
      subject: { $in: subjectIds },
    }).populate('subject','name code');

    // Merge, dedupe by id
    const seen = new Set();
    const tests = [...liveTests, ...attemptedTests].filter(t => {
      const id = t._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Check attempt status for each
    const result = await Promise.all(tests.map(async t => {
      const attempt = await SlipTestAttempt.findOne({ slipTest: t._id, student: req.user._id });
      return {
        test: {
          _id: t._id, title: t.title, subject: t.subject,
          slot: t.slot, duration: t.duration,
          windowEnd: t.windowEnd, totalMarks: t.totalMarks,
          questionCount: t.questions.length
        },
        attemptStatus: attempt?.status || 'not_started',
        scaledScore:   attempt?.scaledScore,
        graded:        attempt?.graded,
      };
    }));

    res.json(result);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: GET TEST DETAILS (for briefing page) ────────────────────────
router.get('/student/test/:id', studentAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id)
      .populate('subject','name code semester');
    if (!test) return res.status(404).json({ message: 'Test not found' });
    if (test.status !== 'active') return res.status(400).json({ message: 'Test is not active' });
    // Return test info WITHOUT correct answers
    res.json({
      _id:          test._id,
      title:        test.title,
      instructions: test.instructions,
      slot:         test.slot,
      duration:     test.duration,
      windowStart:  test.windowStart,
      windowEnd:    test.windowEnd,
      totalMarks:   test.totalMarks,
      subject:      test.subject,
      questions:    test.questions.map(q => ({
        qNo:     q.qNo,
        type:    q.type,
        text:    q.text,
        marks:   q.marks,
        options: q.options || []
        // correct answer NOT sent
      }))
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: GET SINGLE TEST ──────────────────────────────────────────────
router.get('/:id', teacherAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id).populate('subject','name code');
    if (!test) return res.status(404).json({ message: 'Test not found' });
    res.json(test);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: PUBLISH TEST ─────────────────────────────────────────────────
router.post('/:id/publish', teacherAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Not found' });
    if (!test.questions.length) return res.status(400).json({ message: 'No questions' });
    test.status = 'active';
    await test.save();
    res.json({ message: 'Test published — students can now see it' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: CLOSE TEST ───────────────────────────────────────────────────
router.post('/:id/close', teacherAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Not found' });
    test.status = 'closed';
    await test.save();

    // Auto-submit any in-progress attempts
    const inProgress = await SlipTestAttempt.find({ slipTest: req.params.id, status: 'in_progress' });
    for (const attempt of inProgress) {
      attempt.status = 'submitted';
      attempt.autoSubmitted = true;
      attempt.autoSubmitReason = 'test_closed';
      attempt.submitTime = new Date();
      attempt.timeSpent = Math.floor((new Date() - new Date(attempt.startTime)) / 1000);
      await autoGradeMCQ(attempt);
      await attempt.save();
    }

    // Auto-push MCQ-only test scores to CIE immediately
    const hasMCQOnly = test.questions.every(q => q.type === 'mcq');
    if (hasMCQOnly) {
      const allAttempts = await SlipTestAttempt.find({ slipTest: req.params.id, status: 'submitted' });
      const year = getAcademicYear();
      let pushed = 0;
      for (const attempt of allAttempts) {
        if (!attempt.graded) continue; // autoGradeMCQ sets graded=true for MCQ-only
        let tm = await TheoryMarks.findOne({ student: attempt.student, subject: test.subject, academicYear: year });
        if (!tm) tm = new TheoryMarks({ student: attempt.student, subject: test.subject, teacher: test.teacher, academicYear: year });
        if (tm.status === 'approved') tm.status = 'submitted';
        const field = test.slot.toLowerCase();
        if (!tm[field]) tm[field] = {};
        tm[field].total    = attempt.scaledScore ?? 0;
        tm[field].isAbsent = false;
        tm[field].questions = [];
        tm.compute();
        await tm.save();
        attempt.pushedToCIE = true;
        await attempt.save();
        pushed++;
      }
      return res.json({ message: `Test closed · ${pushed} MCQ scores auto-pushed to CIE ${test.slot}`, autoPushed: pushed });
    }

    res.json({ message: 'Test closed · Short answers need manual grading before pushing to CIE' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: DELETE TEST ──────────────────────────────────────────────────
router.delete('/:id', teacherAuth, async (req, res) => {
  try {
    await SlipTest.findByIdAndDelete(req.params.id);
    await SlipTestAttempt.deleteMany({ slipTest: req.params.id });
    res.json({ message: 'Deleted' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});


// ── TEACHER: ALLOW RETAKE (delete a student's attempt) ───────────────────
router.delete('/:id/attempts/:attemptId', teacherAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test not found' });
    if (test.teacher.toString() !== req.user._id.toString() && !req.user.isAdmin)
      return res.status(403).json({ message: 'Not your test' });
    const attempt = await SlipTestAttempt.findById(req.params.attemptId);
    if (!attempt || attempt.slipTest.toString() !== req.params.id)
      return res.status(404).json({ message: 'Attempt not found' });
    await SlipTestAttempt.findByIdAndDelete(req.params.attemptId);
    res.json({ message: 'Attempt cleared — student can retake the test' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: GET ALL ATTEMPTS FOR A TEST ─────────────────────────────────
router.get('/:id/attempts', teacherAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Not found' });

    const attempts = await SlipTestAttempt.find({ slipTest: req.params.id })
      .populate('student','name usn section')
      .sort({ 'student.usn': 1 });

    // Get all students who should have taken this test
    const subject = await Subject.findById(test.subject);
    const studentQuery = { program: subject.program, branch: subject.department, semester: subject.semester };
    if (test.section) studentQuery.section = test.section;
    const allStudents = await Student.find(studentQuery).sort({ section:1, usn:1 });

    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.student._id.toString()] = a; });

    const result = allStudents.map(s => ({
      student: { id: s._id, name: s.name, usn: s.usn, section: s.section },
      attempt: attemptMap[s._id.toString()] || null
    }));

    res.json({ test, result, totalStudents: allStudents.length, submitted: attempts.filter(a=>a.status==='submitted').length });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: GRADE SHORT ANSWERS + PUSH TO CIE ───────────────────────────
router.post('/:id/grade', teacherAuth, async (req, res) => {
  try {
    const { grades, pushToCIE } = req.body;
    // grades: [{ attemptId, answers: [{ qNo, marksAwarded }], shortScore }]
    const test = await SlipTest.findById(req.params.id);

    for (const g of grades) {
      const attempt = await SlipTestAttempt.findById(g.attemptId);
      if (!attempt) continue;

      // Update short answer grades
      if (g.answers) {
        for (const ans of g.answers) {
          const a = attempt.answers.find(a => a.qNo === ans.qNo);
          if (a) { a.marksAwarded = ans.marksAwarded; a.isCorrect = ans.marksAwarded > 0; }
        }
      }

      // Recalculate scores
      const mcqScore = attempt.answers
        .filter(a => a.type === 'mcq' && a.marksAwarded != null)
        .reduce((s,a) => s + (a.marksAwarded||0), 0);
      const shortScore = attempt.answers
        .filter(a => a.type === 'short' && a.marksAwarded != null)
        .reduce((s,a) => s + (a.marksAwarded||0), 0);

      attempt.mcqScore   = mcqScore;
      attempt.shortScore = shortScore;
      attempt.totalRaw   = mcqScore + shortScore;
      // Scale to /5
      attempt.scaledScore = test.totalMarks > 0
        ? Math.round((attempt.totalRaw / test.totalMarks) * 5 * 2) / 2 // round to 0.5
        : 0;
      attempt.graded = true;

      // Push to CIE if requested
      if (pushToCIE) {
        const year = getAcademicYear();
        let tm = await TheoryMarks.findOne({ student: attempt.student, subject: test.subject, academicYear: year });
        if (!tm) tm = new TheoryMarks({ student: attempt.student, subject: test.subject, teacher: req.user._id, academicYear: year });
        if (tm.status === 'approved') tm.status = 'submitted';
        const field = test.slot.toLowerCase(); // 'st1', 'st2', 'st3'
        tm[field] = { questions: [], total: attempt.scaledScore, isAbsent: false };
        tm.compute();
        await tm.save();
        attempt.pushedToCIE = true;
      }

      await attempt.save();
    }

    res.json({ message: `Graded ${grades.length} attempts${pushToCIE ? ' and pushed to CIE' : ''}` });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── TEACHER: PUSH ALL GRADED TO CIE ──────────────────────────────────────
router.post('/:id/push-to-cie', teacherAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id);
    const attempts = await SlipTestAttempt.find({ slipTest: req.params.id, graded: true });
    const year = getAcademicYear();
    let pushed = 0;

    for (const attempt of attempts) {
      let tm = await TheoryMarks.findOne({ student: attempt.student, subject: test.subject, academicYear: year });
      if (!tm) tm = new TheoryMarks({ student: attempt.student, subject: test.subject, teacher: req.user._id, academicYear: year });
      if (tm.status === 'approved') tm.status = 'submitted';
      const field = test.slot.toLowerCase();
      if (!tm[field]) tm[field] = {};
      tm[field].total    = attempt.scaledScore ?? 0;
      tm[field].isAbsent = false;
      tm[field].questions = [];
      tm.compute();
      await tm.save();
      attempt.pushedToCIE = true;
      await attempt.save();
      pushed++;
    }

    res.json({ message: `Pushed ${pushed} scores to CIE ${test.slot}` });
  } catch(e) { res.status(500).json({ message: e.message }); }
});


// ── STUDENT: SAVE ANSWER (auto-save as student types) ────────────────────
router.post('/attempt/:attemptId/save-answer', studentAuth, async (req, res) => {
  try {
    const { qNo, selectedOption, textAnswer } = req.body;
    const attempt = await SlipTestAttempt.findById(req.params.attemptId);
    if (!attempt || attempt.student.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not your attempt' });
    if (attempt.status === 'submitted') return res.status(400).json({ message: 'Already submitted' });

    const ans = attempt.answers.find(a => a.qNo === qNo);
    if (ans) {
      if (selectedOption !== undefined) ans.selectedOption = selectedOption;
      if (textAnswer    !== undefined) ans.textAnswer    = textAnswer;
    }
    await attempt.save();
    res.json({ saved: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: LOG VIOLATION ─────────────────────────────────────────────────
router.post('/attempt/:attemptId/violation', studentAuth, async (req, res) => {
  try {
    const { type, detail } = req.body;
    const attempt = await SlipTestAttempt.findById(req.params.attemptId);
    if (!attempt || attempt.student.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not your attempt' });
    if (attempt.status === 'submitted') return res.json({ submitted: true });

    attempt.violations.push({ type, detail, timestamp: new Date() });
    attempt.violationCount = attempt.violations.length;

    // Tab switch = immediate auto-submit
    if (type === 'tab_switch') {
      attempt.status           = 'submitted';
      attempt.autoSubmitted    = true;
      attempt.autoSubmitReason = 'tab_switch';
      attempt.submitTime       = new Date();
      attempt.timeSpent        = Math.floor((new Date() - new Date(attempt.startTime)) / 1000);
      // Auto-grade MCQ
      await autoGradeMCQ(attempt);
      await attempt.save();
      return res.json({ autoSubmitted: true, reason: 'tab_switch' });
    }

    await attempt.save();
    res.json({ violationCount: attempt.violationCount, autoSubmitted: false });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: SUBMIT TEST ──────────────────────────────────────────────────
router.post('/attempt/:attemptId/submit', studentAuth, async (req, res) => {
  try {
    const { answers, autoSubmit, reason } = req.body;
    const attempt = await SlipTestAttempt.findById(req.params.attemptId);
    if (!attempt || attempt.student.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not your attempt' });
    if (attempt.status === 'submitted') return res.json({ message: 'Already submitted' });

    // Merge final answers
    if (answers) {
      for (const a of answers) {
        const existing = attempt.answers.find(x => x.qNo === a.qNo);
        if (existing) {
          if (a.selectedOption !== undefined) existing.selectedOption = a.selectedOption;
          if (a.textAnswer !== undefined)     existing.textAnswer     = a.textAnswer;
        }
      }
    }

    attempt.status        = 'submitted';
    attempt.submitTime    = new Date();
    attempt.timeSpent     = Math.floor((new Date() - new Date(attempt.startTime)) / 1000);
    attempt.autoSubmitted = autoSubmit || false;
    attempt.autoSubmitReason = reason || '';

    // Auto-grade MCQ
    await autoGradeMCQ(attempt);
    await attempt.save();

    res.json({
      message:      'Test submitted successfully',
      mcqScore:     attempt.mcqScore,
      scaledScore:  attempt.scaledScore,
      hasShortAns:  attempt.answers.some(a => a.type === 'short'),
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: GET MY RESULT ─────────────────────────────────────────────────
router.get('/attempt/:attemptId/result', studentAuth, async (req, res) => {
  try {
    const attempt = await SlipTestAttempt.findById(req.params.attemptId)
      .populate('slipTest');
    if (!attempt || attempt.student.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not your attempt' });

    // Only show result after graded or if no short answers
    const hasShort = attempt.answers.some(a => a.type === 'short');
    const canShow  = attempt.graded || !hasShort;

    res.json({
      status:        attempt.status,
      scaledScore:   canShow ? attempt.scaledScore : null,
      mcqScore:      attempt.mcqScore,
      graded:        attempt.graded,
      violationCount:attempt.violationCount,
      autoSubmitted: attempt.autoSubmitted,
      timeSpent:     attempt.timeSpent,
      answers:       attempt.answers,
      slot:          attempt.slot,
      canShowScore:  canShow,
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT: START TEST ───────────────────────────────────────────────────
router.post('/:id/start', studentAuth, async (req, res) => {
  try {
    const test = await SlipTest.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test not found' });
    if (test.status !== 'active') return res.status(400).json({ message: 'Test is not active' });

    const now = new Date();
    if (now < new Date(test.windowStart)) return res.status(400).json({ message: 'Test has not started yet' });
    if (now > new Date(test.windowEnd))   return res.status(400).json({ message: 'Test window has closed' });

    // Check existing attempt
    let attempt = await SlipTestAttempt.findOne({ slipTest: req.params.id, student: req.user._id });
    if (attempt && attempt.status === 'submitted') return res.status(400).json({ message: 'You have already submitted this test' });

    if (!attempt) {
      // Create new attempt — send questions WITHOUT correct answers
      const questions = test.questions.map(q => ({
        qNo:     q.qNo,
        type:    q.type,
        text:    q.text,
        marks:   q.marks,
        options: q.options || [],
        // Never send q.correct to student
      }));

      attempt = new SlipTestAttempt({
        slipTest: req.params.id,
        student:  req.user._id,
        subject:  test.subject,
        slot:     test.slot,
        startTime: now,
        status:   'in_progress',
        answers:  test.questions.map(q => ({
          qNo: q.qNo, type: q.type,
          selectedOption: null, textAnswer: '',
          isCorrect: null, marksAwarded: null, maxMarks: q.marks
        }))
      });
      await attempt.save();
    }

    // Calculate remaining time — capped by BOTH duration AND window end
    const elapsed        = Math.floor((now - new Date(attempt.startTime)) / 1000);
    const durationLeft   = Math.max(0, test.duration * 60 - elapsed);
    const windowLeft     = Math.max(0, Math.floor((new Date(test.windowEnd) - now) / 1000));
    const remaining      = Math.min(durationLeft, windowLeft); // whichever runs out first

    // Send questions without correct answers
    const safeQuestions = test.questions.map(q => ({
      qNo: q.qNo, type: q.type, text: q.text, marks: q.marks,
      options: q.options || []
    }));

    res.json({
      attemptId:    attempt._id,
      questions:    safeQuestions,
      answers:      attempt.answers,
      remainingSec: remaining,
      duration:     test.duration,
      title:        test.title,
      instructions: test.instructions,
      totalMarks:   test.totalMarks,
    });
  } catch(e) { res.status(500).json({ message: e.message }); }
});


// ── HELPER: Auto-grade MCQ + auto-push to CIE if MCQ-only ──────────────
async function autoGradeMCQ(attempt) {
  const test = await SlipTest.findById(attempt.slipTest);
  if (!test) return;

  let mcqScore = 0;
  for (const ans of attempt.answers) {
    if (ans.type === 'mcq') {
      const q = test.questions.find(q => q.qNo === ans.qNo);
      if (q && ans.selectedOption !== null && ans.selectedOption !== undefined) {
        const correct    = ans.selectedOption === q.correct;
        ans.isCorrect    = correct;
        ans.marksAwarded = correct ? q.marks : 0;
        mcqScore        += ans.marksAwarded;
      } else {
        ans.isCorrect    = false;
        ans.marksAwarded = 0;
      }
    }
  }

  attempt.mcqScore = mcqScore;

  const hasShort = attempt.answers.some(a => a.type === 'short');

  if (!hasShort) {
    // Pure MCQ — auto-grade and auto-push to CIE immediately
    attempt.totalRaw    = mcqScore;
    attempt.scaledScore = test.totalMarks > 0
      ? Math.round((mcqScore / test.totalMarks) * 5 * 2) / 2
      : 0;
    attempt.graded      = true;

    // Auto-push to CIE
    try {
      const year = (() => {
        try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'../config.json'),'utf8')).academicYear || '2026-27'; }
        catch { return '2026-27'; }
      })();
      let tm = await TheoryMarks.findOne({ student: attempt.student, subject: test.subject, academicYear: year });
      if (!tm) {
        tm = new TheoryMarks({
          student: attempt.student, subject: test.subject,
          teacher: test.teacher, academicYear: year
        });
      }
      if (tm.status === 'approved') tm.status = 'submitted';
      const field = test.slot.toLowerCase(); // st1, st2, st3
      if (!tm[field]) tm[field] = {};
      tm[field].total    = attempt.scaledScore;
      tm[field].isAbsent = false;
      tm[field].questions = [];
      tm.compute();
      await tm.save();
      attempt.pushedToCIE = true;
    } catch(e) {
      console.error('Auto-push to CIE failed:', e.message);
    }
  }
}

module.exports = router;
