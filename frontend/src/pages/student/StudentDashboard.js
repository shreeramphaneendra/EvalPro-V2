import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Layout, Empty, Spinner } from '../../components/Layout';
import StudentAssignmentsPage from './StudentAssignments';
import SlipTestExam from './SlipTestExam';
import StudentElectives from './StudentElectives';
import AccountSettings from '../../components/AccountSettings';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Award, Users, UserCheck,
  BookOpen, FileText, Settings, TrendingUp,
  Calendar, AlertCircle, CheckCircle2, ChevronRight
} from 'lucide-react';

const NAV = [
  { type:'section', label:'Main' },
  { path:'/student',             label:'Overview',     icon:<LayoutDashboard size={15}/> },
  { path:'/student/marks',       label:'My CIE Marks', icon:<Award size={15}/> },
  { path:'/student/teachers',    label:'My Teachers',  icon:<Users size={15}/> },
  { path:'/student/mentor',      label:'My Mentor',    icon:<UserCheck size={15}/> },
  { path:'/student/assignments', label:'Assignments',  icon:<FileText size={15}/> },
  { path:'/student/sliptests',   label:'Slip Tests',   icon:<span style={{fontSize:13}}>🛡</span> },
  { path:'/student/electives',   label:'Electives',    icon:<BookOpen size={15}/> },
  { type:'section', label:'Account' },
  { path:'/student/settings',    label:'Settings',     icon:<Settings size={15}/> },
];

export default function StudentDashboard() {
  return (
    <Layout nav={NAV} title="Student Portal" subtitle="CIE Evaluation System">
      <Routes>
        <Route path="/"            element={<StudentOverview/>}/>
        <Route path="/marks"       element={<MarksPage/>}/>
        <Route path="/teachers"    element={<TeachersPage/>}/>
        <Route path="/mentor"      element={<MentorPage/>}/>
        <Route path="/assignments" element={<StudentAssignmentsPage/>}/>
        <Route path="/sliptests"   element={<StudentSlipTests/>}/>
        <Route path="/electives"   element={<StudentElectives/>}/>
        <Route path="/settings"    element={<StudentSettings/>}/>
      </Routes>
    </Layout>
  );
}

/* ── OVERVIEW ─────────────────────────────────────────────────────────── */
function Overview() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [marks, setMarks] = useState({ theory:[], lab:[] });
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/student/my-marks').catch(()=>({ data:{ theory:[], lab:[] } })),
      api.get('/api/student/my-status').catch(()=>({ data:null })),
    ]).then(([m,s]) => { setMarks(m.data); setStatusInfo(s.data); })
      .finally(() => setLoading(false));
  }, []);

  const allMarks = [...(marks.theory||[]), ...(marks.lab||[])];
  if (loading) return <Loader/>;

  const firstName = user?.name?.split(' ')[0] || 'Student';
  const published = allMarks.filter(m => m.computed?.total != null).length;
  const pending   = allMarks.filter(m => m.computed?.total == null).length;

  return (
    <div className="s-page">
      {statusInfo?.status === 'Detained' && (
        <div className="s-alert s-alert--red">
          <AlertCircle size={16}/>
          <div><strong>You are currently detained.</strong> Contact your mentor or department admin immediately.</div>
        </div>
      )}

      {/* Hero */}
      <div className="s-hero">
        <div className="s-hero__text">
          <p className="s-hero__eyebrow">Academic Year 2025–26</p>
          <h1 className="s-hero__title">Welcome, {firstName}</h1>
          <p className="s-hero__sub">
            {user?.program} · Semester {user?.semester} · Section {user?.section}
          </p>
        </div>
        <div className="s-hero__stats">
          <div className="s-hero__stat">
            <span className="s-hero__stat-val">{published}</span>
            <span className="s-hero__stat-lbl">Published</span>
          </div>
          <div className="s-hero__stat-div"/>
          <div className="s-hero__stat">
            <span className="s-hero__stat-val" style={{color:'var(--amber)'}}>{pending}</span>
            <span className="s-hero__stat-lbl">Pending</span>
          </div>
          <div className="s-hero__stat-div"/>
          <div className="s-hero__stat">
            <span className="s-hero__stat-val" style={{color:'var(--violet)'}}>{allMarks.length}</span>
            <span className="s-hero__stat-lbl">Subjects</span>
          </div>
        </div>
      </div>

      {/* Supply alerts */}
      {(statusInfo?.supplies||[]).filter(s=>!s.cleared).length > 0 && (
        <div className="s-card">
          <div className="s-card__header">
            <AlertCircle size={15} color="var(--amber)"/>
            <h3 className="s-card__title" style={{color:'var(--amber)'}}>Pending Supply Subjects</h3>
          </div>
          <div className="s-supply-list">
            {statusInfo.supplies.filter(s=>!s.cleared).map(s => (
              <div key={s._id} className="s-supply-item">
                <span className="tag tag-amber">{s.subjectCode}</span>
                <span className="s-supply-name">{s.subjectName}</span>
                <span className="s-supply-meta">Sem {s.semester} · {s.academicYear}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick scores */}
      {allMarks.length > 0 && (
        <div className="s-card">
          <div className="s-card__header">
            <TrendingUp size={15} color="var(--brand)"/>
            <h3 className="s-card__title">CIE Score Summary</h3>
            <button className="s-link" onClick={()=>nav('/student/marks')}>
              View full sheet <ChevronRight size={13}/>
            </button>
          </div>
          <div className="s-scores">
            {allMarks.map((m,i) => {
              const total = m.computed?.total;
              const max   = m.subject?.type==='lab' ? 50 : 40;
              const pct   = total != null ? Math.round((total/max)*100) : null;
              return (
                <div key={i} className="s-score-row">
                  <div className="s-score-info">
                    <span className="s-score-name">{m.subject?.name}</span>
                    <span className={`tag tag-${m.subject?.type==='lab'?'blue':'orange'}`} style={{fontSize:10}}>{m.subject?.type}</span>
                  </div>
                  <div className="s-score-bar-wrap">
                    <div className="s-score-bar">
                      <div className="s-score-bar__fill" style={{
                        width: pct != null ? `${pct}%` : '0%',
                        background: pct>=75?'var(--mint)':pct>=50?'var(--amber)':'var(--red)',
                      }}/>
                    </div>
                  </div>
                  <div className="s-score-val">
                    {total != null
                      ? <><span className="s-score-num" style={{color:pct>=75?'var(--mint)':pct>=50?'var(--amber)':'var(--red)'}}>{total}</span><span className="s-score-max">/{max}</span></>
                      : <span className="tag tag-amber" style={{fontSize:10}}>Pending</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allMarks.length === 0 && (
        <div className="s-card s-card--empty">
          <div className="s-empty-icon">📊</div>
          <h3 className="s-empty-title">No marks published yet</h3>
          <p className="s-empty-sub">Your teachers will publish CIE marks after evaluation. Check back after class tests.</p>
        </div>
      )}
    </div>
  );
}


/* ── STUDENT OVERVIEW — uses only my-marks (proven working) ───────────── */
function StudentOverview() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [marks, setMarks] = useState({ theory:[], lab:[] });
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/student/my-marks').catch(()=>({ data:{ theory:[], lab:[] } })),
      api.get('/api/student/my-status').catch(()=>({ data:null })),
    ]).then(([m,s]) => { setMarks(m.data); setStatusInfo(s.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader/>;

  const theory = marks.theory || [];
  const lab    = marks.lab    || [];
  const all    = [...theory, ...lab];
  const firstName = user?.name?.split(' ')[0] || 'Student';

  const avgScore = all.length
    ? (all.reduce((s,m) => {
        const max = m.subject?.type==='lab'?50:40;
        const pct = m.computed?.total != null ? (m.computed.total/max)*100 : 0;
        return s + pct;
      }, 0) / all.length).toFixed(0)
    : null;

  return (
    <div className="s-page">
      {/* Detained alert */}
      {statusInfo?.status === 'Detained' && (
        <div className="s-alert s-alert--red">
          <AlertCircle size={16}/>
          <div><strong>You are detained.</strong> Contact your mentor immediately.</div>
        </div>
      )}

      {/* Hero */}
      <div className="s-hero">
        <div className="s-hero__text">
          <p className="s-hero__eyebrow">Academic Year 2025–26</p>
          <h1 className="s-hero__title">Welcome, {firstName}!</h1>
          <p className="s-hero__sub">
            {user?.program} · Semester {user?.semester} · Section {user?.section} · {user?.branch}
          </p>
        </div>
        <div className="s-hero__stats">
          <div className="s-hero__stat">
            <span className="s-hero__stat-val">{all.filter(m=>m.computed?.total!=null).length}</span>
            <span className="s-hero__stat-lbl">Published</span>
          </div>
          <div className="s-hero__stat-div"/>
          <div className="s-hero__stat">
            <span className="s-hero__stat-val" style={{color:'var(--amber)'}}>
              {all.filter(m=>m.computed?.total==null).length}
            </span>
            <span className="s-hero__stat-lbl">Pending</span>
          </div>
          <div className="s-hero__stat-div"/>
          <div className="s-hero__stat">
            <span className="s-hero__stat-val" style={{color: avgScore>=75?'var(--mint)':avgScore>=50?'var(--amber)':'var(--red)'}}>
              {avgScore != null ? `${avgScore}%` : '—'}
            </span>
            <span className="s-hero__stat-lbl">Avg Score</span>
          </div>
        </div>
      </div>

      {/* Supply alert */}
      {(statusInfo?.supplies||[]).filter(s=>!s.cleared).length > 0 && (
        <div className="s-card">
          <div className="s-card__header">
            <AlertCircle size={15} color="var(--amber)"/>
            <h3 className="s-card__title" style={{color:'var(--amber)'}}>Pending Supply Subjects</h3>
          </div>
          <div className="s-supply-list">
            {statusInfo.supplies.filter(s=>!s.cleared).map(s => (
              <div key={s._id} className="s-supply-item">
                <span className="tag tag-amber">{s.subjectCode}</span>
                <span className="s-supply-name">{s.subjectName}</span>
                <span className="s-supply-meta">Sem {s.semester}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score summary */}
      {all.length > 0 ? (
        <div className="s-card">
          <div className="s-card__header">
            <TrendingUp size={15} color="var(--brand)"/>
            <h3 className="s-card__title">CIE Score Summary</h3>
            <button className="s-link" onClick={()=>nav('/student/marks')}>
              View full sheet <ChevronRight size={13}/>
            </button>
          </div>
          <div className="s-scores">
            {all.map((m,i) => {
              const total = m.computed?.total;
              const max   = m.subject?.type==='lab' ? 50 : 40;
              const pct   = total != null ? Math.round((total/max)*100) : null;
              return (
                <div key={i} className="s-score-row">
                  <div className="s-score-info">
                    <span className="s-score-name">{m.subject?.name}</span>
                    <span className={`tag tag-${m.subject?.type==='lab'?'blue':'orange'}`} style={{fontSize:10}}>
                      {m.subject?.type}
                    </span>
                  </div>
                  <div className="s-score-bar-wrap">
                    <div className="s-score-bar">
                      <div className="s-score-bar__fill" style={{
                        width: pct!=null?`${pct}%`:'0%',
                        background: pct>=75?'var(--mint)':pct>=50?'var(--amber)':'var(--red)',
                      }}/>
                    </div>
                  </div>
                  <div className="s-score-val">
                    {total!=null
                      ? <><span className="s-score-num" style={{color:pct>=75?'var(--mint)':pct>=50?'var(--amber)':'var(--red)'}}>{total}</span><span className="s-score-max">/{max}</span></>
                      : <span className="tag tag-amber" style={{fontSize:10}}>Pending</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn btn-brand btn-sm" style={{marginTop:14}} onClick={()=>nav('/student/marks')}>
            View Full CIE Sheet →
          </button>
        </div>
      ) : (
        <div className="s-card s-card--empty">
          <div className="s-empty-icon">📊</div>
          <h3 className="s-empty-title">No marks published yet</h3>
          <p className="s-empty-sub">Your teachers will publish CIE marks after evaluation. Check back after class tests.</p>
        </div>
      )}
    </div>
  );
}


/* ── STUDENT SLIP TESTS ──────────────────────────────────────────────── */
function StudentSlipTests() {
  const [tests,     setTests]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTest, setActiveTest] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/sliptests/student/available'); setTests(data); }
    catch { /* No tests available */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (activeTest) return (
    <SlipTestExam testId={activeTest} onFinish={() => { setActiveTest(null); load(); }}/>
  );

  return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">Proctored Slip Tests</h2>
        <p className="s-page-sub">Active tests available for you right now</p>
      </div>

      {loading ? <div style={{textAlign:'center',padding:48}}><Spinner size="lg"/></div>
      : tests.length === 0
        ? (
          <div className="s-card s-card--empty">
            <div className="s-empty-icon">🛡</div>
            <h3 className="s-empty-title">No active slip tests</h3>
            <p className="s-empty-sub">Your teacher will publish a proctored slip test when it's time. Check back later.</p>
          </div>
        )
        : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {tests.map((t,i) => {
              const status = t.attemptStatus;
              const timeLeft = Math.max(0, new Date(t.test.windowEnd) - new Date());
              const minsLeft = Math.floor(timeLeft/60000);
              return (
                <div key={i} style={{
                  background:'var(--surface)',border:'1px solid var(--border)',
                  borderRadius:'var(--r4)',overflow:'hidden',
                  borderLeft:`4px solid ${status==='submitted'?'var(--mint)':'var(--brand)'}`,
                  boxShadow:'var(--shadow-sm)'
                }}>
                  <div style={{padding:'18px 20px'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                          <span style={{fontWeight:700,fontSize:15}}>{t.test.title}</span>
                          <span className={`tag tag-${t.test.slot==='ST1'?'orange':t.test.slot==='ST2'?'blue':'violet'}`} style={{fontSize:10}}>{t.test.slot}</span>
                          {status==='submitted'
                            ? <span className="tag tag-mint" style={{fontSize:10}}>✓ Submitted</span>
                            : <span className="tag tag-orange" style={{fontSize:10}}>Active</span>
                          }
                        </div>
                        <p style={{fontSize:12.5,color:'var(--text2)',marginBottom:6}}>
                          {t.test.subject?.name} ({t.test.subject?.code})
                        </p>
                        <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text2)',flexWrap:'wrap'}}>
                          <span>📝 {t.test.questionCount} questions</span>
                          <span>⏱ {t.test.duration} minutes</span>
                          <span>🎯 Scaled to /5</span>
                          {minsLeft > 0 && <span style={{color:'var(--amber)',fontWeight:600}}>🕐 {minsLeft}m remaining</span>}
                        </div>
                        {status==='submitted' && t.graded && t.scaledScore!=null && (
                          <div style={{marginTop:10}}>
                            <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:24,
                              color:t.scaledScore>=3?'var(--mint)':t.scaledScore>=2?'var(--amber)':'var(--red)'}}>
                              {t.scaledScore}
                            </span>
                            <span style={{color:'var(--text2)',fontSize:14}}>/5</span>
                          </div>
                        )}
                        {status==='submitted' && !t.graded && (
                          <p style={{marginTop:8,fontSize:12,color:'var(--text3)'}}>
                            {t.resultsAt
                              ? `🔒 Results at ${new Date(t.resultsAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} — after the test window closes`
                              : 'Awaiting teacher grading for short answers'}
                          </p>
                        )}
                      </div>
                      {status !== 'submitted' && (
                        <button
                          style={{
                            padding:'10px 22px',background:'linear-gradient(135deg,var(--brand),var(--brand-d))',
                            border:'none',borderRadius:'var(--r2)',color:'#fff',fontWeight:700,
                            fontSize:13,cursor:'pointer',flexShrink:0,boxShadow:'var(--shadow-brand)'
                          }}
                          onClick={() => setActiveTest(t.test._id)}>
                          {status==='in_progress' ? 'Continue Test' : 'Start Test'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{padding:'8px 20px',background:'var(--surface2)',borderTop:'1px solid var(--border)',
                    fontSize:11,color:'var(--text3)',display:'flex',gap:16}}>
                    <span>Window closes: {new Date(t.test.windowEnd).toLocaleString()}</span>
                    <span style={{color:'var(--red)'}}>⚠ Tab switching will auto-submit</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

/* ── MARKS PAGE — table view matching teacher's CIE sheet ─────────────── */
function MarksPage() {
  const [marks, setMarks] = useState({ theory:[], lab:[] });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/api/student/my-marks').then(r=>setMarks(r.data)).finally(()=>setLoading(false));
  }, []);

  if (loading) return <Loader/>;

  const theory = marks.theory || [];
  const lab    = marks.lab    || [];

  if (theory.length === 0 && lab.length === 0) return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">My CIE Marks</h2>
      </div>
      <div className="s-card s-card--empty">
        <div className="s-empty-icon">📊</div>
        <h3 className="s-empty-title">No marks published yet</h3>
        <p className="s-empty-sub">Your teacher will publish marks after evaluation. Check back after class tests.</p>
      </div>
    </div>
  );

  return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">My CIE Marks</h2>
        <p className="s-page-sub">{user?.name} · {user?.usn} · Sem {user?.semester} · Sec {user?.section}</p>
      </div>

      {/* Theory marks table */}
      {theory.length > 0 && (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{
            padding:'14px 20px',
            background:'linear-gradient(135deg,var(--navy),var(--navy3))',
            display:'flex',alignItems:'center',gap:12
          }}>
            <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,color:'#fff'}}>
              Theory CIE — /40
            </span>
            <span className="tag tag-orange" style={{fontSize:10}}>Published</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="marks-tbl" style={{minWidth:900}}>
              <thead>
                <tr>
                  <th className="left" rowSpan={2} style={{minWidth:180}}>Subject</th>
                  <th className="grp" colSpan={3}>Class Test (/20)</th>
                  <th className="grp" colSpan={3}>Assignment (/10)</th>
                  <th className="grp" colSpan={4}>Slip Test (/5)</th>
                  <th rowSpan={2} style={{minWidth:50}}>Att<br/>/5</th>
                  <th className="th-cie" rowSpan={2} style={{minWidth:70}}>CIE<br/>/40</th>
                </tr>
                <tr>
                  <th>CT1</th><th>CT2</th><th>AVG</th>
                  <th>A1</th><th>A2</th><th>AVG</th>
                  <th>ST1</th><th>ST2</th><th>ST3</th><th>AVG</th>
                </tr>
              </thead>
              <tbody>
                {theory.map((m,i) => {
                  const c = m.computed || {};
                  const total = c.total;
                  const pct = total != null ? Math.round((total/40)*100) : null;
                  return (
                    <tr key={i}>
                      <td className="left">
                        <div style={{fontWeight:600,fontSize:13.5}}>{m.subject?.name}</div>
                        <div style={{fontSize:11,color:'var(--text3)',fontFamily:"'JetBrains Mono',monospace"}}>{m.subject?.code}</div>
                        {m.teacher?.name && <div style={{fontSize:11,color:'var(--text3)'}}>by {m.teacher.name}</div>}
                      </td>
                      <td><MVal v={m.ct1?.isAbsent?'AB':m.ct1?.total}/></td>
                      <td><MVal v={m.ct2?.isAbsent?'AB':m.ct2?.total}/></td>
                      <td><MVal v={c.ctAvg} avg/></td>
                      <td><MVal v={m.asgn1?.isAbsent?'AB':m.asgn1?.total}/></td>
                      <td><MVal v={m.asgn2?.isAbsent?'AB':m.asgn2?.total}/></td>
                      <td><MVal v={c.asgnAvg} avg/></td>
                      <td><MVal v={m.st1?.isAbsent?'AB':m.st1?.total}/></td>
                      <td><MVal v={m.st2?.isAbsent?'AB':m.st2?.total}/></td>
                      <td><MVal v={m.st3?.isAbsent?'AB':m.st3?.total}/></td>
                      <td><MVal v={c.stAvg} avg/></td>
                      <td><MVal v={c.attMarks}/></td>
                      <td>
                        {total != null
                          ? <span style={{
                              fontFamily:"'JetBrains Mono',monospace",
                              fontWeight:800, fontSize:15,
                              color:pct>=75?'var(--mint)':pct>=50?'var(--amber)':'var(--red)'
                            }}>{total}</span>
                          : <span style={{color:'var(--text4)'}}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lab marks table */}
      {lab.length > 0 && (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{
            padding:'14px 20px',
            background:'linear-gradient(135deg,var(--violet-d),var(--violet))',
            display:'flex',alignItems:'center',gap:12
          }}>
            <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15,color:'#fff'}}>
              Lab CIE — /50
            </span>
            <span className="tag tag-blue" style={{fontSize:10}}>Published</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="marks-tbl" style={{minWidth:600}}>
              <thead>
                <tr>
                  <th className="left" rowSpan={2} style={{minWidth:180}}>Subject</th>
                  <th className="grp-lab" colSpan={3}>Lab Internals (/20)</th>
                  <th className="grp-lab" rowSpan={2}>AWCIE<br/>/30</th>
                  <th className="th-cie" rowSpan={2}>CIE<br/>/50</th>
                </tr>
                <tr>
                  <th>Int 1</th><th>Int 2</th><th>ALI</th>
                </tr>
              </thead>
              <tbody>
                {lab.map((m,i) => {
                  const c = m.computed || {};
                  const total = c.total;
                  const pct = total != null ? Math.round((total/50)*100) : null;
                  return (
                    <tr key={i}>
                      <td className="left">
                        <div style={{fontWeight:600,fontSize:13.5}}>{m.subject?.name}</div>
                        <div style={{fontSize:11,color:'var(--text3)',fontFamily:"'JetBrains Mono',monospace"}}>{m.subject?.code}</div>
                        {m.teacher?.name && <div style={{fontSize:11,color:'var(--text3)'}}>by {m.teacher.name}</div>}
                      </td>
                      <td><MVal v={m.int1?.isAbsent?'AB':m.int1?.total}/></td>
                      <td><MVal v={m.int2?.isAbsent?'AB':m.int2?.total}/></td>
                      <td><MVal v={c.ali} avg/></td>
                      <td><MVal v={c.awcie} avg/></td>
                      <td>
                        {total != null
                          ? <span style={{
                              fontFamily:"'JetBrains Mono',monospace",
                              fontWeight:800, fontSize:15,
                              color:pct>=75?'var(--mint)':pct>=50?'var(--amber)':'var(--red)'
                            }}>{total}</span>
                          : <span style={{color:'var(--text4)'}}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance legend */}
      <div className="alert alert-blue" style={{fontSize:12}}>
        <strong>Attendance marks:</strong> ≥85%→5 · ≥80%→4 · ≥75%→3 · ≥70%→2 · &lt;70%→Detained · Medical(≥60%)→1
      </div>
    </div>
  );
}

/* ── TEACHERS PAGE ────────────────────────────────────────────────────── */
function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/api/student/my-teachers').then(r=>setTeachers(r.data)).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Loader/>;
  return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">My Teachers</h2>
        <p className="s-page-sub">{teachers.length} teachers this semester</p>
      </div>
      {teachers.length === 0
        ? <Empty icon="👩‍🏫" msg="No teachers assigned yet"/>
        : (
          <div className="s-teacher-grid">
            {teachers.map((t,i) => (
              <div key={i} className="s-teacher-card">
                <div className="s-teacher-avatar">
                  {(t.teacher.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
                </div>
                <div className="s-teacher-name">{t.teacher.name}</div>
                <div className="s-teacher-role">{t.teacher.designation}</div>
                <div className="s-teacher-id mono">{t.teacher.employeeId}</div>
                <div className="s-teacher-subjects">
                  {t.subjects?.map((s,j) => (
                    <div key={j} className="s-teacher-subject">
                      <span className="s-teacher-subject-name">{s.name}</span>
                      <span className={`tag tag-${s.type==='lab'?'blue':'orange'}`} style={{fontSize:10}}>{s.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

/* ── MENTOR PAGE ─────────────────────────────────────────────────────── */
function MentorPage() {
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/api/student/my-mentor').then(r=>setRec(r.data)).catch(()=>setRec(null)).finally(()=>setLoading(false));
  }, []);
  if (loading) return <Loader/>;
  if (!rec) return (
    <div className="s-page">
      <div className="s-page-header"><h2 className="s-page-title">My Mentor</h2></div>
      <Empty icon="🎓" msg="No mentor assigned yet" sub="Contact admin to assign a mentor"/>
    </div>
  );
  return (
    <div className="s-page">
      <div className="s-page-header"><h2 className="s-page-title">My Mentor</h2></div>
      <div className="s-mentor-card">
        <div className="s-mentor-top">
          <div className="s-mentor-avatar">
            {(rec.mentor?.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
          </div>
          <div className="s-mentor-info">
            <h2 className="s-mentor-name">{rec.mentor?.name}</h2>
            <p className="s-mentor-role">{rec.mentor?.designation}</p>
            <p className="s-mentor-email">{rec.mentor?.email}</p>
            <div className="s-mentor-tags">
              <span className="tag tag-orange">Batch {rec.mentoringBatch}</span>
              <span className="tag tag-blue">Semester {rec.semester}</span>
            </div>
          </div>
        </div>
        <div className="divider"/>
        <h3 className="s-meetings-title">
          Meeting History
          <span className="s-meetings-count">{rec.meetings?.length||0}</span>
        </h3>
        {!rec.meetings?.length
          ? <p className="s-meetings-empty">No meetings recorded yet.</p>
          : (
            <div className="s-meetings">
              {rec.meetings.map((m,i) => (
                <div key={i} className="s-meeting">
                  <div className="s-meeting__date">
                    <Calendar size={11}/>
                    {new Date(m.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                  </div>
                  <p className="s-meeting__notes">{m.notes}</p>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

/* ── ELECTIVES PAGE ──────────────────────────────────────────────────── */
function ElectivesPage() {
  const { user } = useAuth();
  const [electives, setElectives] = useState([]);
  const [enrolled,  setEnrolled]  = useState(user?.electives||[]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(null);
  useEffect(() => {
    api.get('/api/student/electives').then(r=>setElectives(r.data)).finally(()=>setLoading(false));
  }, []);
  const toggle = async (subjectId, isEnrolled) => {
    setSaving(subjectId);
    try {
      const { data } = await api.post('/api/student/electives/enroll', { subjectId, action: isEnrolled?'unenroll':'enroll' });
      setEnrolled(data.electives||[]);
      toast.success(isEnrolled ? 'Unenrolled' : 'Enrolled successfully');
    } catch(err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(null); }
  };
  if (loading) return <Loader/>;
  return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">Professional Electives</h2>
        <p className="s-page-sub">Enroll in elective subjects for this semester</p>
      </div>
      {electives.length === 0
        ? <Empty icon="📘" msg="No electives available" sub="Contact admin to add elective subjects"/>
        : (
          <div className="s-electives">
            {electives.map(e => {
              const isE = enrolled.includes(e._id);
              return (
                <div key={e._id} className={`s-elective-card${isE?' s-elective-card--enrolled':''}`}>
                  <div className="s-elective-info">
                    <div className="s-elective-name">{e.name}</div>
                    <div className="s-elective-meta">
                      <span className="mono s-elective-code">{e.code}</span>
                      {isE && <span className="tag tag-mint">✓ Enrolled</span>}
                    </div>
                    <div className="s-elective-teacher">{e.assignedTeacher?.name}</div>
                  </div>
                  <button className={`btn btn-sm ${isE?'btn-ghost':'btn-brand'}`}
                    onClick={()=>toggle(e._id,isE)} disabled={saving===e._id}>
                    {saving===e._id ? <Spinner/> : isE ? 'Unenroll' : 'Enroll'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

/* ── SETTINGS ─────────────────────────────────────────────────────────── */
function StudentSettings() {
  const { user } = useAuth();
  return (
    <div className="s-page">
      <div className="s-page-header"><h2 className="s-page-title">Account Settings</h2></div>
      <AccountSettings accent="var(--mint)" fields={[
        { label:'USN',             value:user?.usn,            mono:true },
        { label:'Branch',          value:user?.branch },
        { label:'Semester',        value:`Semester ${user?.semester}` },
        { label:'Section',         value:`Section ${user?.section}` },
        { label:'Lab Batch',       value:user?.labBatch,       mono:true },
        { label:'Mentoring Batch', value:user?.mentoringBatch, mono:true },
      ]}/>
    </div>
  );
}

/* ── SHARED ───────────────────────────────────────────────────────────── */
function MVal({ v, avg }) {
  if (v === null || v === undefined || v === '') return <span style={{color:'var(--text4)'}}>—</span>;
  if (v === 'AB') return <span className="ab-badge">AB</span>;
  if (avg) return <span className="avg-val">{v}</span>;
  return <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:500}}>{v}</span>;
}
function Loader() {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}><Spinner size="lg"/></div>;
}
