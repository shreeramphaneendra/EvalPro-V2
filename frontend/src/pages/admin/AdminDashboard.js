import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { Layout, Modal, Empty, Spinner } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { PROGRAM_KEYS, semestersFor } from '../../constants/programs';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap,
  Plus, Trash2, Edit2, Upload, Download, Search,
  UserCheck, Settings, TrendingUp, FileText,
  AlertTriangle, ArrowLeftRight, CheckCircle, KeyRound, X
} from 'lucide-react';
import AccountSettings from '../../components/AccountSettings';
import ElectivesAdmin from './ElectivesAdmin';

const NAV = [
  { type:'section', label:'Main' },
  { path:'/admin',           label:'Overview',           icon:<LayoutDashboard size={15}/> },
  { type:'section', label:'Management' },
  { path:'/admin/teachers',  label:'Teachers',           icon:<BookOpen size={15}/> },
  { path:'/admin/students',  label:'Students',           icon:<GraduationCap size={15}/> },
  { path:'/admin/subjects',  label:'Subjects',           icon:<Users size={15}/> },
  { path:'/admin/mentoring', label:'Mentoring',          icon:<UserCheck size={15}/> },
  { type:'section', label:'Lifecycle' },
  { path:'/admin/promotion', label:'Promotion',          icon:<TrendingUp size={15}/> },
  { path:'/admin/supplies',  label:'Supplies & Status',  icon:<AlertTriangle size={15}/> },
  { type:'section', label:'Reports' },
  { path:'/admin/consolidated',  label:'Consolidated CIE',  icon:<FileText size={15}/> },
  { path:'/admin/student-list',  label:'Student List',       icon:<GraduationCap size={15}/> },
  { type:'section', label:'Mentor' },
  { path:'/admin/mentor-task',   label:'Mentor Tasks',        icon:<UserCheck size={15}/> },
  { type:'section', label:'Electives' },
  { path:'/admin/electives',     label:'Elective Groups',     icon:<BookOpen size={15}/> },
  { type:'section', label:'Account' },
  { path:'/admin/teaching',  label:'Switch to Teaching', icon:<ArrowLeftRight size={15}/>, switchTo:'/teacher' },
  { type:'section', label:'AI Insights' },
  { path:'/admin/ai',       label:'AI Insights',        icon:<span style={{fontSize:14}}>✦</span> },
  { path:'/admin/settings',  label:'Settings',           icon:<Settings size={15}/> },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  return (
    <Layout nav={NAV} title="Admin Dashboard" subtitle={`${user?.department} Department · ${user?.college || "CBIT"}`}>
      <Routes>
        <Route path="/"         element={<AdminOverview/>}/>
        <Route path="/teachers" element={<TeachersPage/>}/>
        <Route path="/students" element={<StudentsPage/>}/>
        <Route path="/subjects" element={<SubjectsPage/>}/>
        <Route path="/mentoring"element={<MentoringPage/>}/>
        <Route path="/promotion"element={<PromotionPage/>}/>
        <Route path="/supplies" element={<SuppliesPage/>}/>
        <Route path="/ai"       element={<AIInsightsPage/>}/>
        <Route path="/consolidated"  element={<ConsolidatedCIEPage/>}/>
        <Route path="/student-list"  element={<StudentListPage/>}/>
        <Route path="/mentor-task"   element={<MentorTaskPage/>}/>
        <Route path="/electives"     element={<ElectivesAdmin user={user}/>}/>
        <Route path="/settings" element={<SettingsPage/>}/>
      </Routes>
    </Layout>
  );
}

/* ── OVERVIEW ─────────────────────────────────────────────────────────── */
function Overview() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/admin/hod-overview')
      .then(r => setData(r.data))
      .catch(() => api.get('/api/admin/stats').then(r => setData({
        students:{ total:r.data.students, active:r.data.students, detained:0, pendingClearance:0 },
        teachers:{ total:r.data.teachers },
        subjects:{ total:r.data.subjects, published:0, inProgress:0, notStarted:r.data.subjects },
        subjectStatus:[], atRisk:[], deadlineAlerts:[], academicYear:'2025-26'
      })).catch(()=>{}))
      .finally(()=>setLoading(false));
  },[]);

  if (loading) return <AdminLoader/>;
  if (!data)   return null;

  const statCards = [
    { val:data.students?.total||0,    lbl:'Students',     sub:`${data.students?.active||0} active`,   color:'var(--brand)',  bg:'var(--brand-l)',  icon:'🎓' },
    { val:data.teachers?.total||0,    lbl:'Teachers',     sub:'faculty assigned',                     color:'var(--blue)',   bg:'var(--blue-l)',   icon:'📚' },
    { val:data.subjects?.published||0,lbl:'Published',    sub:'marks visible to students',            color:'var(--mint)',   bg:'var(--mint-l)',   icon:'✅' },
    { val:data.students?.detained||0, lbl:'Detained',     sub:'attendance below threshold',           color:'var(--red)',    bg:'var(--red-l)',    icon:'⚠️' },
  ];

  return (
    <div className="a-page">
      {/* Deadline alerts */}
      {data.deadlineAlerts?.length > 0 && (
        <div className="a-alert a-alert--red fade-up">
          <AlertTriangle size={15}/>
          <span>
            <strong>{data.deadlineAlerts.length} subject{data.deadlineAlerts.length>1?'s':''}</strong> with
            deadline issues: {data.deadlineAlerts.map(s=>s.name).join(', ')}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="a-stats fade-up">
        {statCards.map(s => (
          <div key={s.lbl} className="a-stat">
            <div className="a-stat__icon" style={{background:s.bg}}>
              <span style={{fontSize:22}}>{s.icon}</span>
            </div>
            <div className="a-stat__body">
              <div className="a-stat__val" style={{color:s.color}}>{s.val}</div>
              <div className="a-stat__lbl">{s.lbl}</div>
              <div className="a-stat__sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="a-two-col fade-up2">
        {/* Student status */}
        <div className="a-card">
          <h3 className="a-card__title">Student Status</h3>
          <div className="a-status-rows">
            {[
              { lbl:'Active',            val:data.students?.active||0,          color:'var(--mint)' },
              { lbl:'Detained',          val:data.students?.detained||0,        color:'var(--red)'  },
              { lbl:'Pending Clearance', val:data.students?.pendingClearance||0,color:'var(--amber)'},
            ].map(s => (
              <div key={s.lbl} className="a-status-row">
                <span className="a-status-row__lbl">{s.lbl}</span>
                <span className="a-status-row__val" style={{color:s.color}}>{s.val}</span>
              </div>
            ))}
            <div className="a-divider"/>
            <div className="a-status-row">
              <span style={{fontWeight:600,fontSize:13}}>Total</span>
              <span className="a-status-row__val">{data.students?.total||0}</span>
            </div>
          </div>
        </div>

        {/* CIE status */}
        <div className="a-card">
          <h3 className="a-card__title">CIE Entry Status · {data.academicYear}</h3>
          {data.subjectStatus?.length === 0
            ? <Empty icon="📋" msg="No subjects yet" sub="Create subjects to track status"/>
            : (
              <div className="a-subject-status-list">
                {data.subjectStatus.slice(0,8).map(s => (
                  <div key={s.id} className={`a-subject-chip a-subject-chip--${s.status}${s.deadlinePassed?' a-subject-chip--danger':s.deadlineSoon?' a-subject-chip--warn':''}`}>
                    <span className="a-subject-chip__name">{s.name}</span>
                    <span className={`a-status-dot a-status-dot--${s.status}`}/>
                  </div>
                ))}
                {data.subjectStatus.length > 8 && (
                  <span className="a-subject-chip__more">+{data.subjectStatus.length-8} more</span>
                )}
              </div>
            )
          }
        </div>
      </div>

      {/* Detention risk */}
      {data.atRisk?.length > 0 && (
        <div className="a-card fade-up3">
          <div className="a-card__hdr">
            <h3 className="a-card__title">
              Detention Risk
              <span className="a-count-badge a-count-badge--red">{data.atRisk.length}</span>
            </h3>
            <span className="a-card__sub">Students with attendance below 70%</span>
          </div>
          <div className="a-table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>USN</th><th>Name</th>
                  <th className="center">Sec</th><th>Subject</th>
                  <th className="center">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.slice(0,12).map((r,i)=>(
                  <tr key={i}>
                    <td><span className="mono" style={{fontSize:11}}>{r.student?.usn}</span></td>
                    <td style={{fontWeight:500}}>{r.student?.name}</td>
                    <td className="center"><span className="tag tag-gray">{r.student?.section}</span></td>
                    <td style={{fontSize:12.5}}>{r.subject?.name}</td>
                    <td className="center">
                      <span className="a-att-badge" style={{
                        color: r.attendance<60?'var(--red)':'var(--amber)',
                        background: r.attendance<60?'var(--red-l)':'var(--amber-l)',
                        border:`1px solid ${r.attendance<60?'#FECACA':'#FDE68A'}`
                      }}>{r.attendance}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.atRisk.length > 12 && (
            <p className="a-table-more">+{data.atRisk.length-12} more · check Supplies & Status page</p>
          )}
        </div>
      )}

      {!data.subjects?.total && (
        <div className="a-card a-card--onboard">
          <div className="a-onboard-steps">
            {['Add teachers','Create subjects','Assign teachers to sections','Import students','Assign mentors'].map((step,i)=>(
              <div key={step} className="a-onboard-step">
                <div className="a-onboard-num">{i+1}</div>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ── ADMIN OVERVIEW — uses only proven working endpoints ──────────────── */
function AdminOverview() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/students').catch(()=>({ data:[] })),
      api.get('/api/admin/teachers').catch(()=>({ data:[] })),
      api.get('/api/admin/subjects').catch(()=>({ data:[] })),
    ]).then(([s,t,sub]) => {
      setStudents(s.data);
      setTeachers(t.data);
      setSubjects(sub.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLoader/>;

  const detained = students.filter(s => s.status === 'Detained').length;
  const supplies = students.filter(s => (s.supplies||[]).some(x=>!x.cleared)).length;
  const activeStudents = students.filter(s => s.status === 'Active').length;

  const statCards = [
    { val:students.length, lbl:'Total Students', sub:`${activeStudents} active`,  color:'var(--brand)',  bg:'var(--brand-l)',  icon:'🎓', path:'/admin/students' },
    { val:teachers.length, lbl:'Teachers',        sub:'faculty',                  color:'var(--blue)',   bg:'var(--blue-l)',   icon:'📚', path:'/admin/teachers' },
    { val:subjects.length, lbl:'Subjects',         sub:'configured',               color:'var(--violet)', bg:'var(--violet-l)', icon:'📋', path:'/admin/subjects' },
    { val:detained,        lbl:'Detained',          sub:'attendance <70%',          color:'var(--red)',    bg:'var(--red-l)',    icon:'⚠️', path:'/admin/supplies' },
  ];

  return (
    <div className="a-page">
      <div>
        <h2 className="a-page-title">Department Overview</h2>
        <p className="a-page-sub">
          {user?.department} · {user?.college || 'CBIT'} ·{' '}
          {new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
        </p>
      </div>

      {/* Stat cards */}
      <div className="a-stats fade-up">
        {statCards.map(s => (
          <div key={s.lbl} className="a-stat" onClick={()=>nav(s.path)} style={{cursor:'pointer'}}>
            <div className="a-stat__icon" style={{background:s.bg}}>
              <span style={{fontSize:22}}>{s.icon}</span>
            </div>
            <div className="a-stat__body">
              <div className="a-stat__val" style={{color:s.color}}>{s.val}</div>
              <div className="a-stat__lbl">{s.lbl}</div>
              <div className="a-stat__sub">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="a-two-col fade-up2">
        {/* Student status */}
        <div className="a-card">
          <h3 className="a-card__title" style={{marginBottom:14}}>Student Status</h3>
          <div className="a-status-rows">
            {[
              { lbl:'Active',            val:activeStudents,                     color:'var(--mint)' },
              { lbl:'Detained',          val:detained,                           color:'var(--red)'  },
              { lbl:'Pending Clearance', val:students.filter(s=>s.status==='PendingClearance').length, color:'var(--amber)' },
              { lbl:'With Supplies',     val:supplies,                           color:'var(--brand)'},
            ].map(s => (
              <div key={s.lbl} className="a-status-row">
                <span className="a-status-row__lbl">{s.lbl}</span>
                <span className="a-status-row__val" style={{color:s.color,fontSize:18}}>{s.val}</span>
              </div>
            ))}
            <div className="a-divider"/>
            <div className="a-status-row">
              <span style={{fontWeight:600,fontSize:13}}>Total</span>
              <span className="a-status-row__val" style={{fontSize:18}}>{students.length}</span>
            </div>
          </div>
        </div>

        {/* Subjects */}
        <div className="a-card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <h3 className="a-card__title">Subjects</h3>
            <button className="btn btn-brand btn-sm" onClick={()=>nav('/admin/subjects')}>Manage →</button>
          </div>
          {subjects.length === 0
            ? <Empty icon="📋" msg="No subjects yet" sub="Add subjects to get started"/>
            : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {subjects.slice(0,6).map(s => (
                  <div key={s._id} style={{
                    display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'9px 12px',background:'var(--surface2)',
                    borderRadius:'var(--r2)',border:'1px solid var(--border)'
                  }}>
                    <div>
                      <span style={{fontWeight:600,fontSize:13}}>{s.name}</span>
                      <span className="mono" style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>{s.code}</span>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <span className="tag tag-orange" style={{fontSize:10}}>Sem {s.semester}</span>
                      <span className={`tag tag-${s.type==='lab'?'blue':'orange'}`} style={{fontSize:10}}>{s.type}</span>
                    </div>
                  </div>
                ))}
                {subjects.length > 6 && (
                  <p style={{fontSize:12,color:'var(--text3)',textAlign:'center'}}>+{subjects.length-6} more</p>
                )}
              </div>
            )
          }
        </div>
      </div>

      {/* Quick actions */}
      <div className="a-card fade-up3">
        <h3 className="a-card__title" style={{marginBottom:14}}>Quick Actions</h3>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {[
            { label:'Add Teacher',     path:'/admin/teachers',  icon:'👤' },
            { label:'Add Subject',     path:'/admin/subjects',  icon:'📚' },
            { label:'Import Students', path:'/admin/students',  icon:'📥' },
            { label:'Assign Mentors',  path:'/admin/mentoring', icon:'🎓' },
            { label:'Promotion',       path:'/admin/promotion', icon:'⬆️' },
            { label:'AI Insights',     path:'/admin/ai',        icon:'✦'  },
          ].map(a => (
            <button key={a.label} className="btn btn-white" onClick={()=>nav(a.path)}
              style={{gap:8}}>
              <span>{a.icon}</span> {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── TEACHERS PAGE ────────────────────────────────────────────────────── */
function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ name:'', employeeId:'', email:'', designation:'Assistant Professor', phone:'' });
  const { user } = useAuth();

  const load = () => { setLoading(true); api.get('/api/admin/teachers').then(r=>setTeachers(r.data)).finally(()=>setLoading(false)); };
  useEffect(load,[]);

  const set = e => setForm({...form,[e.target.name]:e.target.value});
  const save = async e => {
    e.preventDefault(); setSaving(true);
    try { await api.post('/api/admin/teachers', form); toast.success('Teacher added'); setModal(false); setForm({name:'',employeeId:'',email:'',designation:'Assistant Professor',phone:''}); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };
  const del = async id => {
    if(!window.confirm('Delete this teacher? This cannot be undone.')) return;
    try{ await api.delete(`/api/admin/teachers/${id}`); toast.success('Deleted'); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };
  const resetPw = async (t) => {
    if(!window.confirm(`Reset ${t.name}'s password to Employee ID (${t.employeeId})?`)) return;
    try{ await api.post(`/api/admin/teachers/${t._id}/reset-password`); toast.success(`Password reset to ${t.employeeId}`); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Teachers</h2>
          <p className="a-page-sub">{teachers.length} faculty members in {user?.department} department</p>
        </div>
        <button className="btn btn-brand" onClick={()=>setModal(true)}><Plus size={14}/> Add Teacher</button>
      </div>

      <div className="a-card a-card--table">
        {loading ? <AdminLoader inline/> : teachers.length===0 ? <Empty icon="📚" msg="No teachers yet" sub="Add your first teacher"/> : (
          <div className="a-table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>#</th><th>Name</th><th>Employee ID</th>
                <th>Email</th><th>Designation</th><th className="center">Actions</th>
              </tr></thead>
              <tbody>
                {teachers.map((t,i)=>(
                  <tr key={t._id}>
                    <td className="a-row-num">{i+1}</td>
                    <td>
                      <div className="a-person">
                        <div className="a-person-avatar">{t.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>
                        <div>
                          <div style={{fontWeight:600,fontSize:13.5}}>{t.name}</div>
                          {t.isAdmin && <span className="tag tag-orange" style={{fontSize:9}}>Admin</span>}
                        </div>
                      </div>
                    </td>
                    <td><span className="mono" style={{fontSize:12}}>{t.employeeId}</span></td>
                    <td style={{fontSize:12.5,color:'var(--text2)'}}>{t.email}</td>
                    <td style={{fontSize:12}}>{t.designation||'—'}</td>
                    <td className="center">
                      <div className="a-actions">
                        <button className="a-action-btn" title={`Reset password to ${t.employeeId}`} onClick={()=>resetPw(t)}><KeyRound size={13}/></button>
                        <button className="a-action-btn a-action-btn--danger" onClick={()=>del(t._id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Add Teacher">
        <form onSubmit={save} className="a-form">
          <div className="a-form-row">
            <AField label="Full Name *"><input className="input" name="name" placeholder="Dr. Anitha Rao" value={form.name} onChange={set} required/></AField>
            <AField label="Employee ID *"><input className="input" name="employeeId" placeholder="EMP042" value={form.employeeId} onChange={set} required/></AField>
          </div>
          <AField label="Email *"><input className="input" name="email" type="email" placeholder="anitha@cbit.ac.in" value={form.email} onChange={set} required/></AField>
          <div className="a-form-row">
            <AField label="Designation">
              <select className="input" name="designation" value={form.designation} onChange={set}>
                {['Assistant Professor','Associate Professor','Professor','Senior Assistant Professor','HOD','Lab Instructor'].map(d=><option key={d}>{d}</option>)}
              </select>
            </AField>
            <AField label="Phone"><input className="input" name="phone" placeholder="9876543210" value={form.phone} onChange={set}/></AField>
          </div>
          <div className="alert alert-blue" style={{fontSize:12}}>Default password = Employee ID. Teacher must change it on first login.</div>
          <div className="a-form-actions">
            <button className="btn btn-brand" type="submit" disabled={saving}>{saving?<Spinner/>:<><Plus size={13}/> Add Teacher</>}</button>
            <button className="btn btn-ghost" type="button" onClick={()=>setModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ── STUDENTS PAGE ────────────────────────────────────────────────────── */
function StudentsPage() {
  const { user } = useAuth();
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [filterProg, setFilterProg] = useState('');
  const [filterSem, setFilterSem]   = useState('');
  const [filterSec, setFilterSec]   = useState('');
  const [form, setForm] = useState({ name:'',usn:'',program:myPrograms[0]||'B.Tech',semester:'1',section:'',labBatch:'B1',mentoringBatch:'',phone:'' });
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    const p = {};
    if(filterProg) p.program=filterProg;
    if(filterSem)  p.semester=filterSem;
    if(filterSec)  p.section=filterSec;
    api.get('/api/admin/students',{params:p}).then(r=>setStudents(r.data)).finally(()=>setLoading(false));
  };
  useEffect(load,[filterProg,filterSem,filterSec]);

  const set = e => setForm({...form,[e.target.name]:e.target.value});
  const filtered = search ? students.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())||s.usn.toLowerCase().includes(search.toLowerCase())) : students;

  const save = async e => {
    e.preventDefault(); setSaving(true);
    try { await api.post('/api/admin/students',form); toast.success('Student added'); setModal(false); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };
  const del = async id => {
    if(!window.confirm('Delete this student? All their marks will also be deleted.')) return;
    try{ await api.delete(`/api/admin/students/${id}`); toast.success('Deleted'); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };
  const handleImport = async e => {
    const file = e.target.files[0]; if(!file) return;
    const fd = new FormData(); fd.append('file',file);
    try {
      const { data } = await api.post('/api/admin/students/bulk-import',fd,{headers:{'Content-Type':'multipart/form-data'}});
      toast.success(`${data.imported} students imported${data.errors>0?`, ${data.errors} errors`:''}`);
      setImportModal(false); load();
    } catch(err){ toast.error(err.response?.data?.message||'Import failed'); }
    finally{ e.target.value=''; }
  };
  const resetPw = async s => {
    if(!window.confirm(`Reset ${s.name}'s password to USN (${s.usn})?`)) return;
    try{ await api.post(`/api/admin/students/${s._id}/reset-password`); toast.success(`Password reset to ${s.usn}`); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };
  const reassign = async s => {
    const section = window.prompt(`Reassign ${s.name} to the junior batch.\n\nNew section (current: ${s.section}):`, s.section);
    if (section === null) return;
    const batch = window.prompt(`New mentoring batch (current: ${s.mentoringBatch||'—'}), e.g. M1:`, s.mentoringBatch||'M1');
    if (batch === null) return;
    const reactivate = s.status==='Detained' ? window.confirm('Reactivate the student (Detained → Active) so they can take tests and register electives with the new batch?') : false;
    try{
      const { data } = await api.post(`/api/admin/students/${s._id}/reassign`, { section, mentoringBatch: batch, reactivate });
      toast.success(data.message); load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Students</h2>
          <p className="a-page-sub">{students.length} students{search?` · ${filtered.length} shown`:''}</p>
        </div>
        <div className="a-page-actions">
          <button className="btn btn-ghost btn-sm" onClick={()=>setImportModal(true)}><Upload size={13}/> Bulk Import</button>
          <button className="btn btn-brand btn-sm" onClick={()=>setModal(true)}><Plus size={13}/> Add Student</button>
        </div>
      </div>

      {/* Filters */}
      <div className="a-filters">
        <div className="a-search">
          <Search size={13} className="a-search__icon"/>
          <input className="a-search__input" placeholder="Search name or USN…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {myPrograms.length>1 && (
          <select className="input a-filter-select" value={filterProg} onChange={e=>setFilterProg(e.target.value)}>
            <option value="">All Programs</option>
            {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select className="input a-filter-select" value={filterSem} onChange={e=>setFilterSem(e.target.value)}>
          <option value="">All Sems</option>
          {semestersFor(filterProg||myPrograms[0]).map(s=><option key={s} value={s}>Sem {s}</option>)}
        </select>
        <input className="input a-filter-select" placeholder="Section" value={filterSec} onChange={e=>setFilterSec(e.target.value)} style={{maxWidth:90}}/>
      </div>

      <div className="a-card a-card--table">
        {loading ? <AdminLoader inline/> : filtered.length===0 ? <Empty icon="🎓" msg="No students" sub="Import students or add manually"/> : (
          <div className="a-table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>#</th><th>Name</th><th>USN</th>
                <th className="center">Program</th><th className="center">Sem</th>
                <th className="center">Sec</th><th className="center">Lab</th>
                <th className="center">Mentor</th><th className="center">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((s,i)=>(
                  <tr key={s._id}>
                    <td className="a-row-num">{i+1}</td>
                    <td style={{fontWeight:500,fontSize:13.5}}>{s.name}</td>
                    <td><span className="mono" style={{fontSize:11.5}}>{s.usn}</span></td>
                    <td className="center"><span className="tag tag-green" style={{fontSize:10}}>{s.program}</span></td>
                    <td className="center"><span className="tag tag-orange" style={{fontSize:10}}>{s.semester}</span></td>
                    <td className="center"><span className="tag tag-blue" style={{fontSize:10}}>{s.section}</span></td>
                    <td className="center"><span className="tag tag-purple" style={{fontSize:10}}>{s.labBatch}</span></td>
                    <td className="center"><span className="tag tag-amber" style={{fontSize:10}}>{s.mentoringBatch||'—'}</span></td>
                    <td className="center">
                      <div className="a-actions">
                        <button className="a-action-btn" title={`Reset to ${s.usn}`} onClick={()=>resetPw(s)}><KeyRound size={13}/></button>
                        {s.status==='Detained' && <button className="a-action-btn" title="Reassign to junior batch" style={{color:'var(--brand)'}} onClick={()=>reassign(s)}>↪</button>}
                        <button className="a-action-btn a-action-btn--danger" onClick={()=>del(s._id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title="Add Student">
        <form onSubmit={save} className="a-form">
          <div className="a-form-row">
            <AField label="Full Name *"><input className="input" name="name" placeholder="Shreeram S P" value={form.name} onChange={set} required/></AField>
            <AField label="USN *"><input className="input" name="usn" placeholder="160124737047" value={form.usn} onChange={set} required style={{textTransform:'uppercase'}}/></AField>
          </div>
          <div className="alert alert-blue" style={{fontSize:11.5}}>Default password = USN. Student must change it on first login.</div>
          <div className="a-form-row a-form-row--3">
            <AField label="Program *">
              <select className="input" name="program" value={form.program} onChange={e=>setForm({...form,program:e.target.value,semester:'1'})}>
                {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </AField>
            <AField label="Semester *">
              <select className="input" name="semester" value={form.semester} onChange={set}>
                {semestersFor(form.program).map(s=><option key={s} value={s}>Sem {s}</option>)}
              </select>
            </AField>
            <AField label="Section *"><input className="input" name="section" type="number" min="1" placeholder="1" value={form.section} onChange={set} required/></AField>
          </div>
          <div className="a-form-row">
            <AField label="Lab Batch">
              <select className="input" name="labBatch" value={form.labBatch} onChange={set}>
                <option value="B1">Batch 1</option><option value="B2">Batch 2</option>
                <option value="B3">Batch 3</option><option value="NA">N/A</option>
              </select>
            </AField>
            <AField label="Mentoring Batch"><input className="input" name="mentoringBatch" placeholder="M1" value={form.mentoringBatch} onChange={set}/></AField>
          </div>
          <div className="a-form-actions">
            <button className="btn btn-brand" type="submit" disabled={saving}>{saving?<Spinner/>:'Add Student'}</button>
            <button className="btn btn-ghost" type="button" onClick={()=>setModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal open={importModal} onClose={()=>setImportModal(false)} title="Bulk Import Students">
        <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{display:'none'}} onChange={handleImport}/>
        <div className="alert alert-blue" style={{marginBottom:14,fontSize:12}}>
          <div>
            <strong>Required columns:</strong><br/>
            <code style={{fontSize:11}}>USN | Name | Program | Semester | Section | LabBatch | MentoringBatch</code><br/>
            No email needed. Default password = USN.
          </div>
        </div>
        <div className="alert alert-amber" style={{marginBottom:14,fontSize:12}}>
          <strong>Program values:</strong> {myPrograms.join(', ')}
        </div>
        <button className="btn btn-brand" onClick={()=>fileRef.current.click()}><Upload size={13}/> Choose Excel / CSV File</button>
        <p style={{fontSize:11.5,color:'var(--text3)',marginTop:10}}>File will be processed immediately after selection.</p>
      </Modal>
    </div>
  );
}

/* ── SUBJECTS PAGE ────────────────────────────────────────────────────── */
function SubjectsPage() {
  const { user } = useAuth();
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [subjects, setSubjects]     = useState([]);
  const [teachers, setTeachers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({ name:'',code:'',type:'theory',program:myPrograms[0]||'B.Tech',semester:'1',credits:3 });
  const [assignForm, setAssignForm] = useState({ sectionTeachers:[{section:'1',teacher:''}], batchTeachers:[{section:'1',batch:'B1',teacher:''}], electiveTeachers:[{teacher:'',fromRoll:'',toRoll:''}] });

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/api/admin/subjects'), api.get('/api/admin/teachers')])
      .then(([s,t])=>{ setSubjects(s.data); setTeachers(t.data); })
      .finally(()=>setLoading(false));
  };
  useEffect(load,[]);

  const set = e => setForm({...form,[e.target.name]:e.target.value});
  const save = async e => {
    e.preventDefault(); setSaving(true);
    try { await api.post('/api/admin/subjects',{...form,semester:Number(form.semester),credits:Number(form.credits),department:user?.department}); toast.success('Subject created'); setModal(false); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };
  const del = async id => {
    if(!window.confirm('Delete this subject?\n\n⚠ All marks and configurations for this subject will also be permanently deleted.')) return;
    try{ await api.delete(`/api/admin/subjects/${id}`); toast.success('Subject deleted'); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };
  const openAssign = s => {
    setAssignModal(s);
    setAssignForm({
      sectionTeachers: s.sectionTeachers?.length
        ? s.sectionTeachers.map(st => ({ section: st.section, teacher: st.teacher?._id?.toString() || st.teacher?.toString() || '' }))
        : [{ section:'1', teacher:'' }],
      batchTeachers: s.batchTeachers?.length
        ? s.batchTeachers.map(bt => ({ section: bt.section, batch: bt.batch, teacher: bt.teacher?._id?.toString() || bt.teacher?.toString() || '' }))
        : [{ section:'1', batch:'B1', teacher:'' }],
      electiveTeachers: s.electiveTeachers?.length
        ? s.electiveTeachers.map(et => ({ teacher: et.teacher?._id?.toString() || et.teacher?.toString() || '', fromRoll: et.fromRoll||'', toRoll: et.toRoll||'' }))
        : [{ teacher:'', fromRoll:'', toRoll:'' }]
    });
  };
  const saveAssign = async () => {
    setSaving(true);
    try {
      const body = {
        sectionTeachers:  assignForm.sectionTeachers.filter(st => st.teacher && st.section),
        batchTeachers:    assignForm.batchTeachers.filter(bt => bt.teacher && bt.section && bt.batch),
        electiveTeachers: assignForm.electiveTeachers.filter(et => et.teacher)
      };
      await api.put(`/api/admin/subjects/${assignModal._id}/assign`, body);
      toast.success('Teachers assigned'); setAssignModal(null); load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };
  const setDeadline = async (id, val) => {
    try { await api.put(`/api/admin/subjects/${id}/deadline`,{deadline:val||null}); toast.success(val?'Deadline set':'Deadline cleared'); load(); }
    catch(err){ toast.error('Failed'); }
  };

  const typeColor = { theory:'orange', lab:'blue', elective:'purple', none:'gray' };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Subjects</h2>
          <p className="a-page-sub">{subjects.length} subjects configured</p>
        </div>
        <button className="btn btn-brand" onClick={()=>setModal(true)}><Plus size={14}/> Add Subject</button>
      </div>

      <div className="a-card a-card--table">
        {loading ? <AdminLoader inline/> : subjects.length===0 ? <Empty icon="📋" msg="No subjects yet" sub="Create your first subject"/> : (
          <div className="a-table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>#</th><th>Subject</th><th>Code</th>
                <th className="center">Type</th><th className="center">Sem</th>
                <th className="center">Credits</th><th>Teachers</th>
                <th className="center">Deadline</th><th className="center">Actions</th>
              </tr></thead>
              <tbody>
                {subjects.map((s,i)=>(
                  <tr key={s._id}>
                    <td className="a-row-num">{i+1}</td>
                    <td style={{fontWeight:600,fontSize:13.5}}>{s.name}</td>
                    <td><span className="mono" style={{fontSize:12}}>{s.code}</span></td>
                    <td className="center"><span className={`tag tag-${typeColor[s.type]||'gray'}`} style={{fontSize:10}}>{s.type}</span></td>
                    <td className="center"><span className="tag tag-orange" style={{fontSize:10}}>Sem {s.semester}</span></td>
                    <td className="center" style={{fontWeight:600,fontSize:13,color:'var(--text2)'}}>{s.credits||3}</td>
                    <td style={{fontSize:12}}>
                      {s.type==='lab' ? (
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {s.batchTeachers?.slice(0,3).map(bt=>(
                            <span key={bt.batch} style={{fontSize:10.5,color:'var(--text2)'}}>{bt.batch}:{bt.teacher?.name||'—'}</span>
                          ))}
                          {!s.batchTeachers?.length && <span style={{color:'var(--text3)'}}>Not assigned</span>}
                        </div>
                      ) : s.sectionTeachers?.length ? (
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {s.sectionTeachers.slice(0,3).map(st=>(
                            <span key={st.section} style={{fontSize:10.5,color:'var(--text2)'}}>Sec{st.section}:{st.teacher?.name||'—'}</span>
                          ))}
                        </div>
                      ) : <span style={{color:'var(--text3)',fontSize:12}}>Not assigned</span>}
                    </td>
                    <td className="center">
                      <input type="date" className="input" style={{width:130,fontSize:11,padding:'4px 8px'}}
                        value={s.markEntryDeadline?s.markEntryDeadline.substring(0,10):''}
                        onChange={e=>setDeadline(s._id,e.target.value)}/>
                    </td>
                    <td className="center">
                      <div className="a-actions">
                        <button className="a-action-btn" title="Assign teachers" onClick={()=>openAssign(s)}><Edit2 size={13}/></button>
                        <button className="a-action-btn a-action-btn--danger" onClick={()=>del(s._id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Subject Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title="Create Subject">
        <form onSubmit={save} className="a-form">
          <div className="a-form-row">
            <AField label="Subject Name *"><input className="input" name="name" placeholder="Data Structures" value={form.name} onChange={set} required/></AField>
            <AField label="Subject Code *"><input className="input" name="code" placeholder="CS302" value={form.code} onChange={set} required/></AField>
          </div>
          <div className="a-form-row a-form-row--4">
            <AField label="Type *">
              <select className="input" name="type" value={form.type} onChange={set}>
                <option value="theory">Theory</option><option value="lab">Lab</option>
                <option value="elective">Elective</option><option value="none">None</option>
              </select>
            </AField>
            <AField label="Program *">
              <select className="input" name="program" value={form.program} onChange={set}>
                {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </AField>
            <AField label="Semester *">
              <select className="input" name="semester" value={form.semester} onChange={set}>
                {semestersFor(form.program).map(s=><option key={s} value={s}>Sem {s}</option>)}
              </select>
            </AField>
            <AField label="Credits"><input className="input" name="credits" type="number" min="1" max="6" value={form.credits} onChange={set}/></AField>
          </div>
          <div className="a-form-actions">
            <button className="btn btn-brand" type="submit" disabled={saving}>{saving?<Spinner/>:'Create Subject'}</button>
            <button className="btn btn-ghost" type="button" onClick={()=>setModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Assign Modal */}
      {assignModal && (
        <Modal open={!!assignModal} onClose={()=>setAssignModal(null)} title={`Assign — ${assignModal.name}`} width={640}>
          <div className="a-form">
            {assignModal.type === 'lab' ? (
              <div>
                <div className="a-field-label">Batch Assignments</div>
                {assignForm.batchTeachers.map((bt,i)=>(
                  <div key={i} className="a-assign-row">
                    <select className="input" style={{width:80}} value={bt.section} onChange={e=>{const a=[...assignForm.batchTeachers];a[i]={...a[i],section:e.target.value};setAssignForm({...assignForm,batchTeachers:a});}}>
                      {[1,2,3,4,5].map(n=><option key={n} value={n}>Sec {n}</option>)}
                    </select>
                    <select className="input" style={{width:90}} value={bt.batch} onChange={e=>{const a=[...assignForm.batchTeachers];a[i]={...a[i],batch:e.target.value};setAssignForm({...assignForm,batchTeachers:a});}}>
                      <option value="B1">B1</option><option value="B2">B2</option><option value="B3">B3</option>
                    </select>
                    <select className="input" style={{flex:1}} value={bt.teacher} onChange={e=>{const a=[...assignForm.batchTeachers];a[i]={...a[i],teacher:e.target.value};setAssignForm({...assignForm,batchTeachers:a});}}>
                      <option value="">— Select Teacher —</option>
                      {teachers.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                    <button className="a-action-btn a-action-btn--danger" onClick={()=>setAssignForm({...assignForm,batchTeachers:assignForm.batchTeachers.filter((_,j)=>j!==i)})}><X size={13}/></button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={()=>setAssignForm({...assignForm,batchTeachers:[...assignForm.batchTeachers,{section:'1',batch:'B1',teacher:''}]})}><Plus size={12}/> Add Batch</button>
              </div>
            ) : assignModal.type === 'elective' ? (
              <div>
                <div className="a-field-label">Roll Range Assignments</div>
                {assignForm.electiveTeachers.map((et,i)=>(
                  <div key={i} className="a-assign-row">
                    <input className="input" placeholder="From USN" value={et.fromRoll} onChange={e=>{const a=[...assignForm.electiveTeachers];a[i]={...a[i],fromRoll:e.target.value};setAssignForm({...assignForm,electiveTeachers:a});}}/>
                    <input className="input" placeholder="To USN"   value={et.toRoll}   onChange={e=>{const a=[...assignForm.electiveTeachers];a[i]={...a[i],toRoll:e.target.value};setAssignForm({...assignForm,electiveTeachers:a});}}/>
                    <select className="input" style={{flex:1}} value={et.teacher} onChange={e=>{const a=[...assignForm.electiveTeachers];a[i]={...a[i],teacher:e.target.value};setAssignForm({...assignForm,electiveTeachers:a});}}>
                      <option value="">— Select Teacher —</option>
                      {teachers.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                    <button className="a-action-btn a-action-btn--danger" onClick={()=>setAssignForm({...assignForm,electiveTeachers:assignForm.electiveTeachers.filter((_,j)=>j!==i)})}><X size={13}/></button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={()=>setAssignForm({...assignForm,electiveTeachers:[...assignForm.electiveTeachers,{teacher:'',fromRoll:'',toRoll:''}]})}><Plus size={12}/> Add Range</button>
              </div>
            ) : (
              <div>
                <div className="a-field-label">Section Assignments (one teacher per section)</div>
                {assignForm.sectionTeachers.map((st,i)=>(
                  <div key={i} className="a-assign-row">
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      <span className="a-field-label" style={{marginBottom:0}}>Section</span>
                      <input className="input" type="number" min="1" style={{width:64}} value={st.section}
                        onChange={e=>{const a=[...assignForm.sectionTeachers];a[i]={...a[i],section:e.target.value};setAssignForm({...assignForm,sectionTeachers:a});}}/>
                    </div>
                    <select className="input" style={{flex:1}} value={st.teacher} onChange={e=>{const a=[...assignForm.sectionTeachers];a[i]={...a[i],teacher:e.target.value};setAssignForm({...assignForm,sectionTeachers:a});}}>
                      <option value="">— Select Teacher —</option>
                      {teachers.map(t=><option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
                    <button className="a-action-btn a-action-btn--danger" onClick={()=>setAssignForm({...assignForm,sectionTeachers:assignForm.sectionTeachers.filter((_,j)=>j!==i)})}><X size={13}/></button>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={()=>setAssignForm({...assignForm,sectionTeachers:[...assignForm.sectionTeachers,{section:'',teacher:''}]})}><Plus size={12}/> Add Section</button>
              </div>
            )}
            <div className="a-form-actions" style={{marginTop:20}}>
              <button className="btn btn-brand" onClick={saveAssign} disabled={saving}>{saving?<Spinner/>:'Save Assignments'}</button>
              <button className="btn btn-ghost" onClick={()=>setAssignModal(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── MENTORING PAGE ───────────────────────────────────────────────────── */
function MentoringPage() {
  const { user } = useAuth();
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [teachers,     setTeachers]     = useState([]);
  const [assignments,  setAssignments]  = useState([]);
  const [saving,       setSaving]       = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(null);
  const [studentList,  setStudentList]  = useState(null);
  const [form, setForm] = useState({ teacherId:'', program: myPrograms[0]||'B.Tech', semester:'1', section:'', mentoringBatch:'' });

  const load = () => {
    api.get('/api/admin/teachers').then(r=>setTeachers(r.data)).catch(()=>{});
    api.get('/api/admin/mentor-assignments').then(r=>setAssignments(r.data)).catch(()=>{});
  };
  useEffect(load,[]);

  const set = e => setForm({...form,[e.target.name]:e.target.value});

  const save = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post('/api/admin/assign-mentor',{
        mentorId:       form.teacherId,
        program:        form.program,
        semester:       form.semester,
        section:        form.section,
        mentoringBatch: form.mentoringBatch.trim().toUpperCase()
      });
      toast.success(`${data.assigned} students in Sem ${data.semester} Sec ${data.section} Batch ${data.mentoringBatch} assigned`);
      setForm({teacherId:'', program:myPrograms[0]||'B.Tech', semester:'1', section:'', mentoringBatch:''});
      load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const viewStudents = async (mentorId, program, semester, section, batch) => {
    const key = `${mentorId}_${semester}_${section}_${batch||''}`;
    if (studentList?.key === key) { setStudentList(null); return; }
    setStudentList(null);
    setLoadingStudents(key);
    try {
      const { data } = await api.get('/api/admin/mentor-students', { params:{ mentorId, program, semester, section, mentoringBatch: batch } });
      setStudentList({ key, mentorId, semester, section, students: data });
    } catch(err){ toast.error('Failed to load students'); }
    finally{ setLoadingStudents(null); }
  };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <h2 className="a-page-title">Mentoring Assignment</h2>
        <p className="a-page-sub">Assign mentors by Semester + Section</p>
      </div>

      {/* Assign form */}
      <div className="a-card" style={{maxWidth:580}}>
        <h3 className="a-card__title" style={{marginBottom:14}}>Assign Mentor</h3>
        <div className="alert alert-blue" style={{fontSize:12,marginBottom:14}}>
          Deciding factor is <strong>Semester + Section</strong>. All students in that sem+section will be assigned to this mentor.
        </div>
        <form onSubmit={save} className="a-form">
          <AField label="Mentor Teacher *">
            <select className="input" name="teacherId" value={form.teacherId} onChange={set} required>
              <option value="">— Select teacher —</option>
              {teachers.map(t=><option key={t._id} value={t._id}>{t.name} ({t.designation||'Faculty'})</option>)}
            </select>
          </AField>
          <div className="a-form-row a-form-row--3">
            <AField label="Program *">
              <select className="input" name="program" value={form.program} onChange={set}>
                {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </AField>
            <AField label="Semester *">
              <select className="input" name="semester" value={form.semester} onChange={set}>
                {semestersFor(form.program).map(s=><option key={s} value={s}>Sem {s}</option>)}
              </select>
            </AField>
            <AField label="Section *">
              <input className="input" name="section" type="number" min="1" placeholder="1" value={form.section} onChange={set} required/>
            </AField>
          </div>
          <AField label="Mentoring Batch * (e.g. M1, M2, M3)">
            <input className="input" name="mentoringBatch"
              placeholder="M1"
              value={form.mentoringBatch}
              onChange={e=>setForm({...form,mentoringBatch:e.target.value.toUpperCase()})}
              required/>
            <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
              Students in this section with this batch number will be assigned to the mentor.
            </p>
          </AField>
          <div className="a-form-actions">
            <button className="btn btn-brand" type="submit" disabled={saving}>
              {saving?<Spinner/>:<><UserCheck size={13}/> Assign Mentor</>}
            </button>
          </div>
        </form>
      </div>

      {/* Current assignments */}
      {assignments.length > 0 && (
        <div className="a-card fade-up">
          <h3 className="a-card__title" style={{marginBottom:14}}>
            Current Mentor Assignments
            <span className="a-count-badge" style={{marginLeft:8}}>{assignments.length}</span>
          </h3>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {assignments.map(a=>(
              <div key={a.teacher._id} style={{
                border:'1px solid var(--border)',borderRadius:'var(--r3)',overflow:'hidden'
              }}>
                {/* Mentor header */}
                <div style={{
                  padding:'10px 16px',background:'var(--surface2)',
                  display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'
                }}>
                  <div className="a-person-avatar" style={{width:34,height:34,fontSize:12}}>
                    {a.teacher.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontWeight:600,fontSize:13.5}}>{a.teacher.name}</div>
                    <div style={{fontSize:11.5,color:'var(--text3)'}}>{a.teacher.designation} · {a.teacher.employeeId}</div>
                  </div>
                  <span className="a-count-badge" style={{marginLeft:'auto'}}>{a.assignments.length} section{a.assignments.length>1?'s':''}</span>
                </div>
                {/* Sem+Section chips */}
                <div style={{padding:'10px 16px',display:'flex',gap:8,flexWrap:'wrap'}}>
                  {a.assignments.map((asgn,i)=>{
                    const key=`${a.teacher._id}_${asgn.semester}_${asgn.section}`;
                    const isOpen = studentList?.key === `${a.teacher._id}_${asgn.semester}_${asgn.section}_${asgn.mentoringBatch||''}`;
                    const isLoading = loadingStudents===key;
                    return (
                      <button key={i}
                        onClick={()=>viewStudents(a.teacher._id,asgn.program,asgn.semester,asgn.section,asgn.mentoringBatch)}
                        style={{
                          display:'flex',alignItems:'center',gap:7,
                          padding:'6px 14px',borderRadius:20,fontSize:12.5,fontWeight:600,
                          border:`1.5px solid ${isOpen?'var(--brand)':'var(--border2)'}`,
                          background:isOpen?'var(--brand-l)':'var(--surface)',
                          color:isOpen?'var(--brand-d)':'var(--text2)',
                          cursor:'pointer',transition:'all .13s'
                        }}>
                        {isLoading?<Spinner/>:null}
                        Sem {asgn.semester} · Sec {asgn.section} · {asgn.mentoringBatch||'M1'}
                        <span style={{
                          background:isOpen?'var(--brand)':'var(--surface3)',
                          color:isOpen?'#fff':'var(--text3)',
                          borderRadius:10,fontSize:10,padding:'1px 7px',fontWeight:700
                        }}>{asgn.count}</span>
                        <span style={{fontSize:11,opacity:.6}}>{isOpen?'▲':'▼'}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Expandable student list */}
                {studentList && a.assignments.some(asgn=>studentList.key===`${a.teacher._id}_${asgn.semester}_${asgn.section}_${asgn.mentoringBatch||''}`) && (
                  <div style={{borderTop:'1px solid var(--border)',padding:'0'}}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>#</th><th>Roll No</th><th>Name</th>
                          <th className="center">Lab Batch</th>
                          <th className="center">Status</th>
                          <th className="center">Activity Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentList.students.map((s,i)=>(
                          <tr key={s.usn} style={s.isDetained?{background:'#FFF5F5'}:{}}>
                            <td style={{color:'var(--text3)',fontSize:11}}>{i+1}</td>
                            <td><span className="mono" style={{fontSize:11.5}}>{s.usn}</span></td>
                            <td style={{fontWeight:500}}>
                              {s.name}
                              {s.isDetained&&<span className="tag tag-red" style={{fontSize:9,marginLeft:5}}>DETAINED</span>}
                            </td>
                            <td className="center"><span className="mono" style={{fontSize:11}}>{s.labBatch}</span></td>
                            <td className="center">
                              <span className={`tag tag-${s.status==='Active'?'mint':s.status==='Detained'?'red':'amber'}`} style={{fontSize:10}}>
                                {s.status}
                              </span>
                            </td>
                            <td className="center" style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
                              {s.activityPoints??'—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PROMOTION PAGE ───────────────────────────────────────────────────── */
function PromotionPage() {
  const { user } = useAuth();
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [program, setProgram]   = useState(myPrograms[0]||'B.Tech');
  const [semester, setSemester] = useState('1');
  const [section, setSection]   = useState('');
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [executing, setExecuting] = useState(false);
  const [overrides, setOverrides] = useState({});

  const runPreview = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/promotion/preview',{params:{program,semester,section:section||undefined}});
      setPreview(data); setOverrides({});
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setLoading(false); }
  };
  const execute = async () => {
    if(!window.confirm(`Promote ${preview?.students?.length||0} students?\n\nThis action cannot be undone.`)) return;
    setExecuting(true);
    try {
      const { data } = await api.post('/api/admin/promotion/execute',{program,semester,section:section||undefined,overrides});
      toast.success(`Done — ${data.promoted} promoted, ${data.graduated} graduated, ${data.held} held`);
      setPreview(null);
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setExecuting(false); }
  };

  const statusColor = { promote:'var(--mint)', Graduated:'var(--mint)', held:'var(--red)', PendingClearance:'var(--amber)' };
  const statusLabel = { promote:'Promote', Graduated:'Graduate', held:'Hold (Detained)', PendingClearance:'Pending Clearance' };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Student Promotion</h2>
          <p className="a-page-sub">Preview and execute semester promotion for a cohort</p>
        </div>
      </div>

      <div className="a-card" style={{maxWidth:540}}>
        <div className="a-form">
          <div className="a-form-row a-form-row--3">
            <AField label="Program">
              <select className="input" value={program} onChange={e=>{setProgram(e.target.value);setSemester('1');setPreview(null);}}>
                {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </AField>
            <AField label="Current Semester">
              <select className="input" value={semester} onChange={e=>{setSemester(e.target.value);setPreview(null);}}>
                {semestersFor(program).map(s=><option key={s} value={s}>Sem {s}</option>)}
              </select>
            </AField>
            <AField label="Section (optional)">
              <input className="input" type="number" min="1" placeholder="All" value={section} onChange={e=>{setSection(e.target.value);setPreview(null);}}/>
            </AField>
          </div>
          <button className="btn btn-brand" onClick={runPreview} disabled={loading}>{loading?<Spinner/>:'Preview Promotion'}</button>
        </div>
      </div>

      {preview && (
        <div className="a-card fade-up">
          <div className="a-card__hdr" style={{marginBottom:16}}>
            <h3 className="a-card__title">
              Preview — {program} Sem {semester}
              <span className="a-count-badge">{preview.students?.length||0}</span>
            </h3>
            <button className="btn btn-mint" onClick={execute} disabled={executing}>
              {executing?<Spinner/>:<><CheckCircle size={13}/> Execute Promotion</>}
            </button>
          </div>
          <div className="a-table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>Name</th><th>USN</th>
                <th className="center">Sec</th>
                <th className="center">Recommended</th>
                <th className="center">Override</th>
              </tr></thead>
              <tbody>
                {(preview.students||[]).map(s=>(
                  <tr key={s._id}>
                    <td style={{fontWeight:500}}>{s.name}</td>
                    <td><span className="mono" style={{fontSize:11}}>{s.usn}</span></td>
                    <td className="center">{s.section}</td>
                    <td className="center">
                      <span style={{fontSize:11.5,fontWeight:700,color:statusColor[s.recommended]||'var(--text2)'}}>
                        {statusLabel[s.recommended]||s.recommended}
                      </span>
                    </td>
                    <td className="center">
                      <select className="input" style={{width:150,fontSize:11.5,padding:'3px 8px'}}
                        value={overrides[s._id]||s.recommended}
                        onChange={e=>setOverrides({...overrides,[s._id]:e.target.value})}>
                        <option value="promote">Promote</option>
                        <option value="held">Hold (Detain)</option>
                        <option value="Graduated">Graduate</option>
                        <option value="PendingClearance">Pending Clearance</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SUPPLIES & STATUS ────────────────────────────────────────────────── */
function SuppliesPage() {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [supplyModal, setSupplyModal] = useState(null);
  const [clearSubjectId, setClearSubjectId] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/api/admin/students'),api.get('/api/admin/subjects')])
      .then(([s,sub])=>{ setStudents(s.data); setSubjects(sub.data); })
      .finally(()=>setLoading(false));
  };
  useEffect(load,[]);

  const setStatus = async (id,status) => {
    try { await api.put(`/api/admin/students/${id}/status`,{status}); toast.success(`Status → ${status}`); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };
  const addSupply = async () => {
    if(!clearSubjectId){ toast.error('Select a subject'); return; }
    const sub = subjects.find(s=>s._id===clearSubjectId);
    if(!sub) return;
    try {
      await api.post(`/api/admin/students/${supplyModal._id}/supplies`,{subjectId:clearSubjectId,subjectName:sub.name,subjectCode:sub.code,semester:sub.semester});
      toast.success('Supply added'); setSupplyModal(null); setClearSubjectId(''); load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };
  const clearSupply = async (studentId,supplyId) => {
    try { await api.put(`/api/admin/students/${studentId}/supplies/${supplyId}/clear`); toast.success('Supply cleared'); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };
  const removeSupply = async (studentId,supplyId) => {
    if(!window.confirm('Remove this supply entry?')) return;
    try { await api.delete(`/api/admin/students/${studentId}/supplies/${supplyId}`); toast.success('Removed'); load(); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };

  const filterFns = {
    all:             ()=>true,
    Detained:        s=>s.status==='Detained',
    PendingClearance:s=>s.status==='PendingClearance',
    hasSupply:       s=>(s.supplies||[]).some(x=>!x.cleared),
  };
  const filtered = students.filter(filterFns[filter]||filterFns.all)
    .filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase())||s.usn.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Supplies & Status</h2>
          <p className="a-page-sub">Manage student detention, supply subjects, and lifecycle status</p>
        </div>
      </div>

      <div className="a-filters">
        <div className="a-search">
          <Search size={13} className="a-search__icon"/>
          <input className="a-search__input" placeholder="Search name or USN…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="tabs" style={{border:'none',gap:4}}>
          {[['all','All'],['Detained','Detained'],['PendingClearance','Pending Clearance'],['hasSupply','Has Supplies']].map(([k,l])=>(
            <button key={k} className={`tab-btn${filter===k?' active':''}`} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="a-card a-card--table">
        {loading ? <AdminLoader inline/> : filtered.length===0 ? <Empty icon="✅" msg="No students match this filter"/> : (
          <div className="a-table-wrap">
            <table className="tbl">
              <thead><tr>
                <th>Name</th><th>USN</th><th className="center">Sem</th>
                <th className="center">Status</th><th>Supplies</th><th className="center">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(s=>(
                  <tr key={s._id}>
                    <td style={{fontWeight:500}}>{s.name}</td>
                    <td><span className="mono" style={{fontSize:11}}>{s.usn}</span></td>
                    <td className="center"><span className="tag tag-orange" style={{fontSize:10}}>{s.semester}</span></td>
                    <td className="center">
                      <select className="input" style={{width:150,fontSize:11.5,padding:'3px 8px'}}
                        value={s.status} onChange={e=>setStatus(s._id,e.target.value)}>
                        <option value="Active">Active</option>
                        <option value="Detained">Detained</option>
                        <option value="PendingClearance">Pending Clearance</option>
                        <option value="Graduated">Graduated</option>
                      </select>
                    </td>
                    <td>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        {(s.supplies||[]).map(sup=>(
                          <div key={sup._id} className={`a-supply-chip${sup.cleared?' a-supply-chip--cleared':''}`}>
                            <span>{sup.subjectCode||sup.subjectName}</span>
                            {!sup.cleared && <button className="a-supply-chip__clear" onClick={()=>clearSupply(s._id,sup._id)} title="Mark cleared">✓</button>}
                            <button className="a-supply-chip__remove" onClick={()=>removeSupply(s._id,sup._id)} title="Remove">×</button>
                          </div>
                        ))}
                        <button className="a-supply-add" onClick={()=>setSupplyModal(s)}>+ Add Supply</button>
                      </div>
                    </td>
                    <td className="center">
                      <span style={{fontSize:11,color:'var(--text3)'}}>{s.section}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!supplyModal} onClose={()=>setSupplyModal(null)} title={`Add Supply — ${supplyModal?.name||''}`}>
        <div className="a-form">
          <AField label="Subject *">
            <select className="input" value={clearSubjectId} onChange={e=>setClearSubjectId(e.target.value)}>
              <option value="">— Select subject —</option>
              {subjects.map(s=><option key={s._id} value={s._id}>{s.name} ({s.code}) · Sem {s.semester}</option>)}
            </select>
          </AField>
          <div className="a-form-actions">
            <button className="btn btn-brand" onClick={addSupply}><Plus size={13}/> Add Supply</button>
            <button className="btn btn-ghost" onClick={()=>setSupplyModal(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── SETTINGS PAGE ────────────────────────────────────────────────────── */
function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [savingYear, setSavingYear]     = useState(false);
  const [admins, setAdmins]             = useState([]);
  const [newAdmin, setNewAdmin]         = useState({ email:'', name:'' });
  const [addingAdmin, setAddingAdmin]   = useState(false);

  useEffect(()=>{
    api.get('/api/admin/config').then(r=>setAcademicYear(r.data.academicYear||'2025-26')).catch(()=>{});
    api.get('/api/auth/admin/all').then(r=>setAdmins(r.data)).catch(()=>{});
  },[]);

  const saveYear = async () => {
    if(!/^\d{4}-\d{2}$/.test(academicYear)){toast.error('Format: YYYY-YY e.g. 2026-27');return;}
    if(!window.confirm(`Change academic year to ${academicYear}?\n\nAll new marks will use this year. Existing marks are not affected.\n\nOnly do this at the start of a new academic year.`)) return;
    setSavingYear(true);
    try{ await api.put('/api/admin/config',{academicYear}); toast.success(`Academic year → ${academicYear}`); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSavingYear(false); }
  };
  const grantAdmin = async () => {
    if(!newAdmin.email){toast.error('Enter teacher email');return;}
    setAddingAdmin(true);
    try{
      await api.post('/api/auth/admin/create',newAdmin);
      toast.success('Admin access granted');
      setNewAdmin({email:'',name:''});
      api.get('/api/auth/admin/all').then(r=>setAdmins(r.data));
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setAddingAdmin(false); }
  };
  const revokeAdmin = async id => {
    if(!window.confirm('Revoke admin access from this teacher?')) return;
    try{ await api.delete(`/api/auth/admin/${id}`); toast.success('Admin access revoked'); api.get('/api/auth/admin/all').then(r=>setAdmins(r.data)); }
    catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <h2 className="a-page-title">Settings</h2>
      </div>

      {/* Academic Year */}
      <div className="a-card">
        <h3 className="a-card__title" style={{marginBottom:6}}>Academic Year</h3>
        <p className="a-card__sub" style={{marginBottom:16}}>
          All new marks entries will use this year. Change at the start of every academic year. Existing records are unaffected.
        </p>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
          <AField label="Current Year" style={{flex:'0 0 160px'}}>
            <input className="input" value={academicYear} onChange={e=>setAcademicYear(e.target.value)} placeholder="2025-26"/>
          </AField>
          <button className="btn btn-brand btn-sm" onClick={saveYear} disabled={savingYear}>{savingYear?<Spinner/>:'Save Year'}</button>
        </div>
        <p style={{fontSize:11,color:'var(--text3)',marginTop:8}}>Format: YYYY-YY · e.g. 2025-26, 2026-27</p>
      </div>

      {/* Admin management */}
      <div className="a-card">
        <h3 className="a-card__title" style={{marginBottom:6}}>Admin Access</h3>
        <p className="a-card__sub" style={{marginBottom:16}}>Grant or revoke admin access for teachers in this department.</p>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap',marginBottom:16}}>
          <AField label="Teacher Email" style={{flex:'1 1 200px'}}>
            <input className="input" placeholder="teacher@cbit.ac.in" value={newAdmin.email} onChange={e=>setNewAdmin({...newAdmin,email:e.target.value})}/>
          </AField>
          <button className="btn btn-brand btn-sm" onClick={grantAdmin} disabled={addingAdmin}>{addingAdmin?<Spinner/>:'Grant Access'}</button>
        </div>
        {admins.length > 0 && (
          <div className="a-table-wrap">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th className="center">Actions</th></tr></thead>
              <tbody>
                {admins.map(a=>(
                  <tr key={a._id}>
                    <td style={{fontWeight:500}}>{a.name}</td>
                    <td style={{fontSize:12.5,color:'var(--text2)'}}>{a.email}</td>
                    <td className="center">
                      <button className="a-action-btn a-action-btn--danger" onClick={()=>revokeAdmin(a._id)} title="Revoke admin access"><X size={13}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profile */}
      <AccountSettings accent="var(--brand)" fields={[
        { label:'Department', value:user?.department },
        { label:'Programs',   value:(user?.programs||[]).join(', ') },
        { label:'Employee ID',value:user?.employeeId, mono:true },
      ]}/>
    </div>
  );
}


/* ── AI INSIGHTS PAGE ─────────────────────────────────────────────────── */
function AIInsightsPage() {
  return (
    <div className="ai-page">
      <div className="a-page-header">
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
            <h2 className="a-page-title">AI Insights</h2>
            <span className="ai-badge">✦ Smart Analysis</span>
          </div>
          <p className="a-page-sub">AI-driven risk analysis of your department's CIE data</p>
        </div>
      </div>
      <AIRiskPredictor/>
    </div>
  );
}

function AIReportGenerator() {
  const [report,   setReport]   = useState(null);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const generate = async () => {
    setLoading(true); setError(null); setReport(null);
    try {
      const { data } = await api.post('/api/admin/ai/department-report');
      setReport(data.report);
      setStats(data.stats);
    } catch(err) {
      const msg = err.response?.data?.message || '';
      if (msg.includes('quota') || msg.includes('429')) {
        setError('Gemini API quota exceeded. Free tier allows 15 requests/minute and 1500/day. Wait a minute and try again, or use a different API key.');
      } else if (msg.includes('GEMINI_API_KEY') || msg.includes('API key')) {
        setError('Gemini API key not set or invalid. Add GEMINI_API_KEY to your backend .env file.');
      } else {
        setError(msg || 'Failed to generate report. Check your GEMINI_API_KEY in .env.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="ai-report-card">
      <div className="ai-report-header">
        <div>
          <div className="ai-report-title">📋 Department Performance Report</div>
          <div className="ai-report-sub">AI-generated analysis based on your CIE data</div>
        </div>
        <button className="btn btn-brand btn-sm" onClick={generate} disabled={loading}
          style={{background:'rgba(255,107,53,.9)',flexShrink:0}}>
          {loading ? <><span className="ai-dots"><span/><span/><span/></span> Generating…</> : '✦ Generate Report'}
        </button>
      </div>
      <div className="ai-report-body">
        {!report && !loading && !error && (
          <div style={{textAlign:'center',padding:'32px 0',color:'var(--text3)'}}>
            <div style={{fontSize:36,marginBottom:12}}>✦</div>
            <p style={{fontFamily:"'Outfit',sans-serif",fontWeight:600,fontSize:15,color:'var(--text2)'}}>
              Generate your department report
            </p>
            <p style={{fontSize:13,color:'var(--text3)',marginTop:6}}>
              AI will analyze your CIE completion status, attendance risk, and performance trends
            </p>
          </div>
        )}
        {loading && (
          <div className="ai-generating">
            <span className="ai-dots"><span/><span/><span/></span>
            <span>Analyzing department data and generating report…</span>
          </div>
        )}
        {error && (
          <div className="alert alert-red" style={{fontSize:13}}>{error}</div>
        )}
        {stats && (
          <div className="ai-stats-row">
            {[
              { val:stats.students,  lbl:'Students' },
              { val:stats.teachers,  lbl:'Teachers' },
              { val:stats.subjects,  lbl:'Subjects' },
              { val:stats.detained,  lbl:'Detained' },
              { val:stats.supplies,  lbl:'Pending Supplies' },
              { val:stats.avgCIE,    lbl:'Avg CIE Score' },
              { val:stats.attRisk,   lbl:'Attendance Risk' },
            ].map(s=>(
              <div key={s.lbl} className="ai-stat">
                <div className="ai-stat__val">{s.val}</div>
                <div className="ai-stat__lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        )}
        {report && (
          <>
            <div className="divider"/>
            <div className="ai-report-text">
              {report.split('\n\n').map((para,i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <div style={{marginTop:16,display:'flex',gap:8}}>
              <button className="btn btn-white btn-sm" onClick={()=>{
                const blob = new Blob([report], {type:'text/plain'});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `Department_Report_${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.txt`;
                a.click();
              }}>
                <Download size={13}/> Download Report
              </button>
              <button className="btn btn-ghost btn-sm" onClick={generate}>↻ Regenerate</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AIRiskPredictor() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('all');

  const predict = async () => {
    setLoading(true); setError(null);
    try {
      const { data: d } = await api.get('/api/admin/ai/risk-prediction');
      setData(d);
    } catch(err) {
      setError(err.response?.data?.message || 'Failed to run risk prediction');
    } finally { setLoading(false); }
  };

  const filtered = data?.students?.filter(s => filter === 'all' || s.riskLevel === filter) || [];

  const levelColor = { high:'var(--red)', medium:'var(--amber)', low:'var(--blue)' };
  const levelBg    = { high:'var(--red-l)', medium:'var(--amber-l)', low:'var(--blue-l)' };

  return (
    <div className="a-card">
      <div className="a-card__hdr">
        <div>
          <h3 className="a-card__title">
            🎯 Student Risk Predictor
            {data && <span className="a-count-badge a-count-badge--red" style={{marginLeft:8}}>{data.atRisk}</span>}
          </h3>
          <p className="a-card__sub">AI identifies students at risk of detention based on CT performance, attendance, and trends</p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={predict} disabled={loading}>
          {loading ? <><span className="ai-dots"><span/><span/><span/></span> Analyzing…</> : '✦ Run Analysis'}
        </button>
      </div>

      {error && <div className="alert alert-red" style={{fontSize:13,marginTop:12}}>{error}</div>}

      {data && (
        <>
          {/* Summary chips */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'14px 0'}}>
            {[
              { key:'all',    label:`All at Risk (${data.atRisk})`,   color:'var(--text2)',   bg:'var(--surface2)' },
              { key:'high',   label:`High Risk (${data.high})`,        color:'var(--red)',     bg:'var(--red-l)'   },
              { key:'medium', label:`Medium Risk (${data.medium})`,    color:'var(--amber)',   bg:'var(--amber-l)' },
              { key:'low',    label:`Low Risk (${data.low})`,          color:'var(--blue)',    bg:'var(--blue-l)'  },
            ].map(f=>(
              <button key={f.key}
                onClick={()=>setFilter(f.key)}
                style={{
                  padding:'5px 14px', borderRadius:20, fontSize:12.5, fontWeight:600,
                  border:`1.5px solid ${filter===f.key?f.color:'var(--border2)'}`,
                  background:filter===f.key?f.bg:'var(--surface)',
                  color:filter===f.key?f.color:'var(--text2)', cursor:'pointer', transition:'all .13s'
                }}>
                {f.label}
              </button>
            ))}
            <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center',marginLeft:4}}>
              out of {data.total} active students
            </span>
          </div>

          {filtered.length === 0
            ? <div className="empty" style={{padding:24}}>
                <p className="empty-title">No students at this risk level</p>
              </div>
            : (
              <div className="ai-risk-list">
                {filtered.map((s,i)=>(
                  <div key={s.student.id} className="ai-risk-card">
                    <div className={`ai-risk-score ai-risk-score--${s.riskLevel}`}>
                      {s.riskScore}
                    </div>
                    <div className="ai-risk-info">
                      <div className="ai-risk-name">{s.student.name}</div>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:2}}>
                        <span className="ai-risk-usn">{s.student.usn}</span>
                        <span className="tag tag-orange" style={{fontSize:9}}>Sem {s.student.semester}</span>
                        <span className="tag tag-gray" style={{fontSize:9}}>Sec {s.student.section}</span>
                      </div>
                      <div className="ai-risk-factors">
                        {s.riskFactors.map((f,j)=>(
                          <span key={j} className="ai-risk-factor">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{flexShrink:0,textAlign:'right'}}>
                      <span style={{
                        fontSize:11.5, fontWeight:700, padding:'3px 12px', borderRadius:20,
                        color:levelColor[s.riskLevel], background:levelBg[s.riskLevel],
                        border:`1px solid ${levelColor[s.riskLevel]}33`, textTransform:'capitalize'
                      }}>{s.riskLevel} risk</span>
                      {s.avgAttendance && (
                        <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                          Avg att: <strong style={{color:s.avgAttendance<70?'var(--red)':'var(--text)'}}>{s.avgAttendance}%</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </>
      )}

      {!data && !loading && !error && (
        <div style={{textAlign:'center',padding:'24px 0',color:'var(--text3)'}}>
          <p style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:600,color:'var(--text2)'}}>Run the analysis to see at-risk students</p>
          <p style={{fontSize:12.5,marginTop:6}}>Analyzes CT scores, attendance patterns, and supply subjects to identify students heading toward detention</p>
        </div>
      )}
    </div>
  );
}


/* ── CONSOLIDATED CIE PAGE ────────────────────────────────────────────── */
function ConsolidatedCIEPage() {
  const { user } = useAuth();
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [program,  setProgram]  = useState(myPrograms[0] || 'B.Tech');
  const [semester, setSemester] = useState('4');
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error,    setError]    = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  const semOptions = ['1','2','3','4','5','6','7','8'];

  const loadPreview = async () => {
    setLoading(true); setError(null); setPreview(null);
    try {
      const { data } = await api.get('/api/admin/consolidated-cie/preview', {
        params: { program, semester }
      });
      setPreview(data);
      setActiveSection(data.sections?.[0]?.sectionNum || null);
    } catch(err) {
      setError(err.response?.data?.message || 'Failed to load preview');
    } finally { setLoading(false); }
  };

  const download = async () => {
    setDownloading(true); setError(null);
    try {
      const resp = await api.get('/api/admin/consolidated-cie', {
        params: { program, semester },
        responseType: 'blob'
      });
      const dept = user?.department || 'Dept';
      const year = preview?.year || '2025-26';
      const url  = window.URL.createObjectURL(new Blob([resp.data]));
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${dept}_Sem${semester}_CIE_${year.replace('-','_')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch(err) {
      if (err.response?.data instanceof Blob) {
        const txt = await err.response.data.text();
        try { setError(JSON.parse(txt).message); } catch { setError(txt); }
      } else {
        setError(err.response?.data?.message || 'Download failed');
      }
    } finally { setDownloading(false); }
  };

  const activeSec = preview?.sections?.find(s => s.sectionNum === activeSection);
  const subjects  = preview?.subjects || [];
  const theorySubs   = subjects.filter(s=>s.type==='theory');
  const electiveSubs = subjects.filter(s=>s.type==='elective');
  const labSubs      = subjects.filter(s=>s.type==='lab');

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Consolidated CIE Sheet</h2>
          <p className="a-page-sub">Preview and download the official consolidated CIE marks — one sheet per section</p>
        </div>
        {preview && (
          <button className="btn btn-mint" onClick={download} disabled={downloading} style={{gap:8}}>
            {downloading?<Spinner/>:<><Download size={14}/> Download Excel</>}
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="a-card fade-up">
        <div className="a-form">
          <div className="a-form-row" style={{maxWidth:400}}>
            <AField label="Program">
              <select className="input" value={program} onChange={e=>setProgram(e.target.value)}>
                {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </AField>
            <AField label="Semester">
              <select className="input" value={semester} onChange={e=>setSemester(e.target.value)}>
                {semOptions.map(s=><option key={s} value={s}>Semester {s}</option>)}
              </select>
            </AField>
          </div>
          {error && <div className="alert alert-red" style={{fontSize:12}}>⚠ {error}</div>}
          <button className="btn btn-brand" onClick={loadPreview} disabled={loading} style={{alignSelf:'flex-start'}}>
            {loading?<Spinner/>:'Preview CIE Sheet'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="a-card fade-up2" style={{padding:0,overflow:'hidden'}}>
          {/* Header matching CBIT format */}
          <div style={{background:'#1F4E79',padding:'10px 20px',textAlign:'center'}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14,color:'#fff'}}>
              CHAITANYA BHARATHI INSTITUTE OF TECHNOLOGY(Autonomous), HYDERABAD-75
            </div>
          </div>
          <div style={{background:'#2E75B6',padding:'6px 20px',textAlign:'center'}}>
            <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:13,color:'#fff'}}>
              CONSOLIDATED CIE MARKS
            </div>
          </div>
          <div style={{padding:'8px 20px',background:'var(--surface2)',borderBottom:'1px solid var(--border)',display:'flex',gap:24,flexWrap:'wrap',fontSize:12.5}}>
            <span><strong>Program:</strong> {preview.program}</span>
            <span><strong>Department:</strong> {preview.department}</span>
            <span><strong>Academic Year:</strong> {preview.year}</span>
            <span><strong>Semester:</strong> {preview.semester}</span>
          </div>

          {/* Section tabs */}
          {preview.sections.length > 1 && (
            <div className="tabs" style={{borderRadius:0,padding:'0 16px',background:'var(--surface2)'}}>
              {preview.sections.map(sec=>(
                <button key={sec.sectionNum}
                  className={`tab-btn${activeSection===sec.sectionNum?' active':''}`}
                  onClick={()=>setActiveSection(sec.sectionNum)}>
                  Section {sec.sectionNum}
                  <span style={{marginLeft:5,fontSize:10,color:'inherit',opacity:.7}}>({sec.students.length})</span>
                </button>
              ))}
            </div>
          )}

          {/* The table */}
          {activeSec && (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11.5,minWidth:800}}>
                <thead>
                  {/* Group headers */}
                  <tr>
                    <th style={{...thStyle,background:'#D9D9D9',minWidth:36}} rowSpan={3}>S.NO</th>
                    <th style={{...thStyle,background:'#D9D9D9',minWidth:130}} rowSpan={3}>Roll No</th>
                    <th style={{...thStyle,background:'#D9D9D9',minWidth:200,textAlign:'left',paddingLeft:10}} rowSpan={3}>Name of the Student</th>
                    {theorySubs.length>0&&<th style={{...thStyle,background:'#D9E1F2'}} colSpan={theorySubs.length}>Theory</th>}
                    {electiveSubs.length>0&&<th style={{...thStyle,background:'#FFF2CC',fontSize:10}} colSpan={electiveSubs.length}>Prof. Elective-I</th>}
                    {labSubs.length>0&&<th style={{...thStyle,background:'#E2EFDA'}} colSpan={labSubs.length}>Practicals</th>}
                    <th style={{...thStyle,background:'#FCE4D6'}} rowSpan={3}>Total</th>
                    <th style={{...thStyle,background:'#D9D9D9',fontSize:10}} rowSpan={3}>Activity<br/>Points</th>
                  </tr>
                  {/* Subject codes */}
                  <tr>
                    {theorySubs.map(s=><th key={s._id} style={{...thStyle,background:'#D9E1F2',fontSize:10}}>{s.code}</th>)}
                    {electiveSubs.map(s=><th key={s._id} style={{...thStyle,background:'#FFF2CC',fontSize:10}}>{s.code}</th>)}
                    {labSubs.map(s=><th key={s._id} style={{...thStyle,background:'#E2EFDA',fontSize:10}}>{s.code}</th>)}
                  </tr>
                  {/* Subject names + max */}
                  <tr>
                    {subjects.map(s=>(
                      <th key={s._id} style={{...thStyle,background:s.type==='theory'?'#D9E1F2':s.type==='elective'?'#FFF2CC':'#E2EFDA',fontSize:9,fontWeight:400}}>
                        <div style={{fontWeight:600}}>{s.name.length>8?s.name.slice(0,7)+'.':s.name}</div>
                        <div style={{opacity:.7}}>/{s.maxMarks}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSec.students.map((student, idx) => {
                    const even = idx%2===1;
                    const bg   = even?'#F2F2F2':'#fff';
                    return (
                      <tr key={student.usn}>
                        <td style={{...tdStyle,background:bg,textAlign:'center'}}>{idx+1}</td>
                        <td style={{...tdStyle,background:bg,fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,textAlign:'center'}}>{student.usn}</td>
                        <td style={{...tdStyle,background:bg,textAlign:'left',paddingLeft:10,fontWeight:500}}>{student.name}</td>
                        {subjects.map(sub=>(
                          <td key={sub._id} style={{
                            ...tdStyle,
                            background:student.marks[sub._id]!=null?bg:(even?'#F9F0E0':'#FDF8EE'),
                            textAlign:'center',
                            fontFamily:"'JetBrains Mono',monospace",
                            color: student.marks[sub._id]!=null?'var(--text)':'var(--text4)'
                          }}>
                            {student.marks[sub._id]??'—'}
                          </td>
                        ))}
                        <td style={{...tdStyle,background:'#FCE4D6',textAlign:'center',fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:'var(--brand-d)'}}>
                          {student.total||'—'}
                        </td>
                        <td style={{...tdStyle,background:bg,textAlign:'center'}}>
                          {student.activityPoints??'—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Download bar */}
          <div style={{padding:'12px 20px',background:'var(--surface2)',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
            <p style={{fontSize:12,color:'var(--text2)'}}>
              <strong>{preview.sections.reduce((s,sec)=>s+sec.students.length,0)}</strong> students ·{' '}
              <strong>{subjects.length}</strong> subjects ·{' '}
              <strong>{preview.sections.length}</strong> section{preview.sections.length>1?'s':''} ·{' '}
              Activity Points column requires manual entry after download
            </p>
            <button className="btn btn-mint" onClick={download} disabled={downloading} style={{gap:8}}>
              {downloading?<Spinner/>:<><Download size={14}/> Download Excel (.xlsx)</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding:'7px 6px', border:'1px solid #ccc',
  fontFamily:"'Inter',sans-serif", fontWeight:700,
  fontSize:10.5, textAlign:'center',
  verticalAlign:'middle', lineHeight:1.3,
};
const tdStyle = {
  padding:'6px 5px', border:'1px solid #ddd',
  fontSize:11.5, verticalAlign:'middle', lineHeight:1.3,
};



/* ── STUDENT LIST PAGE ───────────────────────────────────────────────────── */
function StudentListPage() {
  const { user } = useAuth();
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [program,  setProgram]  = useState(myPrograms[0]);
  const [semester, setSemester] = useState('');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { program };
      if (semester) params.semester = semester;
      const { data: d } = await api.get('/api/admin/student-list', { params });
      setData(d);
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const downloadExcel = () => {
    if (!data) return;
    const XLSX = require('xlsx');
    const wb   = XLSX.utils.book_new();
    data.sections.forEach(sec => {
      const rows = [
        [`Section ${sec.section} — ${program} Sem ${semester || 'All'}`],
        [`Total Students: ${sec.count}`],
        [],
        ['S.No', 'Roll No', 'Name', 'Program', 'Semester', 'Lab Batch', 'Mentoring Batch', 'Status']
      ];
      sec.students.forEach((s,i) => rows.push([
        i+1, s.usn, s.name, s.program, s.semester,
        s.labBatch, s.mentoringBatch, s.status
      ]));
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [4,18,30,10,8,10,14,14].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws, `Sec ${sec.section}`.slice(0,31));
    });
    XLSX.writeFile(wb, `${user?.department}_Sem${semester||'All'}_Students.xlsx`);
  };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Student List</h2>
          <p className="a-page-sub">Section-wise student list with roll numbers</p>
        </div>
        {data && (
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-white" onClick={downloadExcel}><Download size={13}/> Download Excel</button>
          </div>
        )}
      </div>

      <div className="a-card">
        <div className="a-form">
          <div className="a-form-row" style={{maxWidth:420}}>
            <AField label="Program">
              <select className="input" value={program} onChange={e=>setProgram(e.target.value)}>
                {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </AField>
            <AField label="Semester (optional)">
              <select className="input" value={semester} onChange={e=>setSemester(e.target.value)}>
                <option value="">All Semesters</option>
                {['1','2','3','4','5','6','7','8'].map(s=><option key={s} value={s}>Sem {s}</option>)}
              </select>
            </AField>
          </div>
          <button className="btn btn-brand btn-sm" onClick={load} disabled={loading} style={{alignSelf:'flex-start'}}>
            {loading?<Spinner/>:'Load Student List'}
          </button>
        </div>
      </div>

      {data && (
        <>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <div className="a-stat" style={{flex:'0 0 auto',padding:'14px 20px'}}>
              <div className="a-stat__body">
                <div className="a-stat__val" style={{color:'var(--brand)'}}>{data.total}</div>
                <div className="a-stat__lbl">Total Students</div>
              </div>
            </div>
            {data.sections.map(sec=>(
              <div key={sec.section} className="a-stat" style={{flex:'0 0 auto',padding:'14px 20px'}}>
                <div className="a-stat__body">
                  <div className="a-stat__val" style={{color:'var(--blue)'}}>{sec.count}</div>
                  <div className="a-stat__lbl">Section {sec.section}</div>
                  <div className="a-stat__sub">{sec.students.filter(s=>s.isDetained).length} detained</div>
                </div>
              </div>
            ))}
          </div>

          {data.sections.map(sec=>(
            <div key={sec.section} className="a-card a-card--table fade-up">
              <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10}}>
                <h3 className="a-card__title">Section {sec.section}</h3>
                <span className="a-count-badge">{sec.count}</span>
                {sec.students.filter(s=>s.isDetained).length>0&&(
                  <span className="a-count-badge a-count-badge--red">{sec.students.filter(s=>s.isDetained).length} detained</span>
                )}
              </div>
              <div className="a-table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th className="center">Sem</th>
                      <th className="center">Lab Batch</th>
                      <th className="center">Mentor Batch</th>
                      <th className="center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.students.map((s,i)=>(
                      <tr key={s.usn} style={s.isDetained?{background:'#FEF2F2'}:{}}>
                        <td className="a-row-num">{i+1}</td>
                        <td><span className="mono" style={{fontSize:11.5}}>{s.usn}</span></td>
                        <td style={{fontWeight:s.isDetained?600:400}}>
                          {s.name}
                          {s.isDetained&&<span className="tag tag-red" style={{fontSize:9,marginLeft:6}}>DETAINED</span>}
                          {s.hasSupply&&!s.isDetained&&<span className="tag tag-amber" style={{fontSize:9,marginLeft:6}}>SUPPLY</span>}
                        </td>
                        <td className="center"><span className="tag tag-orange" style={{fontSize:10}}>{s.semester}</span></td>
                        <td className="center"><span className="mono" style={{fontSize:11}}>{s.labBatch}</span></td>
                        <td className="center"><span className="mono" style={{fontSize:11}}>{s.mentoringBatch||'—'}</span></td>
                        <td className="center">
                          <span className={`tag tag-${s.status==='Active'?'mint':s.status==='Detained'?'red':'amber'}`} style={{fontSize:10}}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ── MENTOR TASK PAGE ────────────────────────────────────────────────────── */
function MentorTaskPage() {
  const { user } = useAuth();
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [program,    setProgram]    = useState(myPrograms[0]);
  const [semester,   setSemester]   = useState('6');
  const [task,       setTask]       = useState(null);

  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [components, setComponents] = useState([
    { key:'activityPoints', label:'Activity Points', maxMarks:null, mandatory:true, description:'Mandatory every semester' }
  ]);




  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/mentor-task', { params:{ program, semester } });
      if (data) {
        setTask(data);
        setComponents(data.components||[]);

      } else {
        setTask(null);
        setComponents([{ key:'activityPoints', label:'Activity Points', maxMarks:25, mandatory:true, description:'' }]);
        setAssignments([{ teacher:'', sections:'' }]);
      }
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        program, semester: Number(semester),
        components: components.filter(c=>c.label&&c.maxMarks),

      };
      const { data } = await api.post('/api/admin/mentor-task', body);
      setTask(data);
      toast.success('Mentor task saved!');
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const delTask = async () => {
    if (!window.confirm('Remove this mentor task configuration?')) return;
    try {
      await api.delete('/api/admin/mentor-task', { params:{ program, semester } });
      setTask(null); toast.success('Removed');
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
  };

  const addComponent = () => setComponents([...components, { key:`custom_${Date.now()}`, label:'', maxMarks:25, mandatory:false, description:'' }]);
  const updateComp = (i,field,val) => { const a=[...components]; a[i]={...a[i],[field]:val}; setComponents(a); };
  const removeComp = i => setComponents(components.filter((_,j)=>j!==i));

  const PRESET_COMPONENTS = [
    { key:'internship',    label:'Internship',            maxMarks:25 },
    { key:'upskilling',    label:'Upskilling / MOOC',     maxMarks:25 },
    { key:'miniProject',   label:'Mini Project',          maxMarks:25 },
    { key:'seminarReport', label:'Seminar Report',        maxMarks:25 },
    { key:'industryVisit', label:'Industry Visit Report', maxMarks:25 },
  ];

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Mentor Task Configuration</h2>
          <p className="a-page-sub">Tell mentors what marks to collect this semester</p>
        </div>
      </div>

      {/* Selector */}
      <div className="a-card">
        <div className="a-form">
          <div className="a-form-row" style={{maxWidth:400}}>
            <AField label="Program">
              <select className="input" value={program} onChange={e=>setProgram(e.target.value)}>
                {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </AField>
            <AField label="Semester">
              <select className="input" value={semester} onChange={e=>setSemester(e.target.value)}>
                {['1','2','3','4','5','6','7','8'].map(s=><option key={s} value={s}>Semester {s}</option>)}
              </select>
            </AField>
          </div>
          <button className="btn btn-white btn-sm" onClick={load} disabled={loading} style={{alignSelf:'flex-start'}}>
            {loading?<Spinner/>:'Load Configuration'}
          </button>
        </div>
      </div>

      {/* Components */}
      <div className="a-card fade-up">
        <div className="a-card__hdr">
          <h3 className="a-card__title">Mark Components for Sem {semester}</h3>
          {task && <span className="tag tag-mint" style={{fontSize:10}}>✓ Configured</span>}
        </div>
        <p className="a-card__sub" style={{marginBottom:14}}>
          Activity Points is always mandatory. Add other components that apply this semester (internship, upskilling etc).
        </p>

        {/* Preset buttons */}
        <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:14}}>
          <span style={{fontSize:12,color:'var(--text2)',alignSelf:'center'}}>Quick add:</span>
          {PRESET_COMPONENTS.filter(p=>!components.find(c=>c.key===p.key)).map(p=>(
            <button key={p.key} className="btn btn-ghost btn-xs" onClick={()=>setComponents([...components,{...p,mandatory:false,description:''}])}>
              + {p.label}
            </button>
          ))}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
          {components.map((comp,i)=>(
            <div key={i} style={{display:'flex',gap:10,alignItems:'flex-end',padding:'12px',background:'var(--surface2)',borderRadius:'var(--r2)',border:'1px solid var(--border)'}}>
              <AField label="Component Name" style={{flex:2}}>
                <input className="input" placeholder="e.g. Internship" value={comp.label}
                  onChange={e=>updateComp(i,'label',e.target.value)} disabled={comp.key==='activityPoints'}/>
              </AField>
              <AField label="Max Marks" style={{width:100}}>
                <input className="input" type="number" min={1} max={100} value={comp.maxMarks}
                  onChange={e=>updateComp(i,'maxMarks',Number(e.target.value))} disabled={comp.key==='activityPoints'}/>
              </AField>
              <AField label="Description" style={{flex:3}}>
                <input className="input" placeholder="Optional notes for mentor"
                  value={comp.description} onChange={e=>updateComp(i,'description',e.target.value)}/>
              </AField>
              <div style={{display:'flex',alignItems:'center',gap:8,paddingBottom:2}}>
                <label style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--text2)',whiteSpace:'nowrap'}}>
                  <input type="checkbox" checked={comp.mandatory}
                    onChange={e=>updateComp(i,'mandatory',e.target.checked)}
                    disabled={comp.key==='activityPoints'}/>
                  Mandatory
                </label>
                {comp.key!=='activityPoints'&&(
                  <button className="a-action-btn a-action-btn--danger" onClick={()=>removeComp(i)}><X size={13}/></button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={addComponent} style={{alignSelf:'flex-start'}}>
          <Plus size={12}/> Add Custom Component
        </button>
      </div>



      {/* Actions */}
      <div style={{display:'flex',gap:10}}>
        <button className="btn btn-brand" onClick={save} disabled={saving}>
          {saving?<Spinner/>:'Save Mentor Task'}
        </button>
        {task&&<button className="btn btn-danger btn-sm" onClick={delTask}>Remove Task</button>}
      </div>

      {/* Info box */}
      <div className="alert alert-blue" style={{fontSize:12}}>
        <div>
          <strong>How this works:</strong><br/>
          1. Admin configures components here (e.g. Internship for Sem 6)<br/>
          2. This applies automatically to ALL mentors handling students in that semester<br/>
          3. Every mentor (for that semester) opens <strong>Mentor Entry</strong> — sees all their students + the configured components<br/>
          4. Teacher fills marks for all their mentees at once and saves<br/>
          5. Marks appear in Consolidated CIE sheet automatically
        </div>
      </div>
    </div>
  );
}

/* ── SHARED ADMIN COMPONENTS ─────────────────────────────────────────── */
function AField({ label, children, style: s }) {
  return (
    <div className="form-group" style={s}>
      {label && <label className="lbl">{label}</label>}
      {children}
    </div>
  );
}
function AdminLoader({ inline }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:inline?32:80}}>
      <Spinner size={inline?'sm':'lg'}/>
    </div>
  );
}
