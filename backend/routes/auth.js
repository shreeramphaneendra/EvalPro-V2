const router  = require('express').Router();
const rateLimit = require('express-rate-limit');

// 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});


const jwt     = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');
const { PROGRAMS, PROGRAM_KEYS } = require('../utils/programs');

const sign = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const clean = (doc) => ({ ...doc.toObject(), password: undefined });

// Public: expose program definitions to the frontend
router.get('/programs', (req, res) => res.json(PROGRAMS));

// ── BOOTSTRAP: create the first admin (a teacher with isAdmin) ──────────────
// Safe to expose: only works when NO admin exists yet. After that it 403s.
router.post('/bootstrap-admin', loginLimiter, async (req, res) => {
  try {
    const adminExists = await Teacher.findOne({ isAdmin: true });
    if (adminExists) return res.status(403).json({ message: 'An admin already exists. Use the Admin Settings page to add more admins.' });

    // If BOOTSTRAP_SECRET is set in .env, require it in the request
    const envSecret = process.env.BOOTSTRAP_SECRET;
    if (envSecret && req.body.bootstrapSecret !== envSecret)
      return res.status(403).json({ message: 'Invalid setup secret. Check your .env file.' });

    const { name, employeeId, email, password, department, college, programs, designation } = req.body;
    if (!name || !employeeId || !email || !password || !department)
      return res.status(400).json({ message: 'name, employeeId, email, password, department are required' });

    const teacher = await Teacher.create({
      name, employeeId, email, password, department,
      designation: designation || 'Professor',
      college: college || 'CBIT',
      isAdmin: true,
      programs: programs?.length ? programs : ['B.Tech'],
      isFirstLogin: false   // bootstrap admin sets their own password in the curl
    });
    res.status(201).json({ token: sign(teacher._id, 'teacher'), user: clean(teacher) });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── UNIFIED STAFF LOGIN (teacher; may or may not have admin rights) ─────────
router.post('/teacher/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const teacher = await Teacher.findOne({ email });
    if (!teacher || !(await teacher.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: sign(teacher._id,'teacher'), user: clean(teacher) });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// Back-compat alias: /admin/login behaves like staff login but requires isAdmin
router.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const teacher = await Teacher.findOne({ email });
    if (!teacher || !(await teacher.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    if (!teacher.isAdmin)
      return res.status(403).json({ message: 'This account does not have admin access' });
    res.json({ token: sign(teacher._id,'teacher'), user: clean(teacher) });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── STUDENT LOGIN ───────────────────────────────────────────────────────────
router.post('/student/login', loginLimiter, async (req, res) => {
  try {
    const { usn, password } = req.body;
    if (!usn) return res.status(400).json({ message: 'Roll number is required' });
    const student = await Student.findOne({ usn: usn.toUpperCase() });
    if (!student || !(await student.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid roll number or password' });
    res.json({ token: sign(student._id,'student'), user: clean(student) });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── FIRST-LOGIN PASSWORD CHANGE (no current pw needed) ──────────────────────
router.post('/change-password', protect, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    req.user.password = newPassword;
    req.user.isFirstLogin = false;
    await req.user.save();
    res.json({ message: 'Password changed successfully' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── UNIVERSAL: CHANGE OWN PASSWORD (verifies current) ───────────────────────
router.put('/change-my-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const Model = req.role === 'student' ? Student : Teacher;
    const account = await Model.findById(req.user._id);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    if (!(await account.matchPassword(currentPassword)))
      return res.status(401).json({ message: 'Current password is incorrect' });
    account.password = newPassword;
    if ('isFirstLogin' in account) account.isFirstLogin = false;
    await account.save();
    res.json({ message: 'Password changed successfully' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── GET ME ─────────────────────────────────────────────────────────────────
router.get('/me', protect, (req, res) => res.json({ user: req.user, role: req.role, isAdmin: !!req.user.isAdmin }));

// ── ADMIN: UPDATE OWN PROFILE ──────────────────────────────────────────────
router.put('/admin/profile', protect, async (req, res) => {
  try {
    if (!(req.role === 'teacher' && req.user.isAdmin)) return res.status(403).json({ message: 'Admin only' });
    const { name, email, department, college, programs } = req.body;
    if (email && email !== req.user.email) {
      const taken = await Teacher.findOne({ email, _id: { $ne: req.user._id } });
      if (taken) return res.status(400).json({ message: 'Email already in use' });
    }
    if (name)       req.user.name       = name;
    if (email)      req.user.email      = email;
    if (department) req.user.department = department;
    if (college)    req.user.college    = college;
    if (programs && programs.length) req.user.programs = programs;
    await req.user.save();
    res.json({ user: clean(req.user) });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN: GET ALL ADMINS (teachers with isAdmin, same department) ──────────
router.get('/admin/all', protect, async (req, res) => {
  try {
    if (!(req.role === 'teacher' && req.user.isAdmin)) return res.status(403).json({ message: 'Admin only' });
    const admins = await Teacher.find({ isAdmin: true, department: req.user.department }).select('-password').sort({ createdAt: 1 });
    res.json(admins);
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN: GRANT admin rights to an existing teacher, or create new admin ───
router.post('/admin/create', protect, async (req, res) => {
  try {
    if (!(req.role === 'teacher' && req.user.isAdmin)) return res.status(403).json({ message: 'Admin only' });
    const { name, employeeId, email, password, department, college, programs, grantToExisting } = req.body;

    // Option A: promote an existing teacher to admin
    if (grantToExisting) {
      const t = await Teacher.findOne({ email });
      if (!t) return res.status(404).json({ message: 'No teacher with that email' });
      t.isAdmin = true;
      if (programs?.length) t.programs = programs;
      await t.save();
      return res.json({ user: clean(t), promoted: true });
    }

    // Option B: create a brand new teacher-admin
    if (!name || !employeeId || !email || !password)
      return res.status(400).json({ message: 'name, employeeId, email, password required' });
    const exists = await Teacher.findOne({ $or: [{ email }, { employeeId: employeeId.toUpperCase() }] });
    if (exists) return res.status(400).json({ message: 'A teacher with this email or employee ID already exists' });
    const teacher = await Teacher.create({
      name, employeeId, email, password,
      department: department || req.user.department,
      college: college || 'CBIT',
      isAdmin: true,
      programs: programs?.length ? programs : ['B.Tech']
    });
    res.status(201).json({ user: clean(teacher) });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── ADMIN: REVOKE admin rights (does not delete the teacher) ────────────────
router.delete('/admin/:id', protect, async (req, res) => {
  try {
    if (!(req.role === 'teacher' && req.user.isAdmin)) return res.status(403).json({ message: 'Admin only' });
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: 'You cannot revoke your own admin access' });
    const count = await Teacher.countDocuments({ isAdmin: true, department: req.user.department });
    if (count <= 1) return res.status(400).json({ message: 'Cannot remove the only admin in the department' });
    const t = await Teacher.findById(req.params.id);
    if (!t) return res.status(404).json({ message: 'Not found' });
    t.isAdmin = false;
    await t.save();
    res.json({ message: 'Admin access revoked (teacher account kept)' });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

// ── SETUP STATUS — tells frontend if first setup is needed ──────────────────
router.get('/setup-status', async (req, res) => {
  try {
    const adminExists = await Teacher.findOne({ isAdmin: true });
    res.json({ needsSetup: !adminExists });
  } catch(e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
