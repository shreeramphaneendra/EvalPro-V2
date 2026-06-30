import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { CheckCircle, AlertTriangle, Clock, Shield } from 'lucide-react';

export default function SlipTestExam({ testId, onFinish }) {
  // ── State ─────────────────────────────────────────────────────────────
  const [phase,      setPhase]    = useState('loading');
  const [briefData,  setBriefData]= useState(null);   // from /student/test/:id
  const [examData,   setExamData] = useState(null);   // from /:id/start
  const [answers,    setAnswers]  = useState({});     // { [qNo]: {selectedOption, textAnswer} }
  const [timeLeft,   setTimeLeft] = useState(0);
  const [violations, setViolations]= useState(0);
  const [warning,    setWarning]  = useState(null);
  const [result,     setResult]   = useState(null);

  // ── Refs — avoid stale closures completely ────────────────────────────
  const attemptId    = useRef(null);
  const timerRef     = useRef(null);
  const submitting   = useRef(false);
  const answersRef   = useRef({});   // mirror of answers state — always fresh
  const phaseRef     = useRef('loading');
  const violationsRef= useRef(0);

  const setPhaseSync = (p) => { phaseRef.current = p; setPhase(p); };

  // ── Step 1: Load briefing data ────────────────────────────────────────
  useEffect(() => {
    api.get(`/api/sliptests/student/test/${testId}`)
      .then(r => { setBriefData(r.data); setPhaseSync('briefing'); })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Could not load test');
        setPhaseSync('error');
      });
  }, [testId]);

  // ── Step 2: Start exam (called after fullscreen) ──────────────────────
  const startExam = async () => {
    try {
      const { data } = await api.post(`/api/sliptests/${testId}/start`);
      attemptId.current = data.attemptId;

      // Init answers from server (resume support)
      const init = {};
      (data.answers || []).forEach(a => {
        init[a.qNo] = {
          selectedOption: a.selectedOption ?? null,
          textAnswer:     a.textAnswer     || ''
        };
      });
      answersRef.current = init;
      setAnswers(init);
      setExamData(data);
      setTimeLeft(data.remainingSec);
      setPhaseSync('exam');
    } catch(err) {
      toast.error(err.response?.data?.message || 'Failed to start test');
      setPhaseSync('error');
    }
  };

  const enterFullscreenAndStart = async () => {
    try { await document.documentElement.requestFullscreen(); } catch {}
    await startExam();
  };

  // ── Step 3: Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          doSubmit('time_up');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Core submit — uses refs, always fresh ─────────────────────────────
  const doSubmit = async (reason = '') => {
    if (submitting.current) return;
    submitting.current = true;
    clearInterval(timerRef.current);

    // Exit fullscreen
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}

    // Build final answers from REF (always current)
    const finalAnswers = Object.entries(answersRef.current).map(([qNo, a]) => ({
      qNo:            Number(qNo),
      selectedOption: a.selectedOption ?? null,
      textAnswer:     a.textAnswer     || ''
    }));

    try {
      await api.post(`/api/sliptests/attempt/${attemptId.current}/submit`, {
        answers:    finalAnswers,
        autoSubmit: !!reason,
        reason
      });
      setPhaseSync('submitted');
      // Fetch result
      try {
        const { data } = await api.get(`/api/sliptests/attempt/${attemptId.current}/result`);
        setResult(data);
      } catch {}
    } catch(err) {
      toast.error('Submission failed — ' + (err.response?.data?.message || 'check connection'));
      submitting.current = false;
    }
  };

  // ── Proctor engine — all callbacks use refs, no stale closures ────────
  useEffect(() => {
    if (phase !== 'exam') return;

    // TAB SWITCH → immediate auto-submit
    const onVisibility = async () => {
      if (!document.hidden || submitting.current) return;
      clearInterval(timerRef.current);
      showWarning('⚠ Tab switch detected! Test is being submitted…', 'red');

      // Log violation then submit
      try {
        await api.post(`/api/sliptests/attempt/${attemptId.current}/violation`, {
          type: 'tab_switch', detail: 'Student switched tabs'
        });
      } catch {}
      setTimeout(() => doSubmit('tab_switch'), 1500);
    };

    // WINDOW BLUR → warning + 3 strikes
    const onBlur = async () => {
      if (submitting.current) return;
      violationsRef.current += 1;
      const v = violationsRef.current;
      setViolations(v);

      try {
        await api.post(`/api/sliptests/attempt/${attemptId.current}/violation`, {
          type: 'window_blur', detail: `Window blur violation ${v}`
        });
      } catch {}

      if (v >= 3) {
        showWarning('3 violations — auto-submitting your test!', 'red');
        setTimeout(() => doSubmit('violations'), 1500);
      } else {
        showWarning(`⚠ Warning ${v}/3 — Stay in the exam window!`, 'amber');
      }
    };

    // FULLSCREEN EXIT → warn + re-request
    const onFullscreen = () => {
      if (submitting.current) return;
      if (!document.fullscreenElement) {
        violationsRef.current += 1;
        const v = violationsRef.current;
        setViolations(v);
        showWarning(`⚠ Warning ${v}/3 — Stay in fullscreen!`, 'amber');
        // Re-request fullscreen
        setTimeout(() => {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }, 500);
        try {
          api.post(`/api/sliptests/attempt/${attemptId.current}/violation`, {
            type: 'fullscreen_exit', detail: `Exited fullscreen`
          });
        } catch {}
        if (v >= 3) {
          setTimeout(() => doSubmit('violations'), 1500);
        }
      }
    };

    // BLOCK copy/paste/right-click
    const block = (e) => e.preventDefault();

    // BLOCK keyboard shortcuts
    const onKeyDown = (e) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+X, F12, etc
      if (e.ctrlKey && ['c','v','a','x','u','s','p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (['F12','F11','F10','F5'].includes(e.key)) e.preventDefault();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy',        block);
    document.addEventListener('paste',       block);
    document.addEventListener('cut',         block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('keydown',     onKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy',        block);
      document.removeEventListener('paste',       block);
      document.removeEventListener('cut',         block);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('keydown',     onKeyDown);
    };
  }, [phase]); // only depends on phase — all callbacks use refs

  // ── Answer handling — update both state and ref ───────────────────────
  const setAnswer = (qNo, field, val) => {
    const updated = {
      ...answersRef.current,
      [qNo]: { ...(answersRef.current[qNo] || {}), [field]: val }
    };
    answersRef.current = updated;  // ref always fresh
    setAnswers({ ...updated });    // state for re-render

    // Auto-save to server
    api.post(`/api/sliptests/attempt/${attemptId.current}/save-answer`, {
      qNo, [field]: val
    }).catch(() => {});
  };

  // ── Warning display ───────────────────────────────────────────────────
  const showWarning = (msg, color = 'red') => {
    setWarning({ msg, color });
    setTimeout(() => setWarning(null), 3500);
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const fmt = (s) =>
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const timePct   = examData ? (timeLeft / (examData.duration * 60)) * 100 : 100;
  const timeColor = timePct > 50 ? '#10B981' : timePct > 20 ? '#F59E0B' : '#EF4444';
  const questions = examData?.questions || briefData?.questions || [];
  const answered  = Object.values(answersRef.current).filter(a =>
    (a.selectedOption !== null && a.selectedOption !== undefined) || a.textAnswer?.trim()
  ).length;

  // ══════════════════════════════════════════════════════════════════════
  // PHASE: LOADING
  // ══════════════════════════════════════════════════════════════════════
  if (phase === 'loading') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0F172A'}}>
      <div style={{textAlign:'center'}}>
        <div style={{
          width:48,height:48,border:'4px solid rgba(255,107,53,.2)',
          borderTopColor:'#FF6B35',borderRadius:'50%',
          animation:'spin 1s linear infinite',margin:'0 auto 16px'
        }}/>
        <p style={{color:'rgba(255,255,255,.5)',fontSize:14}}>Loading test…</p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // PHASE: ERROR
  // ══════════════════════════════════════════════════════════════════════
  if (phase === 'error') return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0F172A'}}>
      <div style={{textAlign:'center',color:'#fff'}}>
        <AlertTriangle size={48} color="#EF4444" style={{margin:'0 auto 16px'}}/>
        <h2 style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,marginBottom:8}}>Test Unavailable</h2>
        <p style={{color:'rgba(255,255,255,.4)',marginBottom:20}}>The test window may have closed or the test was not found.</p>
        <button onClick={onFinish} style={{padding:'10px 24px',background:'#FF6B35',border:'none',
          borderRadius:8,color:'#fff',fontWeight:700,cursor:'pointer'}}>Back to Portal</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // PHASE: BRIEFING
  // ══════════════════════════════════════════════════════════════════════
  if (phase === 'briefing') {
    const d = briefData;
    return (
      <div style={{
        minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
        background:'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)',padding:24
      }}>
        <div style={{
          maxWidth:540,width:'100%',
          background:'rgba(255,255,255,.04)',
          border:'1px solid rgba(255,255,255,.08)',
          borderRadius:20,padding:36,
          backdropFilter:'blur(10px)'
        }}>
          {/* Icon + title */}
          <div style={{textAlign:'center',marginBottom:28}}>
            <div style={{
              width:72,height:72,borderRadius:'50%',
              background:'rgba(255,107,53,.15)',
              border:'2px solid rgba(255,107,53,.3)',
              display:'flex',alignItems:'center',justifyContent:'center',
              margin:'0 auto 16px'
            }}>
              <Shield size={32} color="#FF6B35"/>
            </div>
            <h1 style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:24,color:'#fff',marginBottom:6}}>
              {d?.title}
            </h1>
            <p style={{fontSize:13,color:'rgba(255,255,255,.35)'}}>
              {d?.subject?.name} · {d?.subject?.code} · {d?.slot}
            </p>
          </div>

          {/* Stats grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
            {[
              { icon:'📝', label:'Questions',   val: d?.questions?.length },
              { icon:'⏱',  label:'Duration',    val: `${d?.duration} min` },
              { icon:'🎯', label:'Total Marks', val: d?.totalMarks },
              { icon:'⭐', label:'CIE Score',   val: '/5 marks' },
            ].map(s => (
              <div key={s.label} style={{
                padding:'14px 12px',background:'rgba(255,255,255,.06)',
                border:'1px solid rgba(255,255,255,.08)',
                borderRadius:12,textAlign:'center'
              }}>
                <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:22,color:'#fff'}}>{s.val}</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,.3)',marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Instructions */}
          {d?.instructions && (
            <div style={{
              padding:'12px 14px',marginBottom:14,
              background:'rgba(255,107,53,.08)',border:'1px solid rgba(255,107,53,.2)',
              borderRadius:10,fontSize:13,color:'rgba(255,255,255,.65)',lineHeight:1.7
            }}>
              <strong style={{color:'#FF6B35',display:'block',marginBottom:4}}>Instructions:</strong>
              {d.instructions}
            </div>
          )}

          {/* Proctor rules */}
          <div style={{
            padding:'14px',marginBottom:24,
            background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.2)',
            borderRadius:10,fontSize:12.5,color:'rgba(255,255,255,.55)',lineHeight:1.9
          }}>
            <strong style={{color:'#EF4444',display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
              ⚠ Proctoring Active — Read Carefully
            </strong>
            🔴 Switching tabs → <strong style={{color:'#EF4444'}}>immediate auto-submit</strong><br/>
            🟡 Window blur/fullscreen exit → warning (3 = auto-submit)<br/>
            🚫 Copy, paste, right-click, keyboard shortcuts → blocked<br/>
            ⏱ Timer runs out → auto-submit with current answers<br/>
            📸 All violations are recorded and visible to your teacher
          </div>

          {/* Start button */}
          <button
            onClick={enterFullscreenAndStart}
            style={{
              width:'100%',padding:'15px',
              background:'linear-gradient(135deg,#FF6B35,#E55A2B)',
              border:'none',borderRadius:12,
              color:'#fff',fontWeight:800,fontSize:16,
              cursor:'pointer',letterSpacing:'.3px',
              boxShadow:'0 4px 20px rgba(255,107,53,.4)',
              transition:'transform .1s'
            }}
            onMouseDown={e=>e.currentTarget.style.transform='scale(.98)'}
            onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
          >
            🛡 Start Proctored Exam — Enter Fullscreen
          </button>

          <p style={{textAlign:'center',marginTop:12,fontSize:11,color:'rgba(255,255,255,.2)'}}>
            Make sure you are ready. Once started, you cannot pause.
          </p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE: EXAM
  // ══════════════════════════════════════════════════════════════════════
  if (phase === 'exam') return (
    <div style={{minHeight:'100vh',background:'#F8FAFC',display:'flex',flexDirection:'column',userSelect:'none'}}>

      {/* Violation warning banner */}
      {warning && (
        <div style={{
          position:'fixed',top:0,left:0,right:0,zIndex:99999,
          padding:'16px 24px',
          background: warning.color==='red'
            ? 'linear-gradient(135deg,#DC2626,#991B1B)'
            : 'linear-gradient(135deg,#D97706,#92400E)',
          color:'#fff',fontWeight:700,fontSize:15,textAlign:'center',
          boxShadow:'0 4px 30px rgba(0,0,0,.5)',
          animation:'slideDown .25s ease'
        }}>
          {warning.msg}
        </div>
      )}

      {/* TOP BAR */}
      <div style={{
        position:'sticky',top:0,zIndex:1000,
        background:'#0F172A',
        padding:'12px 20px',
        display:'flex',alignItems:'center',gap:14,
        boxShadow:'0 2px 20px rgba(0,0,0,.3)'
      }}>
        {/* Title */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{
            fontFamily:"'Outfit',sans-serif",fontWeight:700,
            fontSize:15,color:'#fff',
            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'
          }}>
            {examData?.title}
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.35)',marginTop:1}}>
            {answered}/{questions.length} answered
            {violations > 0 && (
              <span style={{
                marginLeft:10,color:'#F59E0B',fontWeight:700
              }}>
                ⚠ {violations} violation{violations!==1?'s':''}
              </span>
            )}
          </div>
        </div>

        {/* Timer */}
        <div style={{
          display:'flex',flexDirection:'column',alignItems:'center',
          padding:'8px 16px',
          background:timeLeft<60?'rgba(239,68,68,.2)':timeLeft<300?'rgba(245,158,11,.15)':'rgba(255,255,255,.05)',
          border:`1.5px solid ${timeColor}44`,
          borderRadius:12
        }}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Clock size={14} color={timeColor}/>
            <span style={{
              fontFamily:"'JetBrains Mono',monospace",
              fontSize:22,fontWeight:900,color:timeColor,
              letterSpacing:2
            }}>
              {fmt(timeLeft)}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{width:100,height:3,background:'rgba(255,255,255,.1)',borderRadius:2,marginTop:4,overflow:'hidden'}}>
            <div style={{
              height:'100%',
              width:`${Math.max(0,Math.min(100,timePct))}%`,
              background:timeColor,
              transition:'width 1s linear',borderRadius:2
            }}/>
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={() => {
            if (window.confirm(`Submit test now? You have answered ${answered}/${questions.length} questions.`)) {
              doSubmit();
            }
          }}
          style={{
            padding:'10px 20px',
            background:'linear-gradient(135deg,#FF6B35,#E55A2B)',
            border:'none',borderRadius:10,
            color:'#fff',fontWeight:700,fontSize:13,
            cursor:'pointer',flexShrink:0,
            boxShadow:'0 2px 10px rgba(255,107,53,.3)'
          }}
        >
          Submit Test
        </button>
      </div>

      {/* QUESTIONS */}
      <div style={{flex:1,maxWidth:820,width:'100%',margin:'0 auto',padding:'24px 16px 40px',display:'flex',flexDirection:'column',gap:18}}>

        {/* Question navigator dots */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap',padding:'12px 16px',
          background:'#fff',borderRadius:12,border:'1px solid #E2E8F0',
          boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
          <span style={{fontSize:11,color:'#94A3B8',fontWeight:600,marginRight:4,alignSelf:'center'}}>Questions:</span>
          {questions.map((q,i) => {
            const ans = answersRef.current[q.qNo] || {};
            const done = q.type==='mcq'
              ? ans.selectedOption !== null && ans.selectedOption !== undefined
              : ans.textAnswer?.trim();
            return (
              <button key={q.qNo}
                onClick={() => {
                  document.getElementById(`q-${q.qNo}`)?.scrollIntoView({behavior:'smooth',block:'center'});
                }}
                style={{
                  width:30,height:30,borderRadius:8,border:'none',
                  fontWeight:700,fontSize:12,cursor:'pointer',
                  background:done?'#10B981':q.type==='mcq'?'#EFF6FF':'#F0FDF4',
                  color:done?'#fff':q.type==='mcq'?'#3B82F6':'#16A34A',
                  outline:'none'
                }}
              >{q.qNo}</button>
            );
          })}
          <span style={{fontSize:11,color:'#94A3B8',alignSelf:'center',marginLeft:'auto'}}>
            {answered}/{questions.length} done
          </span>
        </div>

        {/* Question cards */}
        {questions.map((q) => {
          const ans = answers[q.qNo] || {};
          const done = q.type==='mcq'
            ? ans.selectedOption !== null && ans.selectedOption !== undefined
            : ans.textAnswer?.trim();

          return (
            <div id={`q-${q.qNo}`} key={q.qNo} style={{
              background:'#fff',
              border:`1px solid ${done?'#10B981':'#E2E8F0'}`,
              borderRadius:16,overflow:'hidden',
              boxShadow:done?'0 0 0 2px rgba(16,185,129,.15)':'0 1px 6px rgba(0,0,0,.06)',
              transition:'box-shadow .2s,border-color .2s'
            }}>
              {/* Question header */}
              <div style={{
                padding:'14px 20px',
                background:q.type==='mcq'?'#EFF6FF':'#F0FDF4',
                borderBottom:'1px solid #E2E8F0',
                display:'flex',alignItems:'center',gap:10
              }}>
                <span style={{
                  fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:12,
                  padding:'3px 12px',borderRadius:20,
                  background:q.type==='mcq'?'#3B82F6':'#10B981',color:'#fff'
                }}>Q{q.qNo}</span>
                <span style={{
                  fontSize:11,fontWeight:700,
                  color:q.type==='mcq'?'#1D4ED8':'#166534'
                }}>
                  {q.type==='mcq'?'Multiple Choice':'Short Answer'}
                </span>
                <span style={{
                  marginLeft:'auto',fontSize:12,
                  color:'#64748B',fontWeight:600
                }}>
                  {q.marks} mark{q.marks!==1?'s':''}
                </span>
                {done && <CheckCircle size={16} color="#10B981"/>}
              </div>

              <div style={{padding:'20px'}}>
                {/* Question text */}
                <p style={{
                  fontSize:15,color:'#1E293B',lineHeight:1.75,
                  marginBottom:18,fontWeight:500
                }}>
                  {q.text}
                </p>

                {/* MCQ options */}
                {q.type === 'mcq' && (
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {(q.options||[]).map((opt, oi) => {
                      const selected = ans.selectedOption === oi;
                      return (
                        <div
                          key={oi}
                          onClick={() => setAnswer(q.qNo, 'selectedOption', oi)}
                          style={{
                            display:'flex',alignItems:'center',gap:14,
                            padding:'13px 16px',borderRadius:12,cursor:'pointer',
                            border:`2px solid ${selected?'#3B82F6':'#E2E8F0'}`,
                            background:selected?'#EFF6FF':'#F8FAFC',
                            transition:'all .15s',userSelect:'none'
                          }}
                        >
                          {/* Radio dot */}
                          <div style={{
                            width:22,height:22,borderRadius:'50%',flexShrink:0,
                            border:`2px solid ${selected?'#3B82F6':'#CBD5E1'}`,
                            background:selected?'#3B82F6':'#fff',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            transition:'all .15s'
                          }}>
                            {selected && <div style={{width:8,height:8,borderRadius:'50%',background:'#fff'}}/>}
                          </div>
                          <span style={{
                            fontSize:14,
                            color:selected?'#1D4ED8':'#374151',
                            fontWeight:selected?600:400
                          }}>
                            <strong style={{color:selected?'#1D4ED8':'#94A3B8',marginRight:8}}>
                              {String.fromCharCode(65+oi)}.
                            </strong>
                            {opt}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short answer */}
                {q.type === 'short' && (
                  <textarea
                    rows={5}
                    style={{
                      width:'100%',padding:'14px',
                      border:`2px solid ${ans.textAnswer?.trim()?'#10B981':'#E2E8F0'}`,
                      borderRadius:12,fontSize:14,lineHeight:1.7,
                      fontFamily:"'Inter',sans-serif",
                      background:'#F8FAFC',color:'#1E293B',
                      resize:'vertical',outline:'none',
                      transition:'border-color .15s',boxSizing:'border-box'
                    }}
                    placeholder="Write your answer here..."
                    value={ans.textAnswer||''}
                    onChange={e => setAnswer(q.qNo,'textAnswer',e.target.value)}
                    onFocus={e  => e.target.style.borderColor='#10B981'}
                    onBlur={e   => e.target.style.borderColor=ans.textAnswer?.trim()?'#10B981':'#E2E8F0'}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Bottom submit */}
        <button
          onClick={() => {
            if (window.confirm(`Submit test now? ${answered}/${questions.length} questions answered.`)) {
              doSubmit();
            }
          }}
          style={{
            padding:'16px',marginTop:8,
            background:'linear-gradient(135deg,#FF6B35,#E55A2B)',
            border:'none',borderRadius:14,
            color:'#fff',fontWeight:800,fontSize:16,
            cursor:'pointer',
            boxShadow:'0 4px 20px rgba(255,107,53,.35)'
          }}
        >
          ✅ Submit Test — {answered}/{questions.length} Answered
        </button>
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity:0; }
          to   { transform: translateY(0);     opacity:1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // PHASE: SUBMITTED
  // ══════════════════════════════════════════════════════════════════════
  if (phase === 'submitted') return (
    <div style={{
      minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#F8FAFC',padding:24
    }}>
      <div style={{maxWidth:460,width:'100%',textAlign:'center'}}>
        {/* Icon */}
        <div style={{
          width:90,height:90,borderRadius:'50%',
          background:result?.autoSubmitted?'#FEF3C7':'#D1FAE5',
          display:'flex',alignItems:'center',justifyContent:'center',
          margin:'0 auto 24px',
          border:`3px solid ${result?.autoSubmitted?'#F59E0B':'#10B981'}`
        }}>
          {result?.autoSubmitted
            ? <AlertTriangle size={40} color="#F59E0B"/>
            : <CheckCircle  size={40} color="#10B981"/>
          }
        </div>

        <h1 style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:26,
          color:'#1E293B',marginBottom:8}}>
          {result?.autoSubmitted ? 'Test Auto-Submitted' : 'Test Submitted!'}
        </h1>

        {result?.autoSubmitted && (
          <p style={{color:'#D97706',fontSize:13,marginBottom:16,fontWeight:600}}>
            Reason: {
              result.autoSubmitReason==='tab_switch' ? '🔴 Tab switch detected' :
              result.autoSubmitReason==='time_up'    ? '⏱ Time ran out' :
              result.autoSubmitReason==='violations' ? '⚠ Too many violations' :
              result.autoSubmitReason
            }
          </p>
        )}

        {/* Score card */}
        {result?.canShowScore && result?.scaledScore != null ? (
          <div style={{
            padding:'28px 24px',background:'#fff',
            borderRadius:20,border:'2px solid #E2E8F0',
            margin:'20px 0',
            boxShadow:'0 4px 20px rgba(0,0,0,.08)'
          }}>
            <div style={{
              fontFamily:"'Outfit',sans-serif",fontWeight:900,fontSize:60,
              color:result.scaledScore>=4?'#10B981':result.scaledScore>=2.5?'#F59E0B':'#EF4444',
              lineHeight:1
            }}>
              {result.scaledScore}
            </div>
            <div style={{fontSize:18,color:'#94A3B8',marginTop:4,fontWeight:600}}>/ 5</div>
            <div style={{
              marginTop:12,fontSize:13,color:'#64748B',
              display:'flex',alignItems:'center',justifyContent:'center',gap:16,flexWrap:'wrap'
            }}>
              {result.violationCount > 0 && (
                <span style={{color:'#D97706',fontWeight:600}}>
                  ⚠ {result.violationCount} violation{result.violationCount!==1?'s':''}
                </span>
              )}
              {result.timeSpent && (
                <span>⏱ {Math.floor(result.timeSpent/60)}m {result.timeSpent%60}s</span>
              )}
            </div>
          </div>
        ) : result?.status === 'submitted' ? (
          <div style={{
            padding:'20px',background:'#EFF6FF',borderRadius:16,
            border:'1px solid #BFDBFE',margin:'20px 0',
            fontSize:13,color:'#1D4ED8',lineHeight:1.7
          }}>
            📋 Your answers have been submitted successfully.<br/>
            <strong>Short answers will be graded by your teacher.</strong><br/>
            Your score will appear here once graded.
          </div>
        ) : (
          <div style={{padding:20,margin:'20px 0'}}>
            <div style={{
              width:32,height:32,border:'3px solid #E2E8F0',
              borderTopColor:'#3B82F6',borderRadius:'50%',
              animation:'spin 1s linear infinite',margin:'0 auto'
            }}/>
            <p style={{color:'#94A3B8',marginTop:12,fontSize:13}}>Loading result…</p>
          </div>
        )}

        <button
          onClick={onFinish}
          style={{
            width:'100%',padding:'14px',
            background:'linear-gradient(135deg,#FF6B35,#E55A2B)',
            border:'none',borderRadius:12,
            color:'#fff',fontWeight:700,fontSize:15,
            cursor:'pointer',
            boxShadow:'0 4px 16px rgba(255,107,53,.3)'
          }}
        >
          Back to Portal
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return null;
}
