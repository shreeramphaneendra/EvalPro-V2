require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');

const app = express();
app.use(cors());
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
app.use('/api',             require('./routes/assignments'));

app.get('/', (req, res) => res.json({ message: 'EvalPro v2 API ✓' }));

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✓ MongoDB connected');

    // Drop stale indexes from older schema versions
    try { await mongoose.connection.collection('students').dropIndex('email_1'); } catch(e) {}
    try { await mongoose.connection.collection('students').dropIndex('phone_1'); } catch(e) {}
    // Drop old theorymarks index that causes duplicate key on CT2 save
    try { await mongoose.connection.collection('theorymarks').dropIndex('student_1_subject_1'); } catch(e) {}
    try { await mongoose.connection.collection('labmarks').dropIndex('student_1_subject_1'); } catch(e) {}

    app.listen(process.env.PORT || 5000, () =>
      console.log(`✓ Server running on http://localhost:${process.env.PORT || 5000}`)
    );
  })
  .catch(err => {
    console.error('✗ MongoDB error:', err.message);
    console.error('→ Run: brew services start mongodb-community');
  });
