import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Layout, Modal, Empty, Spinner } from '../../components/Layout';
import AccountSettings from '../../components/AccountSettings';
import TeacherAssignmentsPage, { AssignmentCIEPanel } from './TeacherAssignments';
import SlipTestManager from './SlipTestManager';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, BookOpen, FileText, UserCheck,
  Settings, Download, Save, RefreshCw, Plus, Trash2,
  CheckCircle, ArrowLeftRight, Search, Upload, Calendar
} from 'lucide-react';

const EXAM_MAX = { CT1:20, CT2:20, ASGN1:10, ASGN2:10, ST1:5, ST2:5, ST3:5, LAB_INT1:20, LAB_INT2:20 };

const THEORY_TABS = [
  { key:'OVERALL',    label:'Overall' },
  { key:'CT1',        label:'CT 1' },
  { key:'CT2',        label:'CT 2' },
  { key:'ASGN1',      label:'Asgn 1' },
  { key:'ASGN2',      label:'Asgn 2' },
  { key:'ST1',        label:'ST 1' },
  { key:'ST2',        label:'ST 2' },
  { key:'ST3',        label:'ST 3' },
  { key:'ATTENDANCE', label:'Attendance' },
];
const LAB_TABS = [
  { key:'OVERALL',  label:'Overall' },
  { key:'LAB_INT1', label:'Internal 1' },
  { key:'LAB_INT2', label:'Internal 2' },
  { key:'WEEKLY',   label:'Weekly Marks' },
];

const NAV = [
  { type:'section', label:'Main' },
  { path:'/teacher',             label:'Overview',     icon:<LayoutDashboard size={15}/> },
  { type:'section', label:'CIE Entry' },
  { path:'/teacher/cie',         label:'CIE Sheets',   icon:<BookOpen size={15}/> },
  { path:'/teacher/sliptests',   label:'Slip Tests',    icon:<span style={{fontSize:13}}>🛡</span> },
  { type:'section', label:'Other' },
  { path:'/teacher/assignments', label:'Assignments',  icon:<FileText size={15}/> },
  { path:'/teacher/mentoring',   label:'Mentoring',    icon:<UserCheck size={15}/> },
  { path:'/teacher/mentor-entry',label:'Mentor Entry',  icon:<span style={{fontSize:13}}>📝</span> },
  { type:'section', label:'Account' },
  { path:'/teacher/settings',    label:'Settings',     icon:<Settings size={15}/> },
];

export default function TeacherDashboard() {
  const { user } = useAuth();
  const nav = user?.isAdmin
    ? [...NAV.slice(0,-2),
       { path:'/teacher/admin', label:'Switch to Admin', icon:<ArrowLeftRight size={15}/>, switchTo:'/admin' },
       NAV[NAV.length-2], NAV[NAV.length-1]]
    : NAV;
  return (
    <Layout nav={nav} title="Teacher Dashboard" subtitle="CIE Evaluation Portal">
      <Routes>
        <Route path="/"            element={<TeacherOverview/>}/>
        <Route path="/cie"         element={<CIEPage/>}/>
        <Route path="/sliptests"   element={<SlipTestsPage/>}/>
        <Route path="/cie"         element={<CIEPage/>}/>
        <Route path="/sliptests"   element={<SlipTestsPage/>}/>
        <Route path="/assignments" element={<TeacherAssignmentsPage/>}/>
        <Route path="/mentoring"     element={<MentoringPage/>}/>
        <Route path="/mentor-entry"  element={<MentorBulkEntry/>}/>
        <Route path="/settings"    element={<TeacherSettings/>}/>
      </Routes>
    </Layout>
  );
}

/* ── OVERVIEW ─────────────────────────────────────────────────────────── */
function Overview() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/teacher/pending-work').then(r=>setPending(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const counts = {
    total:      pending.length,
    published:  pending.filter(s=>s.status==='published').length,
    progress:   pending.filter(s=>s.status==='in-progress'||s.status==='ready').length,
    notStarted: pending.filter(s=>s.status==='not-started').length,
  };

  if (loading) return <TLoader/>;

  return (
    <div className="t-page">
      <div>
        <h2 className="t-page-title">Welcome back, {user?.name?.split(' ')[0]}!</h2>
        <p className="t-page-sub">Your CIE mark entry status for this academic year.</p>
      </div>

      <div className="t-stats fade-up">
        {[
          { val:counts.total,      lbl:'Total Subjects', bg:'var(--brand-l)',  color:'var(--brand)' },
          { val:counts.published,  lbl:'Published',      bg:'var(--mint-l)',   color:'var(--mint)'  },
          { val:counts.progress,   lbl:'In Progress',    bg:'var(--blue-l)',   color:'var(--blue)'  },
          { val:counts.notStarted, lbl:'Not Started',    bg:'var(--red-l)',    color:'var(--red)'   },
        ].map(s=>(
          <div key={s.lbl} className="t-stat">
            <div className="t-stat__icon" style={{background:s.bg}}>
              <span style={{fontFamily:"'Outfit',sans-serif",fontSize:24,fontWeight:800,color:s.color,lineHeight:1}}>{s.val}</span>
            </div>
            <div className="t-stat__lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="card fade-up2">
        <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:700,marginBottom:14}}>
          Mark Entry Status
        </h3>
        {pending.length === 0
          ? <Empty icon="📚" msg="No subjects assigned" sub="Contact admin to assign subjects"/>
          : (
            <div className="t-subject-list">
              {pending.map(s=>(
                <div key={s.subject.id} className={`t-subject-row t-subject-row--${s.status}`}>
                  <div className="t-subject-info">
                    <div className="t-subject-name">{s.subject.name}</div>
                    <div className="t-subject-meta">
                      <span className="mono" style={{fontSize:11,color:'var(--text3)'}}>{s.subject.code}</span>
                      <span className="tag tag-orange" style={{fontSize:10}}>Sem {s.subject.semester}</span>
                    </div>
                    <div className="t-exam-chips">
                      {Object.entries(s.examStatus).map(([exam,info])=>(
                        <span key={exam} className={`t-exam-chip t-exam-chip--${info.complete?'done':info.entered>0?'partial':'empty'}`}>
                          {exam}{info.total>0?` ${info.entered}/${info.total}`:''}
                          {info.complete?' ✓':''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`t-subject-status t-subject-status--${s.status}`}>
                    {{published:'Published ✓',ready:'Ready',['in-progress']:'In Progress',['not-started']:'Not Started'}[s.status]}
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}


/* ── TEACHER OVERVIEW — uses only proven working endpoints ─────────────── */
function TeacherOverview() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [subjects,  setSubjects]  = useState([]);
  const [subStats,  setSubStats]  = useState({});
  const [loading,   setLoading]   = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  // Step 1: load subjects using my-subjects (proven to work)
  useEffect(() => {
    api.get('/api/teacher/my-subjects')
      .then(r => { setSubjects(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Step 2: for each subject load overall sheet to get stats
  useEffect(() => {
    if (!subjects.length) return;
    setLoadingStats(true);
    const promises = subjects.map(async sub => {
      try {
        const endpoint = sub.type === 'lab' ? '/api/teacher/lab-overall' : '/api/teacher/theory-overall';
        const { data } = await api.get(endpoint, { params: { subjectId: sub._id } });
        const sheet = data || [];
        const total     = sheet.length;
        const entered   = sheet.filter(r => r.record?.computed?.total != null).length;
        const published = sheet.filter(r => r.record?.status === 'submitted' || r.record?.status === 'approved').length;
        const isPublished = published > 0;
        const inProgress  = entered > 0 && entered < total;
        const complete    = entered === total && total > 0;
        const status = isPublished ? 'published' : complete ? 'ready' : inProgress ? 'in-progress' : 'not-started';
        return { id: sub._id, total, entered, published, status };
      } catch {
        return { id: sub._id, total:0, entered:0, published:0, status:'not-started' };
      }
    });
    Promise.all(promises).then(results => {
      const map = {};
      results.forEach(r => { map[r.id] = r; });
      setSubStats(map);
    }).finally(() => setLoadingStats(false));
  }, [subjects]);

  if (loading) return <TLoader/>;

  const firstName = user?.name?.split(' ')[0] || 'Teacher';
  const stats = Object.values(subStats);
  const counts = {
    total:      subjects.length,
    published:  stats.filter(s => s.status === 'published').length,
    ready:      stats.filter(s => s.status === 'ready').length,
    inProgress: stats.filter(s => s.status === 'in-progress').length,
    notStarted: stats.filter(s => s.status === 'not-started').length,
  };

  const statusLabel = {
    'published':   { label:'Published ✓', color:'var(--mint)',  bg:'var(--mint-l)',   border:'#A7F3D0' },
    'ready':       { label:'Ready to Publish', color:'var(--blue)', bg:'var(--blue-l)', border:'#BFDBFE' },
    'in-progress': { label:'In Progress', color:'var(--brand)', bg:'var(--brand-l)',  border:'#FFD0BC' },
    'not-started': { label:'Not Started', color:'var(--text3)', bg:'var(--surface2)', border:'var(--border2)' },
  };

  return (
    <div className="t-page">
      {/* Greeting */}
      <div>
        <h2 className="t-page-title">Welcome back, {firstName}!</h2>
        <p className="t-page-sub">
          {user?.department} Department · {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
        </p>
      </div>

      {/* Stat cards */}
      <div className="t-stats fade-up">
        {[
          { val:counts.total,      lbl:'Total Subjects', color:'var(--brand)',  bg:'var(--brand-l)'  },
          { val:counts.published,  lbl:'Published',      color:'var(--mint)',   bg:'var(--mint-l)'   },
          { val:counts.inProgress, lbl:'In Progress',    color:'var(--blue)',   bg:'var(--blue-l)'   },
          { val:counts.notStarted, lbl:'Not Started',    color:'var(--red)',    bg:'var(--red-l)'    },
        ].map(s => (
          <div key={s.lbl} className="t-stat" onClick={()=>nav('/teacher/cie')} style={{cursor:'pointer'}}>
            <div className="t-stat__icon" style={{background:s.bg}}>
              <span style={{fontFamily:"'Outfit',sans-serif",fontSize:26,fontWeight:800,color:s.color,lineHeight:1}}>{s.val}</span>
            </div>
            <div className="t-stat__lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Subject status list */}
      <div className="card fade-up2">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:700}}>Mark Entry Status</h3>
          {loadingStats && <Spinner/>}
          <button className="btn btn-brand btn-sm" onClick={()=>nav('/teacher/cie')}>
            Go to CIE Sheets →
          </button>
        </div>

        {subjects.length === 0 ? (
          <Empty icon="📚" msg="No subjects assigned" sub="Go to Admin → Subjects → assign yourself to a subject"/>
        ) : (
          <div className="t-subject-list">
            {subjects.map(sub => {
              const st = subStats[sub._id];
              const sl = statusLabel[st?.status || 'not-started'];
              return (
                <div key={sub._id}
                  className={`t-subject-row t-subject-row--${st?.status||'not-started'}`}
                  onClick={()=>nav('/teacher/cie')}
                  style={{cursor:'pointer'}}
                >
                  <div className="t-subject-info">
                    <div className="t-subject-name">{sub.name}</div>
                    <div className="t-subject-meta">
                      <span className="mono" style={{fontSize:11,color:'var(--text3)'}}>{sub.code}</span>
                      <span className="tag tag-orange" style={{fontSize:10}}>Sem {sub.semester}</span>
                      <span className={`tag tag-${sub.type==='lab'?'blue':'orange'}`} style={{fontSize:10}}>{sub.type}</span>
                      {sub.mySections?.length > 0 && (
                        <span className="tag tag-gray" style={{fontSize:10}}>Sec {sub.mySections.join(', ')}</span>
                      )}
                    </div>
                    {st && (
                      <div style={{marginTop:8,display:'flex',alignItems:'center',gap:12,fontSize:12,color:'var(--text2)'}}>
                        <span>
                          <strong style={{color:'var(--text)',fontFamily:"'JetBrains Mono',monospace"}}>{st.entered}</strong>
                          /{st.total} students with marks entered
                        </span>
                        {st.published > 0 && (
                          <span style={{color:'var(--mint)',fontWeight:600}}>
                            ✓ Published to {st.published} student{st.published>1?'s':''}
                          </span>
                        )}
                      </div>
                    )}
                    {!st && loadingStats && (
                      <div style={{marginTop:6,fontSize:12,color:'var(--text3)'}}>Loading stats…</div>
                    )}
                  </div>
                  <span style={{
                    fontSize:11.5, fontWeight:700, padding:'4px 14px', borderRadius:20,
                    color:sl.color, background:sl.bg, border:`1px solid ${sl.border}`,
                    flexShrink:0, whiteSpace:'nowrap'
                  }}>{sl.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── CIE PAGE ─────────────────────────────────────────────────────────── */
function CIEPage() { // Default page
  const [subjects,      setSubjects]      = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [activeSem,     setActiveSem]     = useState(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(()=>{
    api.get('/api/teacher/my-subjects').then(r=>{
      const data = r.data;
      setSubjects(data);
      if (data.length > 0) {
        const sems = [...new Set(data.map(s=>s.semester))].sort((a,b)=>a-b);
        setActiveSem(sems[0]);
        const first = data.find(s=>s.semester===sems[0]);
        if (first) {
          setSelected(first);
          setActiveSection(first.mySections?.[0] || null);
        }
      }
    }).finally(()=>setLoading(false));
  },[]);

  if (loading) return <TLoader/>;
  if (subjects.length === 0) return <Empty icon="📚" msg="No subjects assigned" sub="Contact admin to assign subjects to you"/>;

  const semesters   = [...new Set(subjects.map(s=>s.semester))].sort((a,b)=>a-b);
  const semSubjects = subjects.filter(s=>s.semester===activeSem);

  const selectSubject = (s) => {
    setSelected(s);
    setActiveSection(s.mySections?.[0] || null);
  };

  // Pass active section into subject object so TheoryCIESheet can use it
  const subjectWithSection = selected ? { ...selected, _activeSection: activeSection } : null;

  return (
    <div className="t-cie-layout">
      <div>
        <h2 className="t-page-title">CIE Evaluation Sheets</h2>
        <p className="t-page-sub">
          {semesters.length > 1 ? 'Select semester and subject' : 'Select a subject to enter marks'}
        </p>
      </div>

      {/* Semester tabs — only show if teacher handles multiple semesters */}
      {semesters.length > 1 && (
        <div className="tabs" style={{borderBottom:'2px solid var(--border)'}}>
          {semesters.map(sem=>(
            <button key={sem}
              className={`tab-btn${activeSem===sem?' active':''}`}
              onClick={()=>{
                setActiveSem(sem);
                const first = subjects.find(s=>s.semester===sem);
                if (first) selectSubject(first);
              }}>
              Semester {sem}
              <span style={{marginLeft:5,fontSize:10,fontWeight:700,
                background:activeSem===sem?'rgba(255,107,53,.2)':'var(--surface2)',
                color:activeSem===sem?'var(--brand)':'var(--text3)',
                padding:'1px 6px',borderRadius:10}}>
                {subjects.filter(s=>s.semester===sem).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Subject pills */}
      <div className="t-subject-selector">
        {semSubjects.map(s=>(
          <button key={s._id}
            className={`t-subject-pill t-subject-pill--${s.type}${selected?._id===s._id?' t-subject-pill--active':''}`}
            onClick={()=>selectSubject(s)}>
            <div className="t-subject-pill__name">{s.name}</div>
            <div className="t-subject-pill__meta">
              {s.code} · Sem {s.semester}
              {s.mySections?.length>0 && ` · Sec ${s.mySections.join(', ')}`}
              {s.type==='lab' && s.myBatches?.length>0 && ` · ${[...new Set(s.myBatches.map(b=>b.batch||b))].join('/')}`}
            </div>
          </button>
        ))}
      </div>

      {/* Section selector — shown when teacher handles multiple sections */}
      {selected && selected.mySections?.length > 1 && selected.type !== 'lab' && (
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',padding:'8px 0'}}>
          <span style={{fontSize:12,fontWeight:700,color:'var(--text2)'}}>Section:</span>
          {selected.mySections.map(sec=>(
            <button key={sec}
              onClick={()=>setActiveSection(sec)}
              style={{
                padding:'5px 16px',borderRadius:20,fontSize:12.5,fontWeight:600,
                border:`1.5px solid ${activeSection===sec?'var(--brand)':'var(--border2)'}`,
                background:activeSection===sec?'var(--brand)':'var(--surface)',
                color:activeSection===sec?'#fff':'var(--text2)',
                cursor:'pointer',transition:'all .13s'
              }}>
              Section {sec}
            </button>
          ))}
          {activeSection && (
            <span style={{fontSize:11.5,color:'var(--text3)'}}>
              Showing marks for Section {activeSection} only
            </span>
          )}
        </div>
      )}

      {/* CIE sheet */}
      {subjectWithSection && (
        <div className="t-cie-panel">
          <div className="t-cie-bar">
            <div className="t-cie-bar__info">
              <strong>{selected.name}</strong>
              <span style={{color:'var(--text3)',marginLeft:8}}>
                {selected.code} · Sem {selected.semester}
                {activeSection && ` · Section ${activeSection}`}
              </span>
              {selected.markEntryDeadline && <DeadlineBadge deadline={selected.markEntryDeadline}/>}
            </div>
            <div className="t-cie-bar__actions">
              <PublishBtn subjectId={selected._id} subjectName={selected.name}/>
              <UnpublishBtn subjectId={selected._id} subjectName={selected.name}/>
            </div>
          </div>

          {selected.type==='theory'||selected.type==='elective'
            ? <TheoryCIESheet subject={subjectWithSection}/>
            : selected.type==='lab'
              ? <LabCIESheet subject={selected}/>
              : <div className="alert alert-amber" style={{borderRadius:'0 0 var(--r3) var(--r3)'}}>This subject has no CIE component.</div>
          }
        </div>
      )}
    </div>
  );
}

/* ── THEORY CIE SHEET ─────────────────────────────────────────────────── */
function TheoryCIESheet({ subject }) {
  const [tab,    setTab]    = useState('OVERALL');
  const [sheet,  setSheet]  = useState([]);
  const [config, setConfig] = useState(null);
  const [edits,  setEdits]  = useState({});
  const [search, setSearch] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [cfgModal, setCfgModal] = useState(false);
  const [cfgForm,  setCfgForm]  = useState({ questions:[] });
  const [coModal,  setCoModal]  = useState(false);
  const [xlModal,  setXlModal]  = useState(false);
  const [anomalies, setAnomalies] = useState(null);

  const loadSheet = useCallback(async()=>{
    setLoading(true); setSearch('');
    try {
      if(tab==='OVERALL'){
        const { data } = await api.get('/api/teacher/theory-overall',{params:{subjectId:subject._id}});
        setSheet(data); setConfig(null); setEdits({});
      } else {
        const { data } = await api.get('/api/teacher/theory-sheet',{params:{subjectId:subject._id,examType:tab,section:subject._activeSection||undefined}});
        setSheet(data.sheet||[]); setConfig(data.config||null);
        const init={};
        (data.sheet||[]).forEach(row=>{
          const field=tab.toLowerCase();
          const rec=row.record?.[field]||row.record?.attendance;
          if(tab==='ATTENDANCE'){
            init[row.student.id]={totalConducted:row.record?.attendance?.totalConducted||'',attended:row.record?.attendance?.attended||'',medicalCondonation:row.record?.attendance?.medicalCondonation||false};
          } else {
            const questions=(data.config?.questions||[]).map(q=>({
              qNo:q.qNo,marks:rec?.questions?.find(rq=>rq.qNo===q.qNo)?.marks??'',absent:false
            }));
            init[row.student.id]={questions,isAbsent:rec?.isAbsent||false};
          }
        });
        setEdits(init);
      }
    } finally { setLoading(false); }
  },[tab,subject._id]);

  useEffect(()=>{ loadSheet(); },[loadSheet]);

  const setMark = (sid,qNo,val)=>setEdits(p=>({...p,[sid]:{...p[sid],questions:(p[sid]?.questions||[]).map(q=>q.qNo===qNo?{...q,marks:val}:q)}}));
  const setAbsent = (sid,absent)=>setEdits(p=>({...p,[sid]:{...p[sid],isAbsent:absent}}));
  const setAtt = (sid,field,val)=>setEdits(p=>({...p,[sid]:{...p[sid],[field]:val}}));

  const saveAll = async()=>{
    if(!config&&tab!=='ATTENDANCE'){toast.error('Configure question paper first!');return;}
    setSaving(true);
    try {
      const rows=sheet.map(row=>{
        const e=edits[row.student.id]||{};
        if(tab==='ATTENDANCE') return {studentId:row.student.id,totalConducted:Number(e.totalConducted)||0,attended:Number(e.attended)||0,medicalCondonation:e.medicalCondonation||false};
        return {studentId:row.student.id,questions:e.questions||[],isAbsent:e.isAbsent||false};
      });
      await api.post('/api/teacher/theory-marks/bulk-save',{subjectId:subject._id,examType:tab,rows,section:subject._activeSection||undefined});
      toast.success('Marks saved!');
      // Run AI anomaly check after saving CT marks
      if (['CT1','CT2','ST1','ST2','ST3'].includes(tab)) {
        try {
          const { data: anomalyData } = await api.post('/api/teacher/ai/anomaly-check', { subjectId: subject._id, examType: tab });
          if (anomalyData.anomalies?.length > 0) {
            setAnomalies(anomalyData);
          }
        } catch { /* anomaly check is non-blocking */ }
      }
      loadSheet();
    } catch(err){ toast.error(err.response?.data?.message||'Save failed'); }
    finally{ setSaving(false); }
  };

  const openCfg=()=>{
    const qs = (config?.questions||[{qNo:'1',coNo:'CO1',maxMarks:'',eitherOrPair:'',groupId:''}]).map(q=>({
      qNo: q.qNo||'',
      coNo: q.coNo||'CO1',
      maxMarks: q.maxMarks||'',
      eitherOrPair: q.eitherOrPair||'',
      groupId: q.groupId||''
    }));
    setCfgForm({questions: qs});
    setCfgModal(true);
  };
  const saveCfg=async()=>{
    const questions=cfgForm.questions
      .filter(q=>q.qNo&&q.maxMarks)
      .map(q=>({
        qNo:          q.qNo,
        coNo:         q.coNo||'CO1',
        maxMarks:     Number(q.maxMarks)||0,
        eitherOrPair: q.eitherOrPair||'',
        groupId:      q.eitherOrPair ? (q.groupId||q.qNo.replace(/[AB]$/,'')) : ''
      }));
    if(!questions.length){toast.error('Add at least one question');return;}
    // Effective total: non-paired + max of each pair
    const pairMaxes={};
    questions.filter(q=>q.eitherOrPair&&q.groupId).forEach(q=>{
      const k=q.eitherOrPair+'__'+q.groupId;
      const prev=pairMaxes;
      if(!prev[q.eitherOrPair]) prev[q.eitherOrPair]={};
      prev[q.eitherOrPair][q.groupId]=(prev[q.eitherOrPair][q.groupId]||0)+q.maxMarks;
    });
    const effectiveTotal=questions.filter(q=>!q.eitherOrPair).reduce((s,q)=>s+q.maxMarks,0)+
      Object.values(pairMaxes).reduce((s,g)=>s+Math.max(...Object.values(g)),0);
    const target=EXAM_MAX[tab];
    if(target&&effectiveTotal>target){toast.error(`Effective total ${effectiveTotal} exceeds max ${target}. Check your either/or pairs.`);return;}
    setSaving(true);
    try{
      await api.post('/api/teacher/exam-config',{subjectId:subject._id,examType:tab,questions});
      toast.success('Question paper configured!');
      setCfgModal(false);
      loadSheet();
    }
    catch(err){toast.error(err.response?.data?.message||'Failed');}
    finally{setSaving(false);}
  };

  const dlExcel=()=>{
    const wb=XLSX.utils.book_new();
    if(tab==='OVERALL'){
      const semLabel = `Sem ${subject.semester}`;
      const secLabel = subject._activeSection ? `Section ${subject._activeSection}` : (subject.mySections?.length ? `Section ${subject.mySections.join('/')}` : 'All Sections');
      const h=['#','Section','USN','Name','CT1','CT2','CT Avg','A1','A2','Asgn Avg','ST1','ST2','ST3','ST Avg','Att','CIE/40'];
      const r=sheet.map((row,i)=>[i+1,row.student.section||'',row.student.usn,row.student.name,row.record?.ct1?.total??'',row.record?.ct2?.total??'',row.record?.computed?.ctAvg??'',row.record?.asgn1?.total??'',row.record?.asgn2?.total??'',row.record?.computed?.asgnAvg??'',row.record?.st1?.total??'',row.record?.st2?.total??'',row.record?.st3?.total??'',row.record?.computed?.stAvg??'',row.record?.computed?.attMarks??'',row.record?.computed?.total??'']);
      const ws=XLSX.utils.aoa_to_sheet([h,...r]);
      // Add title rows at top
      XLSX.utils.sheet_add_aoa(ws,[
        [`Subject: ${subject.name} (${subject.code})`],
        [`${semLabel} · ${secLabel}`],
        []
      ],{origin:'A1'});
      XLSX.utils.sheet_add_aoa(ws,[h,...r],{origin:'A4'});
      ws['!cols']=h.map((_,i)=>({wch:i<4?16:9}));XLSX.utils.book_append_sheet(wb,ws,'Overall CIE');
    } else {
      const qs=config?.questions||[];
      const secLbl = subject._activeSection ? `Section ${subject._activeSection}` : (subject.mySections?.length ? `Section ${subject.mySections.join('/')}` : '');
      const h=['#','Section','USN','Name',...qs.map(q=>`Q${q.qNo}(${q.coNo})(/${q.maxMarks})`),'Total','AB'];
      const r=sheet.map((row,i)=>{const e=edits[row.student.id]||{};const qm=qs.map(q=>e.questions?.find(eq=>eq.qNo===q.qNo)?.marks??'');const tot=e.isAbsent?'AB':qm.reduce((s,m)=>s+(m===''?0:Number(m)),0);return[i+1,row.student.section||'',row.student.usn,row.student.name,...qm,tot,e.isAbsent?'AB':''];});
      const ws=XLSX.utils.aoa_to_sheet([
        [`Subject: ${subject.name} (${subject.code}) · ${tab} · Sem ${subject.semester} · ${secLbl}`],
        [`Max Marks: ${config?.totalMax||'?'} · Academic Year 2025-26`],
        [],
        h,...r
      ]);ws['!cols']=h.map((_,i)=>({wch:i<4?16:12}));XLSX.utils.book_append_sheet(wb,ws,tab);
    }
    XLSX.writeFile(wb,`${subject.name}_${tab}.xlsx`);
  };

  const isSTTab = ['ST1','ST2','ST3'].includes(tab);
  const filtered=search?sheet.filter(r=>r.student.name.toLowerCase().includes(search.toLowerCase())||r.student.usn.toLowerCase().includes(search.toLowerCase())):sheet;

  return (
    <div className="t-tbl-shell">
      {/* Tabs */}
      <div className="tabs" style={{borderRadius:0,borderBottom:'2px solid var(--border)'}}>
        {THEORY_TABS.map(t=>(
          <button key={t.key} className={`tab-btn${tab===t.key?' active':''}`} onClick={()=>setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ST1/ST2/ST3 — show SlipTestManager instead of marks entry */}
      {isSTTab && (
        <div style={{padding:'20px'}}>
          <SlipTestManager subject={subject} slot={tab}/>
        </div>
      )}

      {/* Section chips — only for non-ST tabs */}
      {!isSTTab && (subject.mySections?.length>0||subject.myBatches?.length>0) && (
        <div className="t-section-chips">
          <span className="t-section-label">Showing:</span>
          {subject.mySections?.map(s=><span key={s} className="tag tag-blue" style={{fontSize:10}}>Section {s}</span>)}
          {subject.myBatches?.map((b,i)=><span key={i} className="tag tag-purple" style={{fontSize:10}}>Sec {b.section} · {b.batch}</span>)}
        </div>
      )}


      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',padding:'10px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
        {tab!=='OVERALL'&&tab!=='ATTENDANCE'&&(
          config
            ? <span className="tag tag-mint" style={{fontSize:10.5}}><CheckCircle size={11}/> {config.questions?.length} questions · /{config.totalMax}</span>
            : <span className="tag tag-red" style={{fontSize:10.5}}>Not configured</span>
        )}
        <div style={{flex:1}}/>
        {['ASGN1','ASGN2','ST1','ST2','ST3'].includes(tab)&&(
          <AssignmentCIEPanel subject={subject} slotNo={tab.startsWith('ASGN')?Number(tab.slice(-1)):Number(tab.slice(-1))} type={tab.startsWith('ASGN')?'assignment':'sliptest'}/>
        )}
        {tab!=='OVERALL'&&tab!=='ATTENDANCE'&&<button className="btn btn-ghost btn-sm" onClick={openCfg}><Settings size={12}/> Configure</button>}
        {tab!=='OVERALL'&&tab!=='ATTENDANCE'&&<button className="btn btn-ghost btn-sm" onClick={()=>setXlModal(true)}><Upload size={12}/> Upload</button>}
        <button className="btn btn-ghost btn-sm" onClick={()=>setCoModal(true)} title="CO Attainment Report">📊 CO Attainment</button>
        <button className="btn btn-ghost btn-sm" onClick={loadSheet}><RefreshCw size={12}/></button>
        <button className="btn btn-ghost btn-sm" onClick={dlExcel}><Download size={12}/></button>
        {tab!=='OVERALL'&&<button className="btn btn-brand btn-sm" onClick={saveAll} disabled={saving}>{saving?<Spinner/>:<><Save size={12}/> Save</>}</button>}
      </div>

      {/* AI Anomaly Detection results */}
      {anomalies && anomalies.anomalies?.length > 0 && (
        <div style={{borderBottom:'1px solid var(--border)',background:'#FFFBEB',padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:14}}>⚠️</span>
              <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,color:'#92400E'}}>
                AI detected {anomalies.anomalies.length} anomal{anomalies.anomalies.length===1?'y':'ies'} in {anomalies.examType} marks
              </span>
              <span className="ai-badge" style={{fontSize:10}}>✦ AI Check</span>
            </div>
            <button className="btn btn-ghost btn-xs" onClick={()=>setAnomalies(null)} style={{color:'var(--text3)'}}>✕ Dismiss</button>
          </div>
          <div className="ai-anomaly-list">
            {anomalies.anomalies.map((a,i)=>(
              <div key={i} className={`ai-anomaly ai-anomaly--${a.type}`}>
                <span className="ai-anomaly__icon">
                  {a.type==='class_low'?'📉':a.type==='many_full'?'🎯':a.type==='ct_drop'?'📊':'⚠️'}
                </span>
                <div className="ai-anomaly__body">
                  {a.student && <div className="ai-anomaly__title">{a.student} <span className="mono" style={{fontSize:10,opacity:.7}}>{a.usn}</span></div>}
                  <div className="ai-anomaly__detail">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{fontSize:11,color:'#92400E',marginTop:8,opacity:.7}}>
            Review these before publishing marks to students.
          </p>
        </div>
      )}

      {!isSTTab && sheet.length>10&&(
        <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
          <div style={{position:'relative',maxWidth:280}}>
            <Search size={12} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--text3)'}}/>
            <input className="input" style={{paddingLeft:28,fontSize:12.5,height:32}} placeholder="Search name or USN…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>
      )}

      {/* Table */}
      {loading
        ? <div style={{padding:40,textAlign:'center'}}><Spinner size="lg"/></div>
        : filtered.length===0
          ? <Empty icon="👥" msg="No students found"/>
          : (
            <div className="t-tbl-scroll">
              {tab==='OVERALL'    && <OverallTheoryTable sheet={filtered}/>}
              {tab==='ATTENDANCE' && <AttendanceTable sheet={filtered} edits={edits} onChange={setAtt}/>}
              {!['OVERALL','ATTENDANCE'].includes(tab) && (
                <QuestionMarksTable sheet={filtered} edits={edits} config={config} setMark={setMark} setAbsent={setAbsent}/>
              )}
            </div>
          )
      }

      {/* Modals */}
      <Modal open={cfgModal} onClose={()=>setCfgModal(false)} title={`Configure Question Paper — ${tab}`} width={640}>
        <ConfigModal tab={tab} cfgForm={cfgForm} setCfgForm={setCfgForm} onSave={saveCfg} onClose={()=>setCfgModal(false)} saving={saving}/>
      </Modal>
      <COAttainmentModal open={coModal} onClose={()=>setCoModal(false)} subject={subject}/>
      <ExcelUploadModal  open={xlModal} onClose={()=>setXlModal(false)} subject={subject} tab={tab} onUploaded={loadSheet}/>
    </div>
  );
}

/* ── OVERALL THEORY TABLE ─────────────────────────────────────────────── */
function OverallTheoryTable({ sheet }) {
  return (
    <table className="marks-tbl">
      <thead>
        <tr>
          <th className="left t-row-num" rowSpan={2}>#</th>
          <th className="left" rowSpan={2} style={{minWidth:140}}>Student</th>
          <th rowSpan={2}>Sec</th>
          <th className="grp" colSpan={3}>Class Test (/20)</th>
          <th className="grp" colSpan={3}>Assignment (/10)</th>
          <th className="grp" colSpan={4}>Slip Test (/5)</th>
          <th rowSpan={2}>Att<br/>/5</th>
          <th className="th-cie" rowSpan={2}>CIE<br/>/40</th>
        </tr>
        <tr>
          <th>CT1</th><th>CT2</th><th>Avg</th>
          <th>A1</th><th>A2</th><th>Avg</th>
          <th>ST1</th><th>ST2</th><th>ST3</th><th>Avg</th>
        </tr>
      </thead>
      <tbody>
        {sheet.map((row,i)=>(
          <tr key={row.student.id}>
            <td className="left t-row-num">{i+1}</td>
            <td className="left">
              <div className="t-student-name">{row.student.name}</div>
              <div className="t-student-meta">
                <span className="t-student-usn">{row.student.usn}</span>
                {row.student.isRepeating&&<span className="tag tag-amber" style={{fontSize:9}}>REPEAT</span>}
              </div>
            </td>
            <td><span className="tag tag-gray" style={{fontSize:10}}>S{row.student.section}</span></td>
            {[
              row.record?.ct1?.isAbsent?'AB':row.record?.ct1?.total,
              row.record?.ct2?.isAbsent?'AB':row.record?.ct2?.total,
              row.record?.computed?.ctAvg,
            ].map((v,j)=><td key={j}><CellVal v={v} avg={j===2}/></td>)}
            {[
              row.record?.asgn1?.isAbsent?'AB':row.record?.asgn1?.total,
              row.record?.asgn2?.isAbsent?'AB':row.record?.asgn2?.total,
              row.record?.computed?.asgnAvg,
            ].map((v,j)=><td key={j}><CellVal v={v} avg={j===2}/></td>)}
            {[
              row.record?.st1?.isAbsent?'AB':row.record?.st1?.total,
              row.record?.st2?.isAbsent?'AB':row.record?.st2?.total,
              row.record?.st3?.isAbsent?'AB':row.record?.st3?.total,
              row.record?.computed?.stAvg,
            ].map((v,j)=><td key={j}><CellVal v={v} avg={j===3}/></td>)}
            <td><CellVal v={row.record?.computed?.attMarks}/></td>
            <td><span className="cie-val">{row.record?.computed?.total??'—'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── QUESTION MARKS TABLE ─────────────────────────────────────────────── */
function QuestionMarksTable({ sheet, edits, config, setMark, setAbsent }) {
  const qs = config?.questions||[];
  if(!qs.length) return (
    <div className="alert alert-orange" style={{margin:16,borderRadius:'var(--r2)'}}>
      Configure the question paper first using the Configure button above.
    </div>
  );

  const pairMap={};
  qs.forEach(q=>{ if(q.eitherOrPair&&q.groupId){ if(!pairMap[q.eitherOrPair])pairMap[q.eitherOrPair]=[]; if(!pairMap[q.eitherOrPair].includes(q.groupId))pairMap[q.eitherOrPair].push(q.groupId); } });

  const groupTotal=(e,pair,group)=>qs.filter(q=>q.groupId===group&&q.eitherOrPair===pair).reduce((s,q)=>{const qe=(e?.questions||[]).find(eq=>eq.qNo===q.qNo);return s+(Number(qe?.marks)||0);},0);
  const bestGroup=(e,pair)=>{
    const groups=pairMap[pair]||[];
    const attempted=groups.filter(g=>qs.filter(q=>q.groupId===g&&q.eitherOrPair===pair).some(q=>{const qe=(e?.questions||[]).find(eq=>eq.qNo===q.qNo);return qe?.marks!==undefined&&qe?.marks!==null&&qe?.marks!=='';}));
    if(!attempted.length) return{group:null,score:0,bothAttempted:false};
    if(attempted.length===1) return{group:attempted[0],score:groupTotal(e,pair,attempted[0]),bothAttempted:false};
    const scores=attempted.map(g=>({g,s:groupTotal(e,pair,g)})).sort((a,b)=>b.s-a.s);
    return{group:scores[0].g,score:scores[0].s,loserGroup:scores[1].g,loserScore:scores[1].s,bothAttempted:true};
  };

  const pairBg={pair1:'#DBEAFE',pair2:'#EDE9FE',pair3:'#D1FAE5',pair4:'#FEF3C7'};

  return (
    <div>
      {Object.keys(pairMap).length>0&&(
        <div className="t-eo-legend">
          <strong>Either/Or:</strong>
          {Object.entries(pairMap).map(([pair,groups])=>(
            <span key={pair} style={{display:'flex',alignItems:'center',gap:5}}>
              <span className="t-eo-dot" style={{background:pairBg[pair]||'#f3f4f6',border:'1px solid #ccc'}}/>
              Q{groups[0]} OR Q{groups[1]} — system picks higher score
            </span>
          ))}
        </div>
      )}
      <table className="marks-tbl">
        <thead>
          <tr>
            <th className="left t-row-num" rowSpan={2}>#</th>
            <th className="left" rowSpan={2} style={{minWidth:140}}>Student</th>
            {qs.map((q,qi)=>{
              const prev=qs[qi-1];
              const groupChange=q.eitherOrPair&&q.groupId&&(!prev||prev.groupId!==q.groupId);
              const isFirstOfPair=q.eitherOrPair&&(!prev||prev.eitherOrPair!==q.eitherOrPair);
              return (
                <th key={q.qNo} style={{
                  background:q.eitherOrPair?pairBg[q.eitherOrPair]||'#f3f4f6':'linear-gradient(135deg,var(--brand-d),var(--brand))',
                  color:q.eitherOrPair?'var(--navy2)':'#fff',
                  borderLeft:groupChange&&!isFirstOfPair?'3px solid var(--brand)':undefined,
                  position:'relative',fontSize:10,fontWeight:700
                }}>
                  {groupChange&&!isFirstOfPair&&(
                    <span style={{position:'absolute',top:'50%',left:-14,transform:'translateY(-50%)',background:'var(--brand)',color:'#fff',fontSize:9,padding:'2px 3px',borderRadius:3,fontWeight:800,zIndex:5}}>OR</span>
                  )}
                  Q{q.qNo}<br/>
                  <span style={{fontSize:9,opacity:.8}}>{q.coNo}</span><br/>
                  <span style={{fontSize:9,opacity:.7}}>/{q.maxMarks}</span>
                </th>
              );
            })}
            {Object.keys(pairMap).map(pair=>(
              <th key={`used_${pair}`} style={{background:'var(--navy3)',color:'rgba(255,255,255,.8)',fontSize:9,minWidth:68}}>
                {pair.replace('pair','P')} USED
              </th>
            ))}
            <th className="th-cie" rowSpan={2}>Total<br/>/{config?.totalMax||0}</th>
            <th rowSpan={2} style={{minWidth:36}}>AB</th>
          </tr>
          <tr/>
        </thead>
        <tbody>
          {sheet.map((row,i)=>{
            const e=edits[row.student.id]||{};
            const pairDec={};
            Object.keys(pairMap).forEach(pair=>{ pairDec[pair]=bestGroup(e,pair); });
            const isLoser=q=>{
              if(!q.eitherOrPair||!q.groupId) return false;
              const d=pairDec[q.eitherOrPair];
              // Only mark as loser when BOTH sides attempted — otherwise let teacher fill freely
              return d.bothAttempted && d.group!==null && d.group!==q.groupId;
            };
            const total=e.isAbsent?null:qs.reduce((s,q)=>{ if(isLoser(q)) return s; const qe=(e.questions||[]).find(eq=>eq.qNo===q.qNo); return s+(Number(qe?.marks)||0); },0);

            return (
              <tr key={row.student.id}>
                <td className="left t-row-num">{i+1}</td>
                <td className="left">
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div>
                      <div className="t-student-name">{row.student.name}</div>
                      <div className="t-student-meta">
                        <span className="t-student-usn">{row.student.usn}</span>
                        {row.student.isRepeating&&<span className="tag tag-amber" style={{fontSize:9}}>RPT</span>}
                      </div>
                    </div>
                    <span className="tag tag-gray" style={{fontSize:9,marginLeft:'auto'}}>S{row.student.section}</span>
                  </div>
                </td>
                {qs.map(q=>{
                  const qe=(e.questions||[]).find(eq=>eq.qNo===q.qNo)||{};
                  const loser=isLoser(q);
                  const dec=q.eitherOrPair?pairDec[q.eitherOrPair]:null;
                  return (
                    <td key={q.qNo} style={{
                      background:loser?'var(--surface3)':q.eitherOrPair?pairBg[q.eitherOrPair]+'AA':undefined,
                      borderLeft:q.eitherOrPair&&qs[qs.indexOf(q)-1]?.groupId!==q.groupId&&qs[qs.indexOf(q)-1]?.eitherOrPair===q.eitherOrPair?'3px solid var(--brand)':undefined,
                      opacity:loser?0.6:1,position:'relative'
                    }}>
                      {loser&&dec?.bothAttempted&&(
                        <span style={{position:'absolute',top:1,right:1,fontSize:8,color:'var(--text3)',fontWeight:700,lineHeight:1,background:'var(--surface3)',padding:'1px 2px',borderRadius:2}}>✕</span>
                      )}
                      <input className={`marks-input${qe.absent?' err':''}`}
                        type="number" min={0} max={q.maxMarks} step="0.5"
                        value={e.isAbsent?'AB':(qe.marks??'')}
                        onChange={ev=>setMark(row.student.id,q.qNo,ev.target.value)}
                        disabled={e.isAbsent}
                        placeholder="—"
                      />
                    </td>
                  );
                })}
                {Object.entries(pairDec).map(([pair,dec])=>(
                  <td key={`used_${pair}`} style={{fontSize:10,padding:'4px 5px',background:dec.bothAttempted?'var(--amber-l)':dec.group?'var(--mint-l)':'var(--surface2)'}}>
                    {e.isAbsent?'—':!dec.group?<span style={{color:'var(--text3)'}}>—</span>:dec.bothAttempted?(
                      <div>
                        <span style={{color:'var(--mint)',fontWeight:700,fontSize:10.5}}>Q{dec.group} ✓</span>
                        <div style={{color:'var(--red)',fontSize:9,textDecoration:'line-through'}}>Q{dec.loserGroup}: {dec.loserScore}</div>
                      </div>
                    ):<span style={{fontWeight:600,fontSize:11}}>Q{dec.group}</span>}
                  </td>
                ))}
                <td><span className={e.isAbsent?'ab-badge':'cie-val'}>{e.isAbsent?'AB':(total??'—')}</span></td>
                <td style={{textAlign:'center'}}><input type="checkbox" checked={e.isAbsent||false} onChange={ev=>setAbsent(row.student.id,ev.target.checked)}/></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── ATTENDANCE TABLE ─────────────────────────────────────────────────── */
function AttendanceTable({ sheet, edits, onChange }) {
  const attMarks=(pct,med)=>pct>=85?5:pct>=80?4:pct>=75?3:pct>=70?2:(med&&pct>=60?1:0);
  const pctColor=pct=>pct>=75?'var(--mint)':pct>=70?'var(--amber)':'var(--red)';

  return (
    <div>
      <div className="alert alert-blue" style={{margin:'10px 14px',borderRadius:'var(--r2)',fontSize:11.5}}>
        <strong>Attendance Formula:</strong> ≥85%→5 · ≥80%→4 · ≥75%→3 · ≥70%→2 · &lt;70%→Detained · Medical ≥60%→1
      </div>
      <table className="marks-tbl">
        <thead>
          <tr>
            <th className="left t-row-num">#</th>
            <th className="left" style={{minWidth:140}}>Student</th>
            <th>Total<br/>Classes</th>
            <th>Attended</th>
            <th>%</th>
            <th className="th-cie">Marks<br/>/5</th>
            <th>Status</th>
            <th title="Medical condonation — ≥60% gets 1 mark if approved by college">Med</th>
          </tr>
        </thead>
        <tbody>
          {sheet.map((row,i)=>{
            const e=edits[row.student.id]||{};
            const tc=Number(e.totalConducted)||0;
            const att=Number(e.attended)||0;
            const pct=tc>0?Math.round((att/tc)*100):0;
            const med=e.medicalCondonation||false;
            const marks=tc>0?attMarks(pct,med):null;
            const isDetained=tc>0&&pct<70&&!med;
            return (
              <tr key={row.student.id}>
                <td className="left t-row-num">{i+1}</td>
                <td className="left">
                  <div className="t-student-name">{row.student.name}</div>
                  <div className="t-student-meta">
                    <span className="t-student-usn">{row.student.usn}</span>
                    <span className="tag tag-gray" style={{fontSize:9}}>S{row.student.section}</span>
                  </div>
                </td>
                <td><input className="marks-input" type="number" min={0} value={e.totalConducted??''} onChange={ev=>onChange(row.student.id,'totalConducted',ev.target.value)} placeholder="0" style={{width:56}}/></td>
                <td><input className="marks-input" type="number" min={0} max={tc||undefined} value={e.attended??''} onChange={ev=>onChange(row.student.id,'attended',ev.target.value)} placeholder="0" style={{width:56}}/></td>
                <td><span className="t-att-pct" style={{color:tc?pctColor(pct):'var(--text3)'}}>{tc?`${pct}%`:'—'}</span></td>
                <td><span className="cie-val">{marks!==null?marks:'—'}</span></td>
                <td>
                  {!tc?<span style={{color:'var(--text4)',fontSize:11}}>—</span>
                   :isDetained?<span className="tag tag-red" style={{fontSize:10}}>Detained</span>
                   :pct<75?<span className="tag tag-amber" style={{fontSize:10}}>Low</span>
                   :<span className="tag tag-mint" style={{fontSize:10}}>OK</span>}
                </td>
                <td style={{textAlign:'center'}}>
                  <input type="checkbox" checked={med} onChange={ev=>onChange(row.student.id,'medicalCondonation',ev.target.checked)}/>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── LAB CIE SHEET ────────────────────────────────────────────────────── */
function LabCIESheet({ subject }) {
  const [tab,    setTab]    = useState('OVERALL');
  const [batch,  setBatch]  = useState(subject.myBatches?.[0]||'B1');
  const [sheet,  setSheet]  = useState([]);
  const [config, setConfig] = useState(null);
  const [edits,  setEdits]  = useState({});
  const [weekCount, setWeekCount] = useState(4);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [cfgModal,  setCfgModal]  = useState(false);
  const [cfgForm,   setCfgForm]   = useState({questions:[]});

  const loadSheet=useCallback(async()=>{
    setLoading(true);
    try{
      if(tab==='OVERALL'){
        const{data}=await api.get('/api/teacher/lab-overall',{params:{subjectId:subject._id}});
        setSheet(data); setConfig(null); setEdits({});
      } else if(tab==='WEEKLY'){
        const{data}=await api.get('/api/teacher/lab-sheet',{params:{subjectId:subject._id,batch}});
        setSheet(data); setConfig(null);
        const init={};
        data.forEach(row=>{
          const wm=row.record?.weeklyMarks||[];
          const we={};
          for(let w=1;w<=weekCount;w++){
            const wk=wm.find(x=>x.week===w)||{};
            we[`pep_w${w}`]=wk.pep??'';we[`exp_w${w}`]=wk.exp??'';we[`pea_w${w}`]=wk.pea??'';
            we[`record_w${w}`]=wk.record??'';we[`conduct_w${w}`]=wk.conduct??'';
            we[`date_w${w}`]=wk.date?new Date(wk.date).toISOString().substring(0,10):'';
          }
          init[row.student.id]=we;
        });
        setEdits(init);
      } else {
        const intNo=tab==='LAB_INT1'?1:2;
        const[{data:sData},{data:cfgData}]=await Promise.all([
          api.get('/api/teacher/lab-sheet',{params:{subjectId:subject._id,batch}}),
          api.get('/api/teacher/exam-config',{params:{subjectId:subject._id,examType:tab}})
        ]);
        setSheet(sData); setConfig(cfgData);
        const init={};
        sData.forEach(row=>{
          const intData=intNo===1?row.record?.int1:row.record?.int2;
          const qs=(cfgData?.questions||[]).map(q=>({qNo:q.qNo,marks:intData?.questions?.find(rq=>rq.qNo===q.qNo)?.marks??'',absent:false}));
          init[row.student.id]={questions:qs,isAbsent:intData?.isAbsent||false};
        });
        setEdits(init);
      }
    }finally{setLoading(false);}
  },[tab,batch,subject._id,weekCount]);

  useEffect(()=>{loadSheet();},[loadSheet]);

  const setMark=(sid,qNo,val)=>setEdits(p=>({...p,[sid]:{...p[sid],questions:(p[sid]?.questions||[]).map(q=>q.qNo===qNo?{...q,marks:val}:q)}}));
  const setWeekMark=(sid,field,val)=>setEdits(p=>({...p,[sid]:{...p[sid],[field]:val}}));
  const setAbsent=(sid,absent)=>setEdits(p=>({...p,[sid]:{...p[sid],isAbsent:absent}}));

  const saveAll=async()=>{
    setSaving(true);
    try{
      if(tab==='WEEKLY'){
        const rows=sheet.map(row=>{
          const e=edits[row.student.id]||{};
          const wm=[];
          for(let w=1;w<=weekCount;w++) wm.push({week:w,date:e[`date_w${w}`]||null,pep:n(e[`pep_w${w}`]),exp:n(e[`exp_w${w}`]),pea:n(e[`pea_w${w}`]),record:n(e[`record_w${w}`]),conduct:n(e[`conduct_w${w}`])});
          return{studentId:row.student.id,weeklyMarks:wm};
        });
        await api.post('/api/teacher/lab-marks/bulk-save',{subjectId:subject._id,batch,rows,saveType:'weekly'});
      } else {
        const intNo=tab==='LAB_INT1'?1:2;
        const rows=sheet.map(row=>{const e=edits[row.student.id]||{};return{studentId:row.student.id,internalNo:intNo,questions:e.questions||[],isAbsent:e.isAbsent||false};});
        await api.post('/api/teacher/lab-marks/bulk-save',{subjectId:subject._id,batch,rows,saveType:'internal'});
      }
      toast.success('Marks saved!'); loadSheet();
    }catch(err){toast.error(err.response?.data?.message||'Save failed');}
    finally{setSaving(false);}
  };

  const openCfg=()=>{
    const qs=(config?.questions||[{qNo:'1',coNo:'CO1',maxMarks:'',eitherOrPair:'',groupId:''}]).map(q=>({
      qNo:q.qNo||'', coNo:q.coNo||'CO1', maxMarks:q.maxMarks||'',
      eitherOrPair:q.eitherOrPair||'', groupId:q.groupId||''
    }));
    setCfgForm({questions:qs}); setCfgModal(true);
  };
  const saveCfg=async()=>{
    const questions=cfgForm.questions
      .filter(q=>q.qNo&&q.maxMarks)
      .map(q=>({
        qNo:          q.qNo,
        coNo:         q.coNo||'CO1',
        maxMarks:     Number(q.maxMarks)||0,
        eitherOrPair: q.eitherOrPair||'',
        groupId:      q.eitherOrPair ? (q.groupId||q.qNo.replace(/[AB]$/,'')) : ''
      }));
    if(!questions.length){toast.error('Add at least one question');return;}
    // Effective total: non-paired + max of each pair
    const pairMaxes={};
    questions.filter(q=>q.eitherOrPair&&q.groupId).forEach(q=>{
      const k=q.eitherOrPair+'__'+q.groupId;
      const prev=pairMaxes;
      if(!prev[q.eitherOrPair]) prev[q.eitherOrPair]={};
      prev[q.eitherOrPair][q.groupId]=(prev[q.eitherOrPair][q.groupId]||0)+q.maxMarks;
    });
    const effectiveTotal=questions.filter(q=>!q.eitherOrPair).reduce((s,q)=>s+q.maxMarks,0)+
      Object.values(pairMaxes).reduce((s,g)=>s+Math.max(...Object.values(g)),0);
    const target=EXAM_MAX[tab];
    if(target&&effectiveTotal>target){toast.error(`Effective total ${effectiveTotal} exceeds max ${target}. Check your either/or pairs.`);return;}
    setSaving(true);
    try{
      await api.post('/api/teacher/exam-config',{subjectId:subject._id,examType:tab,questions});
      toast.success('Question paper configured!');
      setCfgModal(false);
      loadSheet();
    }
    catch(err){toast.error(err.response?.data?.message||'Failed');}
    finally{setSaving(false);}
  };

  const batches=subject.myBatches?.length>0?subject.myBatches:['B1','B2','B3'];

  return (
    <div className="t-tbl-shell">
      {/* Tabs */}
      <div className="tabs" style={{borderRadius:0}}>
        {LAB_TABS.map(t=><button key={t.key} className={`tab-btn${tab===t.key?' active':''}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
      </div>

      {/* Controls */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',padding:'10px 14px',borderBottom:'1px solid var(--border)',background:'var(--surface)'}}>
        {/* Batch selector */}
        {tab!=='OVERALL'&&(
          <div className="t-batch-selector">
            <span className="t-batch-label">Batch:</span>
            {batches.map(b=>(
              <button key={b} className={`t-batch-pill${batch===b?' t-batch-pill--active':''}`} onClick={()=>setBatch(b)}>{b}</button>
            ))}
          </div>
        )}
        {/* Week count */}
        {tab==='WEEKLY'&&(
          <div className="t-week-control">
            <span className="t-week-label">Weeks:</span>
            <button className="btn btn-ghost btn-xs" onClick={()=>setWeekCount(Math.max(1,weekCount-1))}>−</button>
            <span className="t-week-count">{weekCount}</span>
            <button className="btn btn-ghost btn-xs" onClick={()=>{
              if(weekCount>=16){toast.error('Max 16 weeks');return;}
              if(weekCount>=12){if(!window.confirm(`Adding week ${weekCount+1}. Typical lab has 8-12 weeks. Continue?`))return;}
              setWeekCount(weekCount+1);
            }}>+</button>
            {weekCount>12&&<span className="tag tag-amber" style={{fontSize:10}}>⚠ {weekCount} weeks</span>}
          </div>
        )}
        {['LAB_INT1','LAB_INT2'].includes(tab)&&<button className="btn btn-ghost btn-sm" onClick={openCfg}><Settings size={12}/> Configure</button>}
        <div style={{flex:1}}/>
        <button className="btn btn-ghost btn-sm" onClick={loadSheet}><RefreshCw size={12}/></button>
        <button className="btn btn-ghost btn-sm" onClick={()=>{
          const wb=XLSX.utils.book_new();
          if(tab==='OVERALL'){
            const h=['#','USN','Name','Sec','Batch','Int1','Int2','ALI(/20)','AWCIE(/30)','CIE/50'];
            const r=sheet.map((row,i)=>[i+1,row.student.usn,row.student.name,row.student.section,row.student.labBatch,row.record?.int1?.total??'',row.record?.int2?.total??'',row.record?.computed?.ali??'',row.record?.computed?.awcie??'',row.record?.computed?.total??'']);
            const ws=XLSX.utils.aoa_to_sheet([h,...r]);XLSX.utils.book_append_sheet(wb,ws,'Lab CIE');
          }
          // Add title row if Overall sheet
          if(tab==='OVERALL'){
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            const title = `Subject: ${subject.name} (${subject.code}) · Lab CIE · Semester ${subject.semester} · Batch ${batch}`;
            XLSX.utils.sheet_add_aoa(firstSheet,[[title]],{origin:'A1'});
          }
          XLSX.writeFile(wb,`${subject.name}_${batch}_Sem${subject.semester}_${tab}.xlsx`);
        }}><Download size={12}/></button>
        {tab!=='OVERALL'&&<button className="btn btn-brand btn-sm" onClick={saveAll} disabled={saving}>{saving?<Spinner/>:<><Save size={12}/> Save</>}</button>}
      </div>

      {loading
        ? <div style={{padding:40,textAlign:'center'}}><Spinner size="lg"/></div>
        : sheet.length===0
          ? <Empty icon="👥" msg={`No students in batch ${batch}`}/>
          : (
            <div className="t-tbl-scroll">
              {tab==='OVERALL'    && <OverallLabTable sheet={sheet}/>}
              {['LAB_INT1','LAB_INT2'].includes(tab) && <QuestionMarksTable sheet={sheet} edits={edits} config={config} setMark={setMark} setAbsent={setAbsent}/>}
              {tab==='WEEKLY'     && <WeeklyTable sheet={sheet} edits={edits} weekCount={weekCount} setMark={setWeekMark}/>}
            </div>
          )
      }

      <Modal open={cfgModal} onClose={()=>setCfgModal(false)} title={`Configure ${tab} Question Paper`} width={640}>
        <ConfigModal tab={tab} cfgForm={cfgForm} setCfgForm={setCfgForm} onSave={saveCfg} onClose={()=>setCfgModal(false)} saving={saving}/>
      </Modal>
    </div>
  );
}

/* ── OVERALL LAB TABLE ────────────────────────────────────────────────── */
function OverallLabTable({ sheet }) {
  return (
    <table className="marks-tbl">
      <thead>
        <tr>
          <th className="left t-row-num" rowSpan={2}>#</th>
          <th className="left" rowSpan={2} style={{minWidth:140}}>Student</th>
          <th rowSpan={2}>Sec</th>
          <th rowSpan={2}>Batch</th>
          <th className="grp-lab" colSpan={3}>Lab Internals (/20)</th>
          <th className="grp-lab" rowSpan={2}>AWCIE<br/>/30</th>
          <th className="th-cie" rowSpan={2}>CIE<br/>/50</th>
        </tr>
        <tr>
          <th>Int 1</th><th>Int 2</th><th>ALI</th>
        </tr>
      </thead>
      <tbody>
        {sheet.map((row,i)=>(
          <tr key={row.student.id}>
            <td className="left t-row-num">{i+1}</td>
            <td className="left">
              <div className="t-student-name">{row.student.name}</div>
              <div className="t-student-meta">
                <span className="t-student-usn">{row.student.usn}</span>
                {row.student.isRepeating&&<span className="tag tag-amber" style={{fontSize:9}}>RPT</span>}
              </div>
            </td>
            <td><span className="tag tag-gray" style={{fontSize:10}}>S{row.student.section}</span></td>
            <td><span className="tag tag-purple" style={{fontSize:10}}>{row.student.labBatch}</span></td>
            <td><CellVal v={row.record?.int1?.isAbsent?'AB':row.record?.int1?.total}/></td>
            <td><CellVal v={row.record?.int2?.isAbsent?'AB':row.record?.int2?.total}/></td>
            <td><CellVal v={row.record?.computed?.ali} avg/></td>
            <td><CellVal v={row.record?.computed?.awcie} avg/></td>
            <td><span className="cie-val">{row.record?.computed?.total??'—'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── WEEKLY TABLE ─────────────────────────────────────────────────────── */
function WeeklyTable({ sheet, edits, weekCount, setMark }) {
  const liveAvg=(e,field)=>{const vals=[];for(let w=1;w<=weekCount;w++){const v=e[`${field}_w${w}`];if(v!==''&&!isNaN(v))vals.push(Number(v));}return vals.length?parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1)):null;};
  return (
    <table className="marks-tbl">
      <thead>
        <tr>
          <th className="left t-row-num" rowSpan={2}>#</th>
          <th className="left" rowSpan={2} style={{minWidth:140}}>Student</th>
          {Array.from({length:weekCount},(_,i)=>(
            <th key={i} className="grp-lab" colSpan={6} style={{minWidth:260}}>Week {i+1}</th>
          ))}
          <th className="grp-avg" colSpan={5}>Averages</th>
          <th className="th-cie" rowSpan={2}>AWCIE<br/>/30</th>
        </tr>
        <tr>
          {Array.from({length:weekCount},(_,i)=>(
            <React.Fragment key={i}>
              <th style={{fontSize:9}}>Date</th>
              <th>PEP<br/>/5</th><th>EXP<br/>/10</th><th>PEA<br/>/5</th><th>Rec<br/>/5</th><th>Cnd<br/>/5</th>
            </React.Fragment>
          ))}
          {['PEP','EXP','PEA','Rec','Cnd'].map(f=><th key={f} style={{background:'#B45309',color:'#fff'}}>{f}</th>)}
        </tr>
      </thead>
      <tbody>
        {sheet.map((row,i)=>{
          const e=edits[row.student.id]||{};
          return (
            <tr key={row.student.id}>
              <td className="left t-row-num">{i+1}</td>
              <td className="left">
                <div className="t-student-name">{row.student.name}</div>
                <div className="t-student-meta"><span className="t-student-usn">{row.student.usn}</span></div>
              </td>
              {Array.from({length:weekCount},(_,wi)=>(
                <React.Fragment key={wi}>
                  <td style={{padding:'3px 2px'}}>
                    <input type="date" style={{width:108,fontSize:9.5,padding:'3px 4px',border:'1.5px solid var(--border)',borderRadius:'var(--r1)',background:'var(--surface)',outline:'none',fontFamily:"'JetBrains Mono',monospace"}}
                      value={e[`date_w${wi+1}`]??''} onChange={ev=>setMark(row.student.id,`date_w${wi+1}`,ev.target.value)}/>
                  </td>
                  {['pep','exp','pea','record','conduct'].map(f=>(
                    <td key={f}>
                      <input className="marks-input" type="number" min={0} max={f==='exp'?10:5} step="0.5"
                        value={e[`${f}_w${wi+1}`]??''} onChange={ev=>setMark(row.student.id,`${f}_w${wi+1}`,ev.target.value)} placeholder="—"/>
                    </td>
                  ))}
                </React.Fragment>
              ))}
              {['pep','exp','pea','record','conduct'].map(f=>(
                <td key={f} style={{background:'var(--amber-l)'}}>
                  <span className="avg-val">{liveAvg(e,f)??'—'}</span>
                </td>
              ))}
              <td><span className="cie-val">{row.record?.computed?.awcie??'—'}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── MENTORING ────────────────────────────────────────────────────────── */
function MentoringPage() {
  const [mentees,  setMentees]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(()=>{ api.get('/api/teacher/my-mentees').then(r=>setMentees(r.data)).finally(()=>setLoading(false)); },[]);

  const addMeeting=async()=>{
    if(!note.trim()||!selected) return;
    setSaving(true);
    try{
      await api.post('/api/teacher/mentoring/add-meeting',{studentId:selected.student._id,notes:note});
      toast.success('Meeting recorded'); setNote('');
      const r=await api.get('/api/teacher/my-mentees'); setMentees(r.data);
      setSelected(r.data.find(m=>m.student._id===selected.student._id)||null);
    }catch{toast.error('Failed');}
    finally{setSaving(false);}
  };

  if(loading) return <TLoader/>;

  return (
    <div className="t-page">
      <div>
        <h2 className="t-page-title">Mentoring</h2>
        <p className="t-page-sub">{mentees.length} mentees assigned</p>
      </div>
      <div className="t-mentoring-layout">
        <div>
          {mentees.length===0
            ? <Empty icon="👥" msg="No mentees assigned"/>
            : (
              <div className="t-mentee-list">
                {mentees.map(m=>(
                  <div key={m._id} className={`t-mentee-card${selected?.student._id===m.student._id?' t-mentee-card--active':''}`} onClick={()=>setSelected(m)}>
                    <div className="t-mentee-name">{m.student.name}</div>
                    <div className="t-mentee-usn">{m.student.usn}</div>
                    <div className="t-mentee-meta">Sem {m.student.semester} · Sec {m.student.section} · {m.mentoringBatch}</div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {selected&&(
          <div className="t-mentee-detail">
            <div className="card">
              <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:17,fontWeight:700,marginBottom:12}}>{selected.student.name}</h3>
              <div className="g2" style={{marginBottom:14}}>
                {[['USN',selected.student.usn],['Branch',selected.student.branch],['Semester',`Sem ${selected.student.semester}`],['Lab Batch',selected.student.labBatch]].map(([l,v])=>(
                  <div key={l} style={{padding:'10px 12px',background:'var(--surface2)',borderRadius:'var(--r2)',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:10,color:'var(--text3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{l}</div>
                    <div style={{fontWeight:600,fontSize:13}}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="divider"/>
              <h4 style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,margin:'12px 0 10px'}}>
                Meeting History
                <span style={{marginLeft:8,display:'inline-flex',alignItems:'center',justifyContent:'center',width:20,height:20,background:'var(--brand-ll)',color:'var(--brand-d)',borderRadius:10,fontSize:11,fontWeight:700}}>{selected.meetings?.length||0}</span>
              </h4>
              {!selected.meetings?.length&&<p style={{fontSize:12.5,color:'var(--text3)',marginBottom:12}}>No meetings yet.</p>}
              <div className="t-meeting-list">
                {selected.meetings?.map((m,i)=>(
                  <div key={i} className="t-meeting-item">
                    <div className="t-meeting-date"><Calendar size={10}/>{new Date(m.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
                    <p className="t-meeting-notes">{m.notes}</p>
                  </div>
                ))}
              </div>
              <div className="t-add-meeting" style={{marginTop:14}}>
                <input className="input" placeholder="Add meeting notes and press Save…" value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addMeeting()}/>
                <button className="btn btn-brand" onClick={addMeeting} disabled={saving||!note.trim()}>{saving?<Spinner/>:'Save'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SETTINGS ─────────────────────────────────────────────────────────── */
function TeacherSettings() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name:user?.name||'', email:user?.email||'', designation:user?.designation||'', phone:user?.phone||'' });
  const [saving, setSaving]   = useState(false);

  const saveProfile=async e=>{
    e.preventDefault(); setSaving(true);
    try{ const{data}=await api.put('/api/teacher/profile',profile); updateUser({...user,...data.user}); toast.success('Profile updated!'); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  return (
    <div className="t-settings">
      <div><h2 className="t-page-title">Settings</h2></div>

      <div className="card fade-up">
        <h3 style={{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:700,marginBottom:14}}>My Profile</h3>
        <form onSubmit={saveProfile} className="t-profile-form">
          <div className="g2">
            <div className="form-group"><label className="lbl">Full Name</label><input className="input" value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})} required/></div>
            <div className="form-group"><label className="lbl">Email</label><input className="input" type="email" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/></div>
          </div>
          <div className="g2">
            <div className="form-group"><label className="lbl">Designation</label>
              <select className="input" value={profile.designation} onChange={e=>setProfile({...profile,designation:e.target.value})}>
                {['Assistant Professor','Associate Professor','Professor','Senior Assistant Professor','HOD','Lab Instructor'].map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="lbl">Phone</label><input className="input" value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})} placeholder="10-digit mobile"/></div>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button className="btn btn-brand btn-sm" type="submit" disabled={saving}>{saving?<Spinner/>:'Save Profile'}</button>
            <span style={{fontSize:12,color:'var(--text3)'}}>Employee ID: <span className="mono">{user?.employeeId}</span> · {user?.department}</span>
          </div>
        </form>
      </div>

      <AccountSettings accent="var(--blue)" fields={[
        { label:'Employee ID', value:user?.employeeId, mono:true },
        { label:'Department',  value:user?.department },
        { label:'Designation', value:user?.designation },
      ]}/>
    </div>
  );
}

/* ── SHARED COMPONENTS ────────────────────────────────────────────────── */
function CellVal({ v, avg }) {
  if(v===null||v===undefined||v==='') return <span style={{color:'var(--text4)'}}>—</span>;
  if(v==='AB') return <span className="ab-badge">AB</span>;
  return avg ? <span className="avg-val">{v}</span> : <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>{v}</span>;
}
function n(v){ if(v===''||v===null||v===undefined) return null; const p=parseFloat(v); return isNaN(p)?null:p; }


/* ── MENTOR BULK ENTRY ────────────────────────────────────────────────── */
function MentorBulkEntry() {
  const { user } = useAuth();
  const [program,  setProgram]  = useState('B.Tech');
  const [semester, setSemester] = useState('6');
  const [data,     setData]     = useState(null);
  const [edits,    setEdits]    = useState({});
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/api/teacher/mentor-task', { params:{ program, semester } });
      setData(d);
      // Init edits from existing records
      const init = {};
      d.students.forEach(s => {
        init[s.id] = {
          activityPoints:  s.activityPoints ?? '',
          internshipMarks: s.internshipMarks ?? '',
          internshipTitle: s.internshipTitle || '',
          internshipStatus:s.internshipStatus || 'none',
          componentMarks:  Object.fromEntries((s.componentMarks||[]).map(cm=>[cm.key, cm.marks??'']))
        };
      });
      setEdits(init);
    } catch(err){ toast.error(err.response?.data?.message||'Failed to load'); }
    finally{ setLoading(false); }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const rows = (data?.students||[]).map(s => {
        const e = edits[s.id] || {};
        const task = data?.task;
        return {
          studentId:       s.id,
          activityPoints:  e.activityPoints !== '' ? Number(e.activityPoints) : null,
          internshipMarks: e.internshipMarks !== '' ? Number(e.internshipMarks) : null,
          internshipTitle: e.internshipTitle || '',
          internshipStatus:e.internshipStatus || 'none',
          componentMarks: (task?.components||[]).filter(c=>c.key!=='activityPoints').map(comp=>({
            key:     comp.key,
            label:   comp.label,
            maxMarks:comp.maxMarks,
            marks:   e.componentMarks?.[comp.key] !== '' && e.componentMarks?.[comp.key] !== undefined
                     ? Number(e.componentMarks[comp.key]) : null
          }))
        };
      });
      await api.post('/api/teacher/mentor-bulk-save', { program, semester, rows });
      toast.success(`Marks saved for ${rows.length} students!`);
      load();
    } catch(err){ toast.error(err.response?.data?.message||'Save failed'); }
    finally{ setSaving(false); }
  };

  const setField = (sid, field, val) => setEdits(p=>({...p,[sid]:{...p[sid],[field]:val}}));
  const setComp  = (sid, key, val) => setEdits(p=>({...p,[sid]:{...p[sid],componentMarks:{...(p[sid]?.componentMarks||{}),[key]:val}}}));

  const task     = data?.task;
  const students = data?.students || [];
  const sections = [...new Set(students.map(s=>String(s.section)))].sort();

  // Extra components beyond activityPoints
  const extraComps = (task?.components||[]).filter(c=>c.key!=='activityPoints');

  return (
    <div className="t-page">
      <div>
        <h2 className="t-page-title">Mentor Marks Entry</h2>
        <p className="t-page-sub">Fill Activity Points and configured components for your students</p>
      </div>

      {/* Selector */}
      <div className="card">
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-group">
            <label className="lbl">Program</label>
            <select className="input" value={program} onChange={e=>setProgram(e.target.value)} style={{width:140}}>
              {['B.Tech','M.Tech','MBA'].map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="lbl">Semester</label>
            <select className="input" value={semester} onChange={e=>setSemester(e.target.value)} style={{width:130}}>
              {['1','2','3','4','5','6','7','8'].map(s=><option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <button className="btn btn-brand btn-sm" onClick={load} disabled={loading}>
            {loading?<Spinner/>:'Load Students'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {!task && (
            <div className="alert alert-amber" style={{fontSize:12.5}}>
              ⚠ No mentor task configured for {program} Sem {semester} by admin yet.
              Activity Points column is always available. Contact admin to configure additional components (internship, upskilling etc).
            </div>
          )}

          {task && (
            <div className="alert alert-blue" style={{fontSize:12}}>
              <strong>Components for {program} Sem {semester}:</strong>{' '}
              {task.components.map(c=>`${c.label} (/${c.maxMarks})`).join(' · ')}
            </div>
          )}

          {students.length === 0 ? (
            <Empty icon="👥" msg="No students assigned to you for this program/semester" sub="Admin must assign you as mentor for a section"/>
          ) : (
            <>
              {/* Save button */}
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <button className="btn btn-mint" onClick={saveAll} disabled={saving} style={{gap:8}}>
                  {saving?<Spinner/>:<><CheckCircle size={14}/> Save All Marks</>}
                </button>
              </div>

              {/* Table */}
              {sections.map(sec=>{
                const secStudents = students.filter(s=>String(s.section)===sec);
                return (
                  <div key={sec} className="card" style={{padding:0,overflow:'hidden'}}>
                    <div style={{padding:'10px 16px',background:'linear-gradient(135deg,var(--navy),var(--navy3))',display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,color:'#fff'}}>
                        Section {sec}
                      </span>
                      <span className="a-count-badge" style={{background:'rgba(255,255,255,.15)',color:'#fff'}}>{secStudents.length}</span>
                    </div>
                    <div style={{overflowX:'auto'}}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Roll No</th>
                            <th style={{minWidth:180}}>Name</th>
                            <th className="center" style={{background:'var(--brand-ll)',color:'var(--brand-d)',minWidth:130}}>
                              Activity Points<br/>
                              <span style={{fontWeight:400,fontSize:10}}>This Sem · Running Total</span>
                            </th>
                            {extraComps.map(comp=>(
                              <th key={comp.key} className="center" style={{background:'var(--blue-l)',color:'var(--blue-d)',minWidth:110}}>
                                {comp.label}<br/><span style={{fontWeight:400,fontSize:10}}>/{comp.maxMarks}{comp.mandatory?'*':''}</span>
                              </th>
                            ))}
                            <th className="center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {secStudents.map((s,i)=>{
                            const e = edits[s.id] || {};
                            return (
                              <tr key={s.id} style={s.status==='Detained'?{background:'#FFF5F5'}:{}}>
                                <td style={{color:'var(--text3)',fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</td>
                                <td><span className="mono" style={{fontSize:11.5}}>{s.usn}</span></td>
                                <td style={{fontWeight:500}}>
                                  {s.name}
                                  {s.status==='Detained'&&<span className="tag tag-red" style={{fontSize:9,marginLeft:5}}>DETAINED</span>}
                                </td>
                                <td style={{background:'var(--brand-ll)',textAlign:'center',padding:'4px 6px'}}>
                                  <input className="marks-input" type="number" min={0} step={1}
                                    value={e.activityPoints??''}
                                    onChange={ev=>setField(s.id,'activityPoints',ev.target.value)}
                                    placeholder="—" style={{width:52}}/>
                                  <div style={{fontSize:10,marginTop:3,color:'var(--brand-d)',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>
                                    {(() => {
                                      const thisSem = Number(e.activityPoints)||0;
                                      const prevTotal = (s.totalActivityPoints||0) - (s.activityPoints||0);
                                      const newTotal = prevTotal + thisSem;
                                      return (
                                        <span style={{color: newTotal>=60?'var(--mint)':'var(--brand-d)'}}>
                                          Total: {newTotal}{newTotal>=60?' ✓':''}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </td>
                                {extraComps.map(comp=>(
                                  <td key={comp.key} style={{background:'var(--blue-l)',textAlign:'center'}}>
                                    <input className="marks-input" type="number" min={0} max={comp.maxMarks} step={1}
                                      value={e.componentMarks?.[comp.key]??''}
                                      onChange={ev=>setComp(s.id,comp.key,ev.target.value)}
                                      placeholder="—" style={{width:60}}/>
                                  </td>
                                ))}
                                <td className="center">
                                  {s.status!=='Detained' ? null : null}
                                  {!extraComps.length ? null : (
                                    <select style={{fontSize:11,padding:'3px 6px',border:'1px solid var(--border)',borderRadius:'var(--r1)',background:'var(--surface)'}}
                                      value={e.internshipStatus||'none'}
                                      onChange={ev=>setField(s.id,'internshipStatus',ev.target.value)}>
                                      <option value="none">—</option>
                                      <option value="completed">Done</option>
                                      <option value="ongoing">Ongoing</option>
                                    </select>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <button className="btn btn-mint" onClick={saveAll} disabled={saving} style={{gap:8}}>
                  {saving?<Spinner/>:<><CheckCircle size={14}/> Save All Marks</>}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── MENTOR MARKS PANEL ───────────────────────────────────────────────── */
function MentorMarksPanel({ selected, onSaved }) {
  const [form, setForm] = useState({
    activityPoints:   selected?.activityPoints   ?? '',
    internshipMarks:  selected?.internshipMarks  ?? '',
    internshipTitle:  selected?.internshipTitle  ?? '',
    internshipStatus: selected?.internshipStatus ?? 'none',
  });
  const [saving, setSaving] = useState(false);

  // Sync when selected changes
  React.useEffect(()=>{
    setForm({
      activityPoints:   selected?.activityPoints   ?? '',
      internshipMarks:  selected?.internshipMarks  ?? '',
      internshipTitle:  selected?.internshipTitle  ?? '',
      internshipStatus: selected?.internshipStatus ?? 'none',
    });
  },[selected?.student?.id]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/api/teacher/mentoring/mentor-marks', {
        studentId:        selected.student._id || selected.student.id,
        activityPoints:   form.activityPoints   !== '' ? Number(form.activityPoints)  : null,
        internshipMarks:  form.internshipMarks  !== '' ? Number(form.internshipMarks) : null,
        internshipTitle:  form.internshipTitle,
        internshipStatus: form.internshipStatus,
      });
      toast.success('Mentor marks saved!');
      onSaved({
        activityPoints:   data.record?.activityPoints,
        internshipMarks:  data.record?.internshipMarks,
        internshipTitle:  data.record?.internshipTitle,
        internshipStatus: data.record?.internshipStatus,
      });
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{background:'var(--surface2)',borderRadius:'var(--r2)',padding:'14px',border:'1px solid var(--border)'}}>
      <div className="g2" style={{gap:12,marginBottom:12}}>
        <div className="form-group">
          <label className="lbl">Activity Points <span style={{fontWeight:400,color:'var(--text3)'}}>(max 25)</span></label>
          <input className="input" type="number" min={0} max={25} step={1}
            placeholder="e.g. 20"
            value={form.activityPoints}
            onChange={e=>setForm({...form,activityPoints:e.target.value})}/>
        </div>
        <div className="form-group">
          <label className="lbl">Internship / Upskill Marks</label>
          <input className="input" type="number" min={0} max={25} step={1}
            placeholder="e.g. 25"
            value={form.internshipMarks}
            onChange={e=>setForm({...form,internshipMarks:e.target.value})}/>
        </div>
      </div>
      <div className="g2" style={{gap:12,marginBottom:12}}>
        <div className="form-group">
          <label className="lbl">Internship Title / Company</label>
          <input className="input" placeholder="e.g. IBM Internship — Web Dev"
            value={form.internshipTitle}
            onChange={e=>setForm({...form,internshipTitle:e.target.value})}/>
        </div>
        <div className="form-group">
          <label className="lbl">Internship Status</label>
          <select className="input" value={form.internshipStatus}
            onChange={e=>setForm({...form,internshipStatus:e.target.value})}>
            <option value="none">None / Not applicable</option>
            <option value="completed">Completed</option>
            <option value="ongoing">Ongoing</option>
          </select>
        </div>
      </div>
      <button className="btn btn-brand btn-sm" onClick={save} disabled={saving}>
        {saving?<Spinner/>:'Save Mentor Marks'}
      </button>
    </div>
  );
}


/* ── SLIP TESTS PAGE ─────────────────────────────────────────────────── */
function SlipTestsPage() {
  const [subjects, setSubjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get('/api/teacher/my-subjects').then(r => {
      const theory = r.data.filter(s => s.type === 'theory' || s.type === 'elective');
      setSubjects(theory);
      if (theory.length > 0) setSelected(theory[0]);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <TLoader/>;

  return (
    <div className="t-page">
      <div>
        <h2 className="t-page-title">Proctored Slip Tests</h2>
        <p className="t-page-sub">
          Create and manage proctored in-portal slip tests — scores push automatically to CIE
        </p>
      </div>

      {subjects.length === 0 ? (
        <Empty icon="🛡" msg="No theory subjects assigned" sub="Slip tests are for theory subjects only"/>
      ) : (
        <>
          {/* Subject selector */}
          <div className="t-subject-selector">
            {subjects.map(s => (
              <button key={s._id}
                className={`t-subject-pill t-subject-pill--theory${selected?._id===s._id?' t-subject-pill--active':''}`}
                onClick={() => setSelected(s)}>
                <div className="t-subject-pill__name">{s.name}</div>
                <div className="t-subject-pill__meta">{s.code} · Sem {s.semester}</div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="card" style={{padding:'20px 22px'}}>
              <SlipTestManager subject={selected}/>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TLoader(){ return <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:80}}><Spinner size="lg"/></div>; }

function DeadlineBadge({ deadline }) {
  const dl=new Date(deadline), now=new Date();
  const daysLeft=Math.ceil((dl-now)/(1000*60*60*24));
  if(daysLeft<0) return <span className="tag tag-red" style={{fontSize:10,marginLeft:8}}>⚠ Deadline passed</span>;
  if(daysLeft<=3) return <span className="tag tag-amber" style={{fontSize:10,marginLeft:8}}>⏰ {daysLeft===0?'Today':daysLeft+'d left'}</span>;
  return null;
}

function PublishBtn({ subjectId, subjectName }) {
  const [submitting, setSubmitting] = useState(false);
  const submit=async()=>{
    if(!window.confirm(`Publish marks for "${subjectName}"?\n\nStudents can see them immediately.`)) return;
    setSubmitting(true);
    try{ await api.post('/api/teacher/marks/submit',{subjectId}); toast.success('Marks published! Students can now see their CIE marks.'); }
    catch(err){ toast.error(err.response?.data?.message||'Submit failed'); }
    finally{ setSubmitting(false); }
  };
  return <button className="btn btn-mint btn-sm" onClick={submit} disabled={submitting}>{submitting?<Spinner/>:<><CheckCircle size={13}/> Publish Marks</>}</button>;
}

function UnpublishBtn({ subjectId, subjectName }) {
  const [loading, setLoading] = useState(false);
  const unpublish=async()=>{
    if(!window.confirm(`Recall marks for "${subjectName}"?\n\nStudents will no longer see their marks.`)) return;
    setLoading(true);
    try{ await api.post('/api/teacher/marks/unpublish',{subjectId}); toast.success('Marks recalled. Make corrections and re-publish.'); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setLoading(false); }
  };
  return <button className="btn btn-ghost btn-sm" onClick={unpublish} disabled={loading}>{loading?<Spinner/>:'Unpublish'}</button>;
}

function ConfigModal({ tab, cfgForm, setCfgForm, onSave, onClose, saving }) {
  const target = EXAM_MAX[tab] || null;

  // For either/or: only count ONE side of each pair toward total
  // e.g. Pair 1 has Q4A(4)+Q4B(3)=7 vs Q5A(4)+Q5B(3)=7 → counts as 7 (max of pair)
  const pairTotals = {};
  cfgForm.questions.forEach(q => {
    if (q.eitherOrPair && q.groupId) {
      const key = `${q.eitherOrPair}__${q.groupId}`;
      pairTotals[key] = (pairTotals[key]||0) + (Number(q.maxMarks)||0);
    }
  });
  const pairMaxes = {};
  Object.entries(pairTotals).forEach(([key, val]) => {
    const pair = key.split('__')[0];
    pairMaxes[pair] = Math.max(pairMaxes[pair]||0, val);
  });
  const pairedQNos = new Set(cfgForm.questions.filter(q=>q.eitherOrPair&&q.groupId).map(q=>q.qNo));
  const nonPairedTotal = cfgForm.questions
    .filter(q => !pairedQNos.has(q.qNo) || !q.eitherOrPair)
    .filter(q => !q.eitherOrPair)
    .reduce((s,q) => s+(Number(q.maxMarks)||0), 0);
  const total = nonPairedTotal + Object.values(pairMaxes).reduce((s,v)=>s+v,0);

  const isOver  = target && total > target;
  const isExact = target && total === target;

  const pairColors = { pair1:'#DBEAFE', pair2:'#EDE9FE', pair3:'#D1FAE5', pair4:'#FEF3C7' };
  const pairs = ['pair1','pair2','pair3','pair4'];

  const addRow = () => {
    const last = cfgForm.questions[cfgForm.questions.length-1];
    let next = '';
    if (last) {
      const m = last.qNo?.match(/^(\d+)([AB]?)$/);
      if (m) { const num=parseInt(m[1]); const part=m[2]; next=part==='A'?`${num}B`:part==='B'?`${num+1}`:`${num+1}`; }
    } else next = '1';
    setCfgForm(f=>({...f, questions:[...f.questions, {qNo:next,coNo:'CO1',maxMarks:'',eitherOrPair:'',groupId:''}]}));
  };
  const updateQ = (i,field,val) => {
    const qs=[...cfgForm.questions]; qs[i]={...qs[i],[field]:val}; setCfgForm({questions:qs});
  };
  const removeQ = i => setCfgForm(f=>({...f, questions:f.questions.filter((_,j)=>j!==i)}));

  // When pair changes, auto-set groupId based on qNo prefix
  const setPair = (i, pair) => {
    const qs=[...cfgForm.questions];
    const qNo = qs[i].qNo || '';
    // groupId = the parent question number (e.g. "4" for "4A", "4B")
    const m = qNo.match(/^(\d+)/);
    const gid = m ? m[1] : qNo;
    qs[i] = {...qs[i], eitherOrPair: pair, groupId: pair ? gid : ''};
    setCfgForm({questions:qs});
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div className="alert alert-blue" style={{fontSize:12}}>
        <div>
          <strong>Either/Or questions:</strong> For Q4 OR Q5 — set both Q4A & Q4B to <strong>Pair 1, Group Q4</strong>
          and both Q5A & Q5B to <strong>Pair 1, Group Q5</strong>.
          System auto-picks the higher scoring group. Only the higher counts toward total.
        </div>
      </div>
      <div style={{border:'1px solid var(--border)',borderRadius:'var(--r2)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead>
            <tr style={{background:'linear-gradient(135deg,var(--brand-d),var(--brand))'}}>
              <th style={{padding:'8px 10px',color:'#fff',textAlign:'left',fontSize:11,fontWeight:700,width:70}}>Q No.</th>
              <th style={{padding:'8px 10px',color:'#fff',textAlign:'left',fontSize:11,fontWeight:700,width:80}}>CO</th>
              <th style={{padding:'8px 10px',color:'#fff',textAlign:'center',fontSize:11,fontWeight:700,width:85}}>Max Marks</th>
              <th style={{padding:'8px 10px',color:'#fff',textAlign:'center',fontSize:11,fontWeight:700,width:100}} title="Which Either/Or pair this question belongs to">Either/Or Pair</th>
              <th style={{padding:'8px 10px',color:'#fff',textAlign:'center',fontSize:11,fontWeight:700,width:100}} title="Which group within the pair (e.g. Q4 group vs Q5 group)">Group (Q No.)</th>
              <th style={{width:32}}/>
            </tr>
          </thead>
          <tbody>
            {cfgForm.questions.length===0 && (
              <tr><td colSpan={6} style={{padding:24,textAlign:'center',color:'var(--text3)',fontSize:12}}>
                No questions yet. Add one below.
              </td></tr>
            )}
            {cfgForm.questions.map((q,i)=>(
              <tr key={i} style={{
                borderTop:'1px solid var(--border)',
                background: q.eitherOrPair ? (pairColors[q.eitherOrPair]||'#f9f9f9')+'99' : i%2===0?'var(--surface)':'var(--surface2)'
              }}>
                <td style={{padding:'5px 8px'}}>
                  <input className="marks-input" style={{width:60,textAlign:'left',fontFamily:"'JetBrains Mono',monospace"}}
                    placeholder="1, 4A…" value={q.qNo}
                    onChange={e=>{
                      updateQ(i,'qNo',e.target.value);
                      // Auto-update groupId if pair is set
                      if(q.eitherOrPair){
                        const m=e.target.value.match(/^(\d+)/);
                        if(m) updateQ(i,'groupId',m[1]);
                      }
                    }}/>
                </td>
                <td style={{padding:'5px 8px'}}>
                  <select className="input" style={{padding:'4px 6px',fontSize:12,height:32}} value={q.coNo} onChange={e=>updateQ(i,'coNo',e.target.value)}>
                    {['CO1','CO2','CO3','CO4','CO5','CO6'].map(co=><option key={co}>{co}</option>)}
                  </select>
                </td>
                <td style={{padding:'5px 8px',textAlign:'center'}}>
                  <input className="marks-input" type="number" min="0" step="0.5" placeholder="0"
                    value={q.maxMarks} onChange={e=>updateQ(i,'maxMarks',e.target.value===''?'':Number(e.target.value))} style={{width:60}}/>
                </td>
                <td style={{padding:'5px 8px',textAlign:'center'}}>
                  <select className="input" style={{padding:'4px 6px',fontSize:12,height:32}}
                    value={q.eitherOrPair||''} onChange={e=>setPair(i,e.target.value)}>
                    <option value="">None (normal)</option>
                    <option value="pair1">Pair 1</option>
                    <option value="pair2">Pair 2</option>
                    <option value="pair3">Pair 3</option>
                    <option value="pair4">Pair 4</option>
                  </select>
                </td>
                <td style={{padding:'5px 8px',textAlign:'center'}}>
                  {q.eitherOrPair ? (
                    <input className="input" style={{width:80,padding:'4px 6px',fontSize:12,textAlign:'center',fontFamily:"'JetBrains Mono',monospace"}}
                      placeholder="e.g. 4" value={q.groupId||''}
                      onChange={e=>updateQ(i,'groupId',e.target.value)}
                      title="Parent question number — all sub-parts of Q4 (4A, 4B) share groupId '4'"/>
                  ) : <span style={{color:'var(--text4)'}}>—</span>}
                </td>
                <td style={{padding:'5px 4px',textAlign:'center'}}>
                  <button className="btn btn-ghost btn-xs" style={{color:'var(--red)'}} onClick={()=>removeQ(i)}><Trash2 size={12}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pair summary — show what each pair looks like */}
      {Object.keys(pairMaxes).length > 0 && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {Object.entries(pairMaxes).map(([pair,maxVal])=>{
            const groups = [...new Set(cfgForm.questions.filter(q=>q.eitherOrPair===pair).map(q=>q.groupId))];
            return (
              <div key={pair} style={{padding:'7px 12px',borderRadius:'var(--r2)',background:pairColors[pair]||'#f3f4f6',border:'1px solid #ccc',fontSize:12}}>
                <strong>{pair.replace('pair','Pair ')}:</strong>{' '}
                {groups.map(g=>{
                  const gTotal=cfgForm.questions.filter(q=>q.eitherOrPair===pair&&q.groupId===g).reduce((s,q)=>s+(Number(q.maxMarks)||0),0);
                  return `Q${g}(${gTotal}mk)`;
                }).join(' OR ')}
                {' '}→ system picks higher
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-start'}} onClick={addRow}><Plus size={12}/> Add Question</button>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:'var(--r2)',
        background:isOver?'var(--red-l)':isExact?'var(--mint-l)':'var(--brand-l)',
        border:`1px solid ${isOver?'#FECACA':isExact?'#A7F3D0':'#FFD0BC'}`}}>
        <div>
          <span style={{fontSize:13,fontWeight:600}}>
            Effective Total:{' '}
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,color:isOver?'var(--red)':isExact?'var(--mint)':'var(--brand)'}}>{total}</span>
            {target && <span style={{color:'var(--text3)',fontWeight:400}}> / {target}</span>}
          </span>
          {Object.keys(pairMaxes).length>0 && (
            <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>
              Either/or pairs count as max of each pair — not the sum of all sides
            </div>
          )}
        </div>
        <span style={{fontSize:12}}>
          {isOver  && <span style={{color:'var(--red)',fontWeight:700}}>⚠ Over by {total-target}</span>}
          {isExact && <span style={{color:'var(--mint)',fontWeight:700}}>✓ Perfect</span>}
          {!isOver && !isExact && target && <span style={{color:'var(--brand)'}}>{target-total} remaining</span>}
        </span>
      </div>
      <div style={{display:'flex',gap:10}}>
        <button className="btn btn-brand" onClick={onSave} disabled={saving||isOver||!cfgForm.questions.length}>
          {saving?<Spinner/>:'Save Configuration'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function COAttainmentModal({ open, onClose, subject }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(()=>{
    if(!open||!subject?._id) return;
    setLoading(true);
    api.get('/api/teacher/co-attainment',{params:{subjectId:subject._id}}).then(r=>setData(r.data)).catch(err=>toast.error(err.response?.data?.message||'Failed')).finally(()=>setLoading(false));
  },[open,subject?._id]);
  const lc=l=>l>=3?'var(--mint)':l>=2?'var(--brand)':l>=1?'var(--amber)':'var(--red)';
  const ll=l=>l>=3?'Level 3 — High':l>=2?'Level 2 — Medium':l>=1?'Level 1 — Low':'Not Attained';

  return (
    <Modal open={open} onClose={onClose} title={`CO Attainment — ${subject?.name||''}`} width={680}>
      {loading?<div style={{textAlign:'center',padding:40}}><Spinner size="lg"/></div>:!data?null:(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="alert alert-blue" style={{fontSize:12}}>
            <strong>{data.subject?.name} ({data.subject?.code})</strong> · Sem {data.subject?.semester} · {data.studentCount} students · Threshold: {data.threshold}
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderRadius:'var(--r2)',background:data.overallAttainment>=60?'var(--mint-l)':'var(--red-l)',border:`1px solid ${data.overallAttainment>=60?'#A7F3D0':'#FECACA'}`}}>
            <span style={{fontWeight:600,fontSize:14}}>Overall CO Attainment</span>
            <span style={{fontFamily:"'Outfit',sans-serif",fontSize:28,fontWeight:800,color:data.overallAttainment>=60?'var(--mint)':'var(--red)'}}>{data.overallAttainment}%</span>
          </div>
          {Object.values(data.attainment).length===0
            ? <div className="alert alert-amber" style={{fontSize:12}}>No published marks found. Publish marks first.</div>
            : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {Object.values(data.attainment).map(co=>(
                  <div key={co.co} style={{border:'1px solid var(--border)',borderRadius:'var(--r2)',padding:'12px 14px',borderLeft:`4px solid ${lc(co.level)}`}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15}}>{co.co}</span>
                        <span style={{fontSize:11,color:'var(--text2)'}}>Max {co.maxMarks} · Target ≥{co.targetScore}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:11,fontWeight:700,color:lc(co.level),background:lc(co.level)+'15',padding:'2px 10px',borderRadius:20}}>{ll(co.level)}</span>
                        <span style={{fontFamily:"'Outfit',sans-serif",fontSize:22,fontWeight:800,color:lc(co.level)}}>{co.attainmentPct}%</span>
                      </div>
                    </div>
                    <div style={{height:6,borderRadius:3,background:'var(--border)'}}><div style={{height:'100%',borderRadius:3,width:`${co.attainmentPct}%`,background:lc(co.level),transition:'width .6s ease'}}/></div>
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{co.attainedCount} of {co.totalStudents} students attained</div>
                  </div>
                ))}
              </div>
            )
          }
          <div style={{background:'var(--surface2)',borderRadius:'var(--r1)',padding:'10px 14px',fontSize:11,color:'var(--text2)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <span><strong>NBA:</strong> L3≥70% · L2≥60% · L1≥50% · Not Attained&lt;50%</span>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>{
                const wb=XLSX.utils.book_new();
                const rows=[['CO','Max Marks','Target','Attained','Total','Attainment%','Level','Status']];
                Object.values(data.attainment).forEach(co=>rows.push([co.co,co.maxMarks,co.targetScore,co.attainedCount,co.totalStudents,co.attainmentPct+'%','Level '+co.level,co.status]));
                rows.push([]);rows.push(['Subject',data.subject?.name,'Code',data.subject?.code,'Students',data.studentCount,'Overall',data.overallAttainment+'%']);
                const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=rows[0].map(()=>({wch:18}));XLSX.utils.book_append_sheet(wb,ws,'CO Attainment');XLSX.writeFile(wb,`CO_Attainment_${data.subject?.code}.xlsx`);
              }}><Download size={12}/> Excel</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>{
                const{jsPDF}=require('jspdf');const doc=new jsPDF();const sub=data.subject;
                doc.setFontSize(16);doc.setFont('helvetica','bold');doc.text('CO Attainment Report',14,18);
                doc.setFontSize(10);doc.setFont('helvetica','normal');
                doc.text(`Subject: ${sub?.name} (${sub?.code})  |  Semester: ${sub?.semester}  |  Students: ${data.studentCount}`,14,26);
                doc.text(`Threshold: ${data.threshold}  |  Overall: ${data.overallAttainment}%`,14,32);
                let y=46;const cols=[14,38,66,94,122,152,176];const heads=['CO','Max','Target','Attained','Total','Att%','Status'];
                doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setFillColor(255,107,53);doc.rect(12,y-5,186,8,'F');doc.setTextColor(255,255,255);heads.forEach((h,i)=>doc.text(h,cols[i],y));
                doc.setTextColor(0,0,0);doc.setFont('helvetica','normal');y+=8;
                Object.values(data.attainment).forEach((co,idx)=>{if(idx%2===0){doc.setFillColor(248,249,250);doc.rect(12,y-5,186,8,'F');}const vals=[co.co,co.maxMarks,co.targetScore,co.attainedCount,co.totalStudents,co.attainmentPct+'%',co.status];vals.forEach((v,i)=>doc.text(String(v),cols[i],y));y+=8;});
                y+=5;doc.setFont('helvetica','italic');doc.setFontSize(8);doc.setTextColor(100,100,100);doc.text('NBA: L3≥70% · L2≥60% · L1≥50%',14,y);doc.text(`Generated: ${new Date().toLocaleDateString()} | EvalPro v2`,14,y+5);
                doc.save(`CO_Attainment_${sub?.code}.pdf`);
              }}><Download size={12}/> PDF</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ExcelUploadModal({ open, onClose, subject, tab, onUploaded }) {
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef();

  const dlTemplate=async()=>{
    try{
      const resp=await api.get('/api/teacher/marks-template',{params:{subjectId:subject._id,examType:tab},responseType:'blob'});
      const url=window.URL.createObjectURL(new Blob([resp.data]));const a=document.createElement('a');a.href=url;a.download=`${subject.code}_${tab}_template.xlsx`;a.click();window.URL.revokeObjectURL(url);
    }catch{toast.error('Failed to download template');}
  };
  const upload=async()=>{
    if(!file){toast.error('Select a file');return;}
    setUploading(true);
    try{
      const fd=new FormData();fd.append('file',file);fd.append('subjectId',subject._id);fd.append('examType',tab);
      const{data}=await api.post('/api/teacher/marks-upload',fd,{headers:{'Content-Type':'multipart/form-data'}});
      toast.success(data.message);if(data.errorDetails?.length)data.errorDetails.forEach(e=>toast.error(e,{duration:5000}));
      setFile(null);onUploaded();onClose();
    }catch(err){toast.error(err.response?.data?.message||'Upload failed');}
    finally{setUploading(false);}
  };

  return (
    <Modal open={open} onClose={onClose} title={`Upload ${tab} Marks from Excel`}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div className="alert alert-blue" style={{fontSize:12}}>
          <strong>Step 1</strong> — Download the template with your student list and question columns<br/>
          <strong>Step 2</strong> — Fill marks in Excel<br/>
          <strong>Step 3</strong> — Upload here
        </div>
        <button className="btn btn-white" onClick={dlTemplate}><Download size={13}/> Download Template for {tab}</button>
        <div className="divider"/>
        <div className="form-group">
          <label className="lbl">Upload Filled File</label>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>setFile(e.target.files[0])}/>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button className="btn btn-white btn-sm" onClick={()=>fileRef.current.click()}><Upload size={12}/> {file?file.name.slice(0,35):'Choose file'}</button>
            {file&&<button className="btn btn-ghost btn-xs" style={{color:'var(--red)'}} onClick={()=>setFile(null)}>✕</button>}
          </div>
        </div>
        <div className="alert alert-amber" style={{fontSize:11}}>⚠ Uploading overwrites existing marks for students in the file.</div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-brand" onClick={upload} disabled={uploading||!file}>{uploading?<Spinner/>:<><Upload size={13}/> Upload & Save</>}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
