require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');

const app = express();

// Render/Vercel/Nginx put a load balancer in front of this app, so the client
// IP arrives in X-Forwarded-For. Without this, express-rate-limit sees the
// PROXY's IP for every request — meaning all 800 students would share a single
// 10-attempts-per-15-minutes bucket and lock each other out of login.
// '1' trusts exactly one hop (the platform's LB); `true` would let a client
// spoof its own IP via a forged header.
app.set('trust proxy', 1);

app.use(cors());

// Hard timeout on every request — if anything hangs (slow Cloudinary call,
// a runaway query), the client gets a clear 503 instead of spinning forever.
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) res.status(503).json({ message: 'Request timed out — please try again' });
  });
  next();
});
app.use(express.json({ limit: '10mb' }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/teacher',     require('./routes/teacher'));
app.use('/api/sliptests',    require('./routes/sliptests'));
app.use('/api/electives',    require('./routes/electives'));
app.use('/api/student',     require('./routes/student'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/questionbank',  require('./routes/questionbank'));
app.use('/api',             require('./routes/assignments'));

app.get('/', (req, res) => res.json({ message: 'EvalPro v2 API ✓' }));

mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 50,              // enough concurrent DB ops for 800-1000 users' typical usage
  minPoolSize: 5,
  serverSelectionTimeoutMS: 8000, // fail fast instead of hanging if Mongo is unreachable
  socketTimeoutMS: 30000,         // kill a stuck query instead of hanging forever
})
  .then(async () => {
    console.log('✓ MongoDB connected');

    // Drop stale indexes from older schema versions
    try { await mongoose.connection.collection('students').dropIndex('email_1'); } catch(e) {}
    try { await mongoose.connection.collection('students').dropIndex('phone_1'); } catch(e) {}
    // Drop old theorymarks index that causes duplicate key on CT2 save
    try { await mongoose.connection.collection('theorymarks').dropIndex('student_1_subject_1'); } catch(e) {}
    try { await mongoose.connection.collection('labmarks').dropIndex('student_1_subject_1'); } catch(e) {}

    const PORT = process.env.PORT || 5000;

    // Bind the port FIRST. If this fails there is no point starting the
    // scheduler — a process with no HTTP server but a live scheduler is a
    // zombie that silently mutates the database.
    const server = app.listen(PORT, () => {
      console.log(`\u2713 Server running on http://localhost:${PORT}`);
      // Only now is it safe to start background work.
      require('./utils/slipTestScheduler').startSlipTestScheduler();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\u2717 Port ${PORT} is already in use.`);
        console.error('\u2192 Another server is still running. Stop it with:');
        console.error(`\u2192   lsof -ti:${PORT} | xargs kill -9`);
      } else {
        console.error('\u2717 Server failed to start:', err.message);
      }
      process.exit(1);   // never linger in a half-started state
    });

    // Clean shutdown so Ctrl+C actually frees the port
    const shutdown = async (sig) => {
      console.log(`\n${sig} received — shutting down`);
      try { require('./utils/slipTestScheduler').stopSlipTestScheduler(); } catch {}
      server.close(() => {
        mongoose.connection.close(false).finally(() => process.exit(0));
      });
      setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch(err => {
    console.error('\u2717 MongoDB error:', err.message);
    console.error('\u2192 Check MONGO_URI in backend/.env');
    process.exit(1);
  });

// A rejected background promise (a failed notification, a slow Cloudinary
// call) should be logged but must not kill the server for everyone.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// An uncaught exception means state may now be inconsistent. Log it and exit
// so the platform restarts cleanly — swallowing it previously left the process
// alive but not serving requests, which is far harder to diagnose.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});
