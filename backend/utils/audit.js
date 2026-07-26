const AuditLog     = require('../models/AuditLog');
const Notification = require('../models/Notification');

// ── AUDIT ────────────────────────────────────────────────────────────────
// Never throws — a logging failure must never break the actual operation.
async function logAudit(req, {
  action, category = 'system', severity = 'info',
  targetType = '', targetId = null, targetLabel = '',
  description, before = null, after = null, academicYear = ''
}) {
  try {
    const isStudent = req?.role === 'student';
    await AuditLog.create({
      actor:       req?.user?._id || null,
      actorModel:  isStudent ? 'Student' : 'Teacher',
      actorName:   req?.user?.name || 'System',
      actorRole:   isStudent ? 'student' : (req?.user?.isAdmin ? 'admin' : 'teacher'),
      action, category, severity,
      targetType, targetId, targetLabel,
      description, before, after,
      department:   req?.user?.department || req?.user?.branch || '',
      academicYear,
      ip: (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').toString().split(',')[0].trim(),
    });
  } catch (e) { console.error('[audit] failed:', e.message); }
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────
// recipients: [{ id, model }] — bulk insert, deduplicated.
async function notify(recipients, { type, title, body = '', link = '', icon = '🔔' }) {
  try {
    if (!recipients?.length) return 0;
    const seen = new Set();
    const docs = [];
    for (const r of recipients) {
      const id = r.id?.toString();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      docs.push({
        recipient: r.id, recipientModel: r.model || 'Student',
        type, title, body, link, icon
      });
    }
    if (!docs.length) return 0;
    await Notification.insertMany(docs, { ordered: false });
    return docs.length;
  } catch (e) { console.error('[notify] failed:', e.message); return 0; }
}

const toStudents = ids => ids.map(id => ({ id, model: 'Student' }));
const toTeachers = ids => ids.map(id => ({ id, model: 'Teacher' }));

module.exports = { logAudit, notify, toStudents, toTeachers };
