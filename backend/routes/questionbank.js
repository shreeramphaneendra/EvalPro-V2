const router = require('express').Router();
const { protect, teacherOnly } = require('../middleware/auth');
const QuestionBank = require('../models/QuestionBank');
const Subject      = require('../models/Subject');
const { logAudit } = require('../utils/audit');

const auth = [protect, teacherOnly];

// ── GET BANK FOR A SUBJECT ───────────────────────────────────────────────
router.get('/:subjectId', auth, async (req, res) => {
  try {
    const bank = await QuestionBank.findOne({ subject: req.params.subjectId })
      .populate('questions.createdBy','name')
      .lean();
    res.json(bank || { subject: req.params.subjectId, questions: [] });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ADD QUESTIONS TO BANK ────────────────────────────────────────────────
router.post('/:subjectId/add', auth, async (req, res) => {
  try {
    const { questions } = req.body;
    if (!questions?.length) return res.status(400).json({ message: 'No questions provided' });

    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    let bank = await QuestionBank.findOne({ subject: req.params.subjectId });
    if (!bank) bank = new QuestionBank({
      subject: req.params.subjectId,
      subjectCode: subject.code,
      department: subject.department,
      questions: []
    });

    // Skip exact duplicates (same text + type)
    const existing = new Set(bank.questions.map(q => `${q.type}::${q.text.trim().toLowerCase()}`));
    let added = 0, skipped = 0;
    for (const q of questions) {
      const key = `${q.type}::${String(q.text||'').trim().toLowerCase()}`;
      if (!q.text?.trim()) { skipped++; continue; }
      if (existing.has(key)) { skipped++; continue; }
      existing.add(key);
      bank.questions.push({
        type: q.type, text: q.text, marks: q.marks || 1,
        options: q.options || [], correct: q.correct ?? null,
        hint: q.hint || '', topic: q.topic || '',
        difficulty: q.difficulty || 'medium',
        createdBy: req.user._id,
      });
      added++;
    }
    await bank.save();

    await logAudit(req, {
      action: 'questionbank.add', category: 'sliptest',
      targetType: 'Subject', targetId: subject._id,
      targetLabel: `${subject.name} (${subject.code})`,
      description: `Added ${added} question(s) to the question bank${skipped ? `, ${skipped} duplicate/empty skipped` : ''}`,
    });

    res.json({ message: `${added} question(s) saved to bank${skipped ? ` · ${skipped} skipped (duplicate)` : ''}`, added, skipped, total: bank.questions.length });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── DELETE A QUESTION ────────────────────────────────────────────────────
router.delete('/:subjectId/:questionId', auth, async (req, res) => {
  try {
    const bank = await QuestionBank.findOne({ subject: req.params.subjectId });
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    const before = bank.questions.length;
    bank.questions = bank.questions.filter(q => q._id.toString() !== req.params.questionId);
    if (bank.questions.length === before) return res.status(404).json({ message: 'Question not found' });
    await bank.save();
    res.json({ message: 'Question removed', total: bank.questions.length });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MARK QUESTIONS AS USED (bump usage counter on import) ────────────────
router.post('/:subjectId/used', auth, async (req, res) => {
  try {
    const { questionIds = [] } = req.body;
    const bank = await QuestionBank.findOne({ subject: req.params.subjectId });
    if (!bank) return res.json({ ok: true });
    bank.questions.forEach(q => {
      if (questionIds.includes(q._id.toString())) q.timesUsed = (q.timesUsed || 0) + 1;
    });
    await bank.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
