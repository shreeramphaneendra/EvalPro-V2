const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

// Token roles are now just 'teacher' or 'student'.
// Admin is a permission (isAdmin) on a teacher account, not a separate role.
const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token' });
  try {
    const { id, role } = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    if (role === 'student') req.user = await Student.findById(id).select('-password');
    else                    req.user = await Teacher.findById(id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    req.role = role;
    next();
  } catch { res.status(401).json({ message: 'Invalid token' }); }
};

// adminOnly: must be a teacher account WITH the admin permission.
const adminOnly = (req, res, next) =>
  (req.role === 'teacher' && req.user?.isAdmin)
    ? next()
    : res.status(403).json({ message: 'Admin permission required' });

const teacherOnly = (req, res, next) =>
  req.role === 'teacher' ? next() : res.status(403).json({ message: 'Teacher only' });

const studentOnly = (req, res, next) =>
  req.role === 'student' ? next() : res.status(403).json({ message: 'Student only' });

// activeStudentOnly: student must not be under detention/suspension.
// Detained students keep READ access (marks, mentor) but lose the right to
// DO anything — submit assignments, attempt slip tests, register electives.
// Rights are restored the moment admin lifts the detention (status → Active).
const activeStudentOnly = (req, res, next) => {
  if (req.role !== 'student') return res.status(403).json({ message: 'Student only' });
  if (req.user?.status === 'Detained')
    return res.status(403).json({
      message: 'You are currently under detention. Assignments, slip tests and elective registration are locked until the department lifts it.',
      detained: true
    });
  if (req.user?.status === 'Graduated')
    return res.status(403).json({ message: 'Graduated students cannot perform this action.' });
  return next();
};

module.exports = { protect, adminOnly, teacherOnly, studentOnly, activeStudentOnly };
