import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Modal, Empty, Spinner } from '../../components/Layout';
import { Plus, Trash2, Users, ChevronDown, ChevronUp, CheckCircle, X, AlertTriangle } from 'lucide-react';

export default function ElectivesAdmin({ user }) {
  const myPrograms = user?.programs?.length ? user.programs : ['B.Tech'];
  const [program,  setProgram]  = useState(myPrograms[0]);
  const [semester, setSemester] = useState('4');
  const [groups,   setGroups]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [modal,    setModal]    = useState(null); // 'create' | 'summary:{id}'
  const [teachers, setTeachers] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/electives/admin/groups', { params:{ program, targetSemester: semester } });
      setGroups(data);
    } catch(err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [program, semester]);
  useEffect(() => {
    api.get('/api/admin/teachers').then(r => setTeachers(r.data)).catch(()=>{});
  }, []);

  const openReg   = async (id) => { try { await api.post(`/api/electives/admin/groups/${id}/open`);  toast.success('Registration opened!'); load(); } catch(e){ toast.error(e.response?.data?.message||'Failed'); } };
  const closeReg  = async (id) => { try { await api.post(`/api/electives/admin/groups/${id}/close`); toast.success('Registration closed');   load(); } catch(e){ toast.error(e.response?.data?.message||'Failed'); } };
  const deleteGrp = async (id) => {
    if (!window.confirm('Delete this elective group and all student preferences?')) return;
    try { await api.delete(`/api/electives/admin/groups/${id}`); toast.success('Deleted'); load(); }
    catch(e){ toast.error(e.response?.data?.message||'Failed'); }
  };

  const statusColor = { draft:'var(--text3)', open:'var(--mint)', closed:'var(--amber)', allotted:'var(--blue)' };
  const statusBg    = { draft:'var(--surface2)', open:'var(--mint-l)', closed:'var(--amber-l)', allotted:'var(--blue-l)' };

  return (
    <div className="a-page">
      <div className="a-page-header">
        <div>
          <h2 className="a-page-title">Elective Management</h2>
          <p className="a-page-sub">Create elective groups, manage student preferences, assign teachers</p>
        </div>
        <button className="btn btn-brand" onClick={() => setModal('create')}>
          <Plus size={13}/> Create Elective Group
        </button>
      </div>

      {/* Filters */}
      <div className="a-card">
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>Program:</label>
            <select className="input" style={{width:130}} value={program} onChange={e=>setProgram(e.target.value)}>
              {myPrograms.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>Semester:</label>
            <select className="input" style={{width:130}} value={semester} onChange={e=>setSemester(e.target.value)}>
              {['1','2','3','4','5','6','7','8'].map(s=><option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Groups list */}
      {loading ? <div style={{textAlign:'center',padding:40}}><Spinner/></div>
      : groups.length===0
        ? <Empty icon="📚" msg="No elective groups for this semester" sub="Create one to get started"/>
        : (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {groups.map(g => (
              <ElectiveGroupCard key={g._id} group={g}
                teachers={teachers}
                onOpen={()=>openReg(g._id)}
                onClose={()=>closeReg(g._id)}
                onDelete={()=>deleteGrp(g._id)}
                onSummary={()=>setModal(`summary:${g._id}`)}
                onRefresh={load}
              />
            ))}
          </div>
        )
      }

      {/* Create modal */}
      {modal==='create' && (
        <CreateGroupModal
          program={program} semester={semester}
          onClose={()=>setModal(null)}
          onSaved={()=>{ setModal(null); load(); }}
        />
      )}

      {/* Summary modal */}
      {modal?.startsWith('summary:') && (
        <SummaryModal
          groupId={modal.split(':')[1]}
          teachers={teachers}
          onClose={()=>setModal(null)}
          onDone={()=>{ setModal(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── Elective Group Card ─────────────────────────────────────────────── */
function ElectiveGroupCard({ group, teachers, onOpen, onClose, onDelete, onSummary, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [assignModal, setAssignModal] = useState(null);

  const sc = { draft:'var(--text3)', open:'var(--mint)', closed:'var(--amber)', allotted:'var(--blue)' };
  const sb = { draft:'var(--surface2)', open:'var(--mint-l)', closed:'var(--amber-l)', allotted:'var(--blue-l)' };

  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r3)',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
            <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15}}>{group.slotLabel}</span>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,color:sc[group.status],background:sb[group.status]}}>
              {group.status.toUpperCase()}
            </span>
            <span className="tag tag-gray" style={{fontSize:10}}>{group.slotType==='open'?'Open Elective':'Professional Elective'}</span>
          </div>
          <div style={{fontSize:12,color:'var(--text2)'}}>
            {group.subjects.length} options ·
            Reg: {new Date(group.registrationOpen).toLocaleDateString()} → {new Date(group.registrationClose).toLocaleDateString()}
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexShrink:0,flexWrap:'wrap'}}>
          {group.status==='draft'    && <button className="btn btn-mint btn-sm" onClick={onOpen}>Open Registration</button>}
          {group.status==='open'     && <button className="btn btn-white btn-sm" onClick={onClose}>Close Registration</button>}
          {group.status==='closed'   && <button className="btn btn-brand btn-sm" onClick={onSummary}><Users size={12}/> Review & Allot</button>}
          {group.status==='allotted' && <button className="btn btn-white btn-sm" onClick={onSummary}><Users size={12}/> View Results</button>}
          <button className="btn btn-ghost btn-xs" style={{color:'var(--red)'}} onClick={onDelete}><Trash2 size={12}/></button>
          <button className="btn btn-ghost btn-xs" onClick={()=>setExpanded(e=>!e)}>
            {expanded?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
          </button>
        </div>
      </div>

      {/* Subject list */}
      {expanded && (
        <div style={{borderTop:'1px solid var(--border)'}}>
          {group.subjects.map((sub,i) => (
            <div key={i} style={{
              padding:'12px 18px',
              borderBottom:i<group.subjects.length-1?'1px solid var(--border2)':'none',
              display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'
            }}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13}}>{sub.subjectName}
                  <span className="mono" style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>{sub.subjectCode}</span>
                  {sub.hasLab && <span className="tag tag-blue" style={{fontSize:9,marginLeft:6}}>+Lab</span>}
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>
                  Min enrollment: {sub.minEnrollment} ·
                  {sub.enrollmentCount>0 && <span style={{color:sub.enrollmentCount>=sub.minEnrollment?'var(--mint)':'var(--amber)',fontWeight:600}}> {sub.enrollmentCount} enrolled</span>}
                  {sub.status==='cancelled' && <span style={{color:'var(--red)',fontWeight:700}}> CANCELLED</span>}
                  {sub.status==='running'   && <span style={{color:'var(--mint)',fontWeight:700}}> RUNNING</span>}
                </div>
                {sub.assignments?.length>0 && (
                  <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>
                    Teachers: {sub.assignments.map(a=>`${a.teacher?.name||'?'} (${a.splitLabel})`).join(', ')}
                  </div>
                )}
              </div>
              {group.status==='closed' && sub.status!=='cancelled' && (
                <button className="btn btn-ghost btn-xs" onClick={()=>setAssignModal(sub)}>
                  Assign Teacher
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {assignModal && (
        <AssignTeacherModal
          group={group} subject={assignModal} teachers={teachers}
          onClose={()=>setAssignModal(null)}
          onSaved={()=>{ setAssignModal(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

/* ── Create Group Modal ──────────────────────────────────────────────── */
function CreateGroupModal({ program, semester, onClose, onSaved }) {
  const [form, setForm] = useState({
    slotLabel:       'Professional Elective – I',
    slotType:        'professional',
    currentSemester: String(Number(semester)-1 > 0 ? Number(semester)-1 : 1),
    targetSemester:  semester,
    registrationOpen:  '',
    registrationClose: '',
    subjects: [
      { subjectCode:'', subjectName:'', hasLab:false, labCode:'', labName:'', minEnrollment:5 }
    ]
  });
  const [saving, setSaving] = useState(false);

  const addSubject = () => setForm(f=>({...f, subjects:[...f.subjects,{subjectCode:'',subjectName:'',hasLab:false,labCode:'',labName:'',minEnrollment:5}]}));
  const removeSubject = i => setForm(f=>({...f, subjects:f.subjects.filter((_,j)=>j!==i)}));
  const updateSubject = (i,field,val) => {
    const s=[...form.subjects]; s[i]={...s[i],[field]:val};
    setForm(f=>({...f,subjects:s}));
  };

  const save = async () => {
    if (!form.registrationOpen||!form.registrationClose) { toast.error('Set registration window'); return; }
    if (form.subjects.some(s=>!s.subjectCode||!s.subjectName)) { toast.error('Fill all subject details'); return; }
    setSaving(true);
    try {
      await api.post('/api/electives/admin/groups', { ...form, program });
      toast.success('Elective group created!');
      onSaved();
    } catch(e){ toast.error(e.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const SLOT_PRESETS = [
    'Professional Elective – I','Professional Elective – II','Professional Elective – III',
    'Professional Elective – IV','Professional Elective – V','Professional Elective – VI',
    'Open Elective – 1','Open Elective – 2','Open Elective – 3',
  ];

  return (
    <Modal open onClose={onClose} title="Create Elective Group" width={680}>
      <div style={{display:'flex',flexDirection:'column',gap:14,maxHeight:'75vh',overflowY:'auto',paddingRight:4}}>
        <div className="g2">
          <div className="form-group">
            <label className="lbl">Students Currently In (Sem) *</label>
            <select className="input" value={form.currentSemester}
              onChange={e=>setForm(f=>({...f,currentSemester:e.target.value,targetSemester:String(Number(e.target.value)+1)}))}>
              {['1','2','3','4','5','6','7'].map(s=><option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="lbl">Registering For (Sem) *</label>
            <input className="input" value={`Semester ${form.targetSemester}`} readOnly
              style={{background:'var(--surface2)',color:'var(--text2)'}}/>
          </div>
        </div>
        <div className="g2">
          <div className="form-group" style={{flex:2}}>
            <label className="lbl">Slot Label *</label>
            <select className="input" value={form.slotLabel}
              onChange={e=>setForm(f=>({...f,slotLabel:e.target.value,slotType:e.target.value.toLowerCase().includes('open')?'open':'professional'}))}>
              {SLOT_PRESETS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="lbl">Type</label>
            <select className="input" value={form.slotType} onChange={e=>setForm(f=>({...f,slotType:e.target.value}))}>
              <option value="professional">Professional</option>
              <option value="open">Open</option>
            </select>
          </div>
        </div>

        <div className="g2">
          <div className="form-group">
            <label className="lbl">Registration Opens *</label>
            <input className="input" type="datetime-local" value={form.registrationOpen}
              onChange={e=>setForm(f=>({...f,registrationOpen:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="lbl">Registration Closes *</label>
            <input className="input" type="datetime-local" value={form.registrationClose}
              onChange={e=>setForm(f=>({...f,registrationClose:e.target.value}))}/>
          </div>
        </div>

        {/* Subjects */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14}}>
              Subject Options ({form.subjects.length})
            </span>
            <button className="btn btn-ghost btn-sm" onClick={addSubject}><Plus size={12}/> Add Subject</button>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {form.subjects.map((sub,i)=>(
              <div key={i} style={{padding:'12px',background:'var(--surface2)',borderRadius:'var(--r2)',border:'1px solid var(--border)'}}>
                <div className="g2" style={{marginBottom:8}}>
                  <div className="form-group">
                    <label className="lbl" style={{fontSize:11}}>Subject Code *</label>
                    <input className="input" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}
                      placeholder="22ITE07" value={sub.subjectCode}
                      onChange={e=>updateSubject(i,'subjectCode',e.target.value.toUpperCase())}/>
                  </div>
                  <div className="form-group" style={{flex:2}}>
                    <label className="lbl" style={{fontSize:11}}>Subject Name *</label>
                    <input className="input" placeholder="Cloud Computing" value={sub.subjectName}
                      onChange={e=>updateSubject(i,'subjectName',e.target.value)}/>
                  </div>
                  <div className="form-group" style={{width:90}}>
                    <label className="lbl" style={{fontSize:11}}>Min Students</label>
                    <input className="input" type="number" min={1} value={sub.minEnrollment}
                      onChange={e=>updateSubject(i,'minEnrollment',Number(e.target.value))}/>
                  </div>
                  <button className="a-action-btn a-action-btn--danger" style={{marginTop:20}}
                    onClick={()=>removeSubject(i)}><X size={13}/></button>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,cursor:'pointer'}}>
                  <input type="checkbox" checked={sub.hasLab}
                    onChange={e=>updateSubject(i,'hasLab',e.target.checked)}/>
                  This subject has a paired Lab
                </label>
                {sub.hasLab && (
                  <div className="g2" style={{marginTop:8}}>
                    <input className="input" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}
                      placeholder="Lab Code e.g. 22ITE26" value={sub.labCode}
                      onChange={e=>updateSubject(i,'labCode',e.target.value.toUpperCase())}/>
                    <input className="input" placeholder="Lab Name e.g. Computer Vision Lab"
                      value={sub.labName} onChange={e=>updateSubject(i,'labName',e.target.value)}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="alert alert-blue" style={{fontSize:12}}>
          Students will see all subject options and submit 1st, 2nd, 3rd preference.
          After registration closes, you review counts and allot — subjects with fewer than
          minimum students can be cancelled.
        </div>

        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-brand" onClick={save} disabled={saving}>{saving?<Spinner/>:'Create Group'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Assign Teacher Modal ─────────────────────────────────────────────── */
function AssignTeacherModal({ group, subject, teachers, onClose, onSaved }) {
  const [assignments, setAssignments] = useState([
    { teacherId:'', splitLabel:'A', studentRange:'' }
  ]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      for (const a of assignments) {
        if (!a.teacherId) continue;
        await api.post(`/api/electives/admin/groups/${group._id}/assign-teacher`, {
          subjectCode: subject.subjectCode,
          teacherId:   a.teacherId,
          splitLabel:  a.splitLabel,
          studentIds:  [], // will be set during allotment
        });
      }
      toast.success('Teacher(s) assigned!');
      onSaved();
    } catch(e){ toast.error(e.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={`Assign Teacher — ${subject.subjectName}`} width={540}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div className="alert alert-blue" style={{fontSize:12}}>
          If enrollment is large, assign two teachers (Split A and Split B).
          Student split will be done during allotment.
        </div>

        {assignments.map((a,i)=>(
          <div key={i} style={{padding:'12px',background:'var(--surface2)',borderRadius:'var(--r2)',border:'1px solid var(--border)'}}>
            <div className="g2">
              <div className="form-group" style={{flex:2}}>
                <label className="lbl">Teacher</label>
                <select className="input" value={a.teacherId}
                  onChange={e=>{ const arr=[...assignments]; arr[i]={...arr[i],teacherId:e.target.value}; setAssignments(arr); }}>
                  <option value="">— Select Teacher —</option>
                  {teachers.map(t=><option key={t._id} value={t._id}>{t.name} ({t.designation})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="lbl">Split Label</label>
                <select className="input" value={a.splitLabel}
                  onChange={e=>{ const arr=[...assignments]; arr[i]={...arr[i],splitLabel:e.target.value}; setAssignments(arr); }}>
                  <option value="A">A (only / first group)</option>
                  <option value="B">B (second group)</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        {assignments.length < 2 && (
          <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-start'}}
            onClick={()=>setAssignments([...assignments,{teacherId:'',splitLabel:'B',studentRange:''}])}>
            <Plus size={12}/> Add Second Teacher (Split)
          </button>
        )}

        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-brand" onClick={save} disabled={saving}>{saving?<Spinner/>:'Save'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Summary + Allotment Modal ────────────────────────────────────────── */
function SummaryModal({ groupId, teachers, onClose, onDone }) {
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(true);
  const [allotments, setAllotments] = useState({}); // { choiceId: subjectCode }
  const [cancelling, setCancelling] = useState({});
  const [saving,   setSaving]  = useState(false);

  useEffect(() => {
    api.get(`/api/electives/admin/groups/${groupId}/summary`)
      .then(r => {
        setData(r.data);
        // Pre-fill allotments with pref1
        const init = {};
        r.data.summary.forEach(sub => {
          sub.students.forEach(s => {
            if (s.allotted) init[s.choiceId] = s.allotted;
            else             init[s.choiceId] = sub.subjectCode;
          });
        });
        setAllotments(init);
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  const finalize = async () => {
    setSaving(true);
    try {
      const allotArr = Object.entries(allotments)
        .filter(([,code]) => !cancelling[code])
        .map(([choiceId, subjectCode]) => {
          const sub = data.summary.find(s=>s.subjectCode===subjectCode);
          return { choiceId, subjectCode, subjectName: sub?.subjectName||'', splitLabel:'' };
        });
      const cancelArr = Object.keys(cancelling).filter(k=>cancelling[k]);

      await api.post(`/api/electives/admin/groups/${groupId}/allot`, {
        allotments: allotArr,
        cancelSubjects: cancelArr,
      });
      toast.success('Allotments finalized! Students can see their results.');
      onDone();
    } catch(e){ toast.error(e.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  if (loading) return <Modal open onClose={onClose} title="Enrollment Summary"><div style={{textAlign:'center',padding:40}}><Spinner/></div></Modal>;

  const { group, summary, notSubmitted, totalChoices } = data || {};
  const allSubjectCodes = summary?.map(s=>s.subjectCode)||[];

  return (
    <Modal open onClose={onClose} title={`Enrollment Summary — ${group?.slotLabel}`} width={900}>
      <div style={{display:'flex',flexDirection:'column',gap:16,maxHeight:'80vh',overflowY:'auto'}}>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          {[
            { val: totalChoices,            lbl:'Total Submitted',   color:'var(--brand)' },
            { val: notSubmitted?.length||0, lbl:'Not Submitted',     color:'var(--amber)' },
            { val: summary?.length||0,      lbl:'Subject Options',   color:'var(--blue)'  },
          ].map(s=>(
            <div key={s.lbl} style={{padding:'14px',background:'var(--surface2)',borderRadius:'var(--r2)',textAlign:'center',border:'1px solid var(--border)'}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:26,fontWeight:800,color:s.color}}>{s.val}</div>
              <div style={{fontSize:11,color:'var(--text3)'}}>{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Not submitted */}
        {notSubmitted?.length>0 && (
          <div className="alert alert-amber" style={{fontSize:12}}>
            <strong>⚠ {notSubmitted.length} students haven't submitted preferences:</strong>{' '}
            {notSubmitted.map(s=>s.name).join(', ')}
          </div>
        )}
        {data?.detainedSubmitted?.length>0 && (
          <div className="alert alert-red" style={{fontSize:12}}>
            <strong>🚫 {data.detainedSubmitted.length} detained students submitted preferences — they will be auto-excluded from allotment:</strong>{' '}
            {data.detainedSubmitted.map(s=>s.name).join(', ')}
          </div>
        )}

        {/* Per-subject breakdown */}
        {summary?.map(sub => (
          <div key={sub.subjectCode} style={{
            border:'1px solid var(--border)',borderRadius:'var(--r3)',overflow:'hidden',
            opacity: cancelling[sub.subjectCode] ? 0.5 : 1
          }}>
            <div style={{
              padding:'12px 16px',
              background:sub.enrollmentCount>=sub.minEnrollment?'var(--mint-l)':'var(--amber-l)',
              display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'
            }}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{sub.subjectName}
                  <span className="mono" style={{fontSize:11,color:'var(--text3)',marginLeft:8}}>{sub.subjectCode}</span>
                  {sub.hasLab && <span className="tag tag-blue" style={{fontSize:9,marginLeft:6}}>+Lab</span>}
                </div>
                <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>
                  <strong style={{color:sub.enrollmentCount>=sub.minEnrollment?'var(--mint-d)':'var(--amber-d)'}}>
                    {sub.enrollmentCount} chose as 1st preference
                  </strong>
                  {' '} · {sub.pref2Count} as 2nd · {sub.pref3Count} as 3rd
                  {' '} · Min required: {sub.minEnrollment}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                {sub.enrollmentCount < sub.minEnrollment && (
                  <span style={{fontSize:11,color:'var(--amber-d)',fontWeight:700}}>⚠ Below minimum</span>
                )}
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
                  <input type="checkbox" checked={!!cancelling[sub.subjectCode]}
                    onChange={e=>setCancelling(c=>({...c,[sub.subjectCode]:e.target.checked}))}/>
                  Cancel this subject
                </label>
              </div>
            </div>

            {/* Student list with re-allot option */}
            {sub.students.length>0 && (
              <div style={{maxHeight:220,overflowY:'auto'}}>
                <table className="tbl">
                  <thead>
                    <tr><th>#</th><th>Roll No</th><th>Name</th><th className="center">Section</th><th>Allot To</th></tr>
                  </thead>
                  <tbody>
                    {sub.students.map((s,i)=>(
                      <tr key={s.choiceId}>
                        <td style={{color:'var(--text3)',fontSize:11}}>{i+1}</td>
                        <td><span className="mono" style={{fontSize:11.5}}>{s.usn}</span></td>
                        <td style={{fontWeight:500,fontSize:13}}>
                          {s.name}
                          {s.isDetained && <span className="tag tag-red" style={{fontSize:9,marginLeft:5}}>DETAINED</span>}
                        </td>
                        <td className="center"><span className="tag tag-blue" style={{fontSize:10}}>Sec {s.section}</span></td>
                        <td>
                          <select style={{fontSize:12,padding:'3px 6px',border:'1px solid var(--border)',
                            borderRadius:'var(--r1)',background:'var(--surface)'}}
                            value={allotments[s.choiceId]||sub.subjectCode}
                            onChange={e=>setAllotments(a=>({...a,[s.choiceId]:e.target.value}))}>
                            {allSubjectCodes.filter(c=>!cancelling[c]).map(code=>(
                              <option key={code} value={code}>{code}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {group?.status !== 'allotted' && (
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button className="btn btn-mint" onClick={finalize} disabled={saving}>
              {saving?<Spinner/>:<><CheckCircle size={13}/> Finalize Allotments</>}
            </button>
            <p style={{fontSize:12,color:'var(--text3)'}}>
              Students will immediately see their allotted elective. This cannot be undone.
            </p>
          </div>
        )}
        {group?.status === 'allotted' && (
          <div className="alert alert-mint" style={{fontSize:12}}>
            ✓ Allotments have been finalized. Students can see their results.
          </div>
        )}
      </div>
    </Modal>
  );
}
