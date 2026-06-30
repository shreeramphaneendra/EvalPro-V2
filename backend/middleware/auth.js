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

module.exports = { protect, adminOnly, teacherOnly, studentOnly };
