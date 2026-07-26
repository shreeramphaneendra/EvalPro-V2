const router = require('express').Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');

// ── LIST (newest first, capped) ──────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const query = { recipient: req.user._id };
    if (req.query.unread === 'true') query.read = false;

    const [items, unread] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ recipient: req.user._id, read: false }),
    ]);
    res.json({ items, unread });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── UNREAD COUNT (cheap poll) ────────────────────────────────────────────
router.get('/unread-count', protect, async (req, res) => {
  try {
    const unread = await Notification.countDocuments({ recipient: req.user._id, read: false });
    res.json({ unread });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MARK ONE READ ────────────────────────────────────────────────────────
router.post('/:id/read', protect, async (req, res) => {
  try {
    const n = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!n) return res.status(404).json({ message: 'Not found' });
    n.read = true; n.readAt = new Date();
    await n.save();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── MARK ALL READ ────────────────────────────────────────────────────────
router.post('/read-all', protect, async (req, res) => {
  try {
    const r = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ ok: true, updated: r.modifiedCount });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── CLEAR ALL ────────────────────────────────────────────────────────────
router.delete('/clear', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
