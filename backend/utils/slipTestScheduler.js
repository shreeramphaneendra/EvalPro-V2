const SlipTest = require('../models/SlipTest');

// ── BACKGROUND SLIP TEST SCHEDULER ───────────────────────────────────────
// Without this, closing a test was "lazy" — it only happened when a teacher or
// student happened to open the app. If everyone closed their browser at 11:50
// and nobody logged in for a week, MCQ marks sat unpushed for that whole week.
//
// This makes it genuinely automatic: every tick we look for tests whose window
// has ended but are still marked active, and run the same close pipeline
// (auto-submit stragglers → grade MCQs → push scores to CIE → notify students).
//
// Safe to run alongside the lazy path: autoCloseIfEnded uses an atomic claim,
// so if a student's request and this scheduler fire at the same instant, only
// one wins and the work happens exactly once.

const TICK_MS = 30_000;   // check every 30s — window ends are minute-precision
let timer = null;
let running = false;      // prevents overlapping ticks on a slow DB

async function sweep() {
  if (running) return;    // previous tick still working
  running = true;
  try {
    const { autoCloseIfEnded } = require('../routes/sliptests');
    if (typeof autoCloseIfEnded !== 'function') return;

    const due = await SlipTest.find({
      status: 'active',
      windowEnd: { $lte: new Date() },
    }).limit(50);          // bounded so one tick can never run away

    if (!due.length) return;

    for (const test of due) {
      try {
        await autoCloseIfEnded(test);
        console.log(`[scheduler] closed slip test "${test.title}" (${test.slot}) — window ended ${new Date(test.windowEnd).toISOString()}`);
      } catch (e) {
        console.error(`[scheduler] failed closing test ${test._id}:`, e.message);
      }
    }
  } catch (e) {
    console.error('[scheduler] sweep error:', e.message);
  } finally {
    running = false;
  }
}

function startSlipTestScheduler() {
  if (timer) return;
  // First sweep shortly after boot — catches anything that expired while the
  // server was restarting or down.
  setTimeout(sweep, 5_000);
  timer = setInterval(sweep, TICK_MS);
  timer.unref?.();  // don't hold the process open during shutdown
  console.log(`⏱  Slip test scheduler running (every ${TICK_MS/1000}s)`);
}

function stopSlipTestScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { startSlipTestScheduler, stopSlipTestScheduler, sweep };
