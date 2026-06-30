import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Modal, Empty, Spinner } from '../../components/Layout';
import {
  Plus, Trash2, Download, Users, Link,
  FileText, CheckCircle, Clock, ExternalLink, Upload
} from 'lucide-react';

const inlineUrl = (url, fileName) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  const ext = (fileName || url).split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    if (url.includes('fl_attachment')) return url;
    return url.replace('/upload/', '/upload/fl_attachment:false/');
  }
  const safe = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (url.includes('fl_attachment')) return url;
  return url.replace('/upload/', `/upload/fl_attachment:${safe}/`);
};

export default function TeacherAssignmentsPage() {
  const [subjects,    setSubjects]    = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filterSub,   setFilterSub]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [subsModal,   setSubsModal]   = useState(null);
  const [subsData,    setSubsData]    = useState(null);
  const [subsLoading, setSubsLoading] = useState(false);

  useEffect(() => {
    api.get('/api/teacher/my-subjects').then(r => setSubjects(r.data)).catch(() => {});
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/teacher/assignments'); setAssignments(data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openSubs = async (a) => {
    setSubsModal(a); setSubsLoading(true); setSubsData(null);
    try { const { data } = await api.get(`/api/teacher/assignments/${a._id}/submissions`); setSubsData(data); }
    catch { toast.error('Failed'); }
    finally { setSubsLoading(false); }
  };

  const markOffline = async (assignmentId, studentId, received) => {
    try { await api.post(`/api/teacher/assignments/${assignmentId}/mark-offline`, { studentId, received }); openSubs(subsModal); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this post and all its submissions?')) return;
    try { await api.delete(`/api/teacher/assignments/${id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  const filtered = filterSub ? assignments.filter(a => a.subject?._id === filterSub) : assignments;
  const asgns = filtered.filter(a => a.type === 'assignment');
  const slips = filtered.filter(a => a.type === 'sliptest');

  return (
    <div className="asgn-page">
      <div className="asgn-header">
        <div>
          <h2 className="asgn-title">Assignments & Slip Tests</h2>
          <p className="asgn-sub">Post work and Google Form links for your subjects</p>
        </div>
        <button className="btn btn-brand" onClick={() => setModal(true)}>
          <Plus size={14}/> Post Assignment
        </button>
      </div>

      {/* Subject filter */}
      {subjects.length > 1 && (
        <div className="asgn-filters">
          <button className={`asgn-pill${!filterSub ? ' asgn-pill--active' : ''}`} onClick={() => setFilterSub('')}>
            All Subjects
          </button>
          {subjects.map(s => (
            <button key={s._id}
              className={`asgn-pill${filterSub === s._id ? ' asgn-pill--active' : ''}`}
              onClick={() => setFilterSub(s._id)}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:60}}><Spinner size="lg"/></div>
      ) : filtered.length === 0 ? (
        <Empty icon="📝" msg="No assignments posted yet" sub="Click Post Assignment to get started"/>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:24}}>
          {asgns.length > 0 && (
            <div>
              <div className="asgn-section-label">
                📝 Assignments
                <span className="tag tag-orange" style={{fontSize:10}}>{asgns.length}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {asgns.map(a => <ACard key={a._id} a={a} onView={() => openSubs(a)} onDelete={() => del(a._id)}/>)}
              </div>
            </div>
          )}
          {slips.length > 0 && (
            <div>
              <div className="asgn-section-label">
                📋 Slip Tests
                <span className="tag tag-blue" style={{fontSize:10}}>{slips.length}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {slips.map(a => <ACard key={a._id} a={a} onView={() => openSubs(a)} onDelete={() => del(a._id)}/>)}
              </div>
            </div>
          )}
        </div>
      )}

      <PostAssignmentModal open={modal} onClose={() => setModal(false)} subjects={subjects}
        onSaved={() => { setModal(false); load(); }}/>

      {subsModal && (
        <Modal open={!!subsModal} onClose={() => setSubsModal(null)}
          title={`Submissions — ${subsModal.title}`} width={740}>
          {subsLoading
            ? <div style={{textAlign:'center',padding:32}}><Spinner/></div>
            : subsData ? <SubmissionsView data={subsData} onMarkOffline={markOffline}/> : null
          }
        </Modal>
      )}
    </div>
  );
}

function ACard({ a, onView, onDelete }) {
  const isOverdue = a.dueDate && new Date() > new Date(a.dueDate);
  const isSlip    = a.type === 'sliptest';
  const label     = isSlip ? `Slip Test ${a.slotNo}` : `Assignment ${a.slotNo}`;
  const modeColor = { online:'tag-mint', offline:'tag-gray', mixed:'tag-blue' };
  const variant   = isSlip ? 'asgn-card--slip' : isOverdue ? 'asgn-card--overdue' : 'asgn-card--pending';

  return (
    <div className={`asgn-card ${variant}`}>
      <div className="asgn-card-icon" style={{background:isSlip?'var(--blue-l)':'var(--brand-l)'}}>
        {isSlip ? '📋' : '📝'}
      </div>
      <div className="asgn-card-body">
        <div className="asgn-card-title">
          {a.title}
          <span className={`tag ${isSlip?'tag-blue':'tag-orange'}`} style={{fontSize:10}}>{label}</span>
          {!isSlip && a.mode && <span className={`tag ${modeColor[a.mode]||'tag-gray'}`} style={{fontSize:10}}>{a.mode}</span>}
          {isOverdue && <span className="tag tag-red" style={{fontSize:10}}>Overdue</span>}
        </div>
        <p className="asgn-card-meta">
          {a.subject?.name} ({a.subject?.code}) · Sem {a.subject?.semester}
          {a.dueDate && <span> · Due {new Date(a.dueDate).toLocaleDateString()}</span>}
        </p>
        <div className="asgn-card-links">
          {isSlip && a.formLink && (
            <a href={a.formLink} target="_blank" rel="noreferrer" className="btn btn-white btn-xs" style={{textDecoration:'none'}}>
              <Link size={11}/> Form Link
            </a>
          )}
          {a.attachmentUrl && (
            <a href={inlineUrl(a.attachmentUrl,a.attachmentName)} target="_blank" rel="noreferrer"
              className="btn btn-white btn-xs" style={{textDecoration:'none'}}>
              <FileText size={11}/> Question Paper
            </a>
          )}
        </div>
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
        {a.type === 'assignment' && (
          <button className="btn btn-white btn-sm" onClick={onView}><Users size={13}/> Submissions</button>
        )}
        <button className="btn btn-ghost btn-xs" onClick={onDelete} style={{color:'var(--red)'}}><Trash2 size={13}/></button>
      </div>
    </div>
  );
}

function SubmissionsView({ data, onMarkOffline }) {
  const { assignment, result, stats } = data;
  const statItems = [
    { label:'Total',         val:stats.total,       color:'var(--text)',  bg:'var(--surface2)' },
    { label:'Online',        val:stats.online,      color:'var(--mint)',  bg:'var(--mint-l)'   },
    { label:'Offline',       val:stats.offline,     color:'var(--blue)',  bg:'var(--blue-l)'   },
    { label:'Not submitted', val:stats.notSubmitted,color:'var(--red)',   bg:'var(--red-l)'    },
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div className="asgn-stats">
        {statItems.map(s => (
          <div key={s.label} className="asgn-stat" style={{background:s.bg}}>
            <div className="asgn-stat-val" style={{color:s.color}}>{s.val}</div>
            <div className="asgn-stat-lbl" style={{color:s.color,opacity:.75}}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{border:'1px solid var(--border)',borderRadius:'var(--r3)',overflow:'hidden',maxHeight:420}}>
        <div style={{overflowY:'auto',maxHeight:420}}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Student</th><th className="center">Status</th>
                <th className="center">Method</th><th>File</th><th className="center">Action</th>
              </tr>
            </thead>
            <tbody>
              {result.map((r,i) => {
                const s = r.submission;
                return (
                  <tr key={r.student.id}>
                    <td style={{color:'var(--text3)',fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</td>
                    <td>
                      <div style={{fontWeight:500,fontSize:13.5}}>{r.student.name}</div>
                      <span className="mono" style={{fontSize:11,color:'var(--text3)'}}>{r.student.usn}</span>
                    </td>
                    <td className="center">
                      {s
                        ? <span className={`tag ${s.isLate?'tag-amber':'tag-mint'}`} style={{fontSize:10}}>{s.isLate?'Late':'✓ Submitted'}</span>
                        : <span className="tag tag-red" style={{fontSize:10}}>Pending</span>
                      }
                    </td>
                    <td className="center">
                      {s?.method==='online'  && <span className="tag tag-mint" style={{fontSize:10}}>Online</span>}
                      {s?.method==='offline' && <span className="tag tag-blue" style={{fontSize:10}}>Offline</span>}
                      {!s && <span style={{color:'var(--text4)'}}>—</span>}
                    </td>
                    <td>
                      {s?.method==='online' && s.fileUrl
                        ? <a href={inlineUrl(s.fileUrl,s.fileName)} target="_blank" rel="noreferrer"
                            className="btn btn-white btn-xs" style={{textDecoration:'none'}}>
                            <Download size={11}/> {s.fileName?.slice(0,18)||'Download'}
                          </a>
                        : <span style={{color:'var(--text4)'}}>—</span>
                      }
                    </td>
                    <td className="center">
                      {(!s||s.method==='offline') && (
                        <button className={`btn btn-xs ${s?.method==='offline'?'btn-ghost':'btn-mint'}`}
                          style={s?.method==='offline'?{color:'var(--red)'}:{}}
                          onClick={()=>onMarkOffline(assignment._id,r.student.id,!s)}>
                          {s?.method==='offline'?'Unmark':'✓ Received'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PostAssignmentModal({ open, onClose, subjects, onSaved, prefill={} }) {
  const fileRef = useRef();
  const [form, setForm] = useState({
    subjectId:'', type:'assignment', slotNo:'1',
    title:'', description:'', dueDate:'', mode:'mixed', formLink:'', ...prefill
  });
  const [saving, setSaving] = useState(false);
  const [file,   setFile]   = useState(null);

  useEffect(()=>{ setForm(f=>({...f,...prefill})); setFile(null); },[prefill.subjectId,prefill.type,prefill.slotNo]);

  const set = e => setForm({...form,[e.target.name]:e.target.value});
  const isSlip = form.type === 'sliptest';

  const save = async e => {
    e.preventDefault();
    if (!form.subjectId) { toast.error('Select a subject'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v])=>{ if(v) fd.append(k,v); });
      if (file) fd.append('attachment', file);
      await api.post('/api/teacher/assignments', fd, { headers:{'Content-Type':'multipart/form-data'} });
      toast.success('Posted!'); setFile(null); onSaved();
    } catch(err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={isSlip?'Post Slip Test Link':'Post Assignment'}>
      <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:14}}>
        {!prefill.subjectId && (
          <div className="form-group">
            <label className="lbl">Subject *</label>
            <select className="input" name="subjectId" value={form.subjectId} onChange={set} required>
              <option value="">Select subject</option>
              {subjects.map(s=><option key={s._id} value={s._id}>{s.name} ({s.code}) · Sem {s.semester}</option>)}
            </select>
          </div>
        )}
        <div className="g2">
          {!prefill.type && (
            <div className="form-group">
              <label className="lbl">Type</label>
              <select className="input" name="type" value={form.type} onChange={set}>
                <option value="assignment">Assignment</option>
                <option value="sliptest">Slip Test</option>
              </select>
            </div>
          )}
          {!prefill.slotNo && (
            <div className="form-group">
              <label className="lbl">{isSlip?'ST No.':'Assignment No.'}</label>
              <select className="input" name="slotNo" value={form.slotNo} onChange={set}>
                {isSlip ? [1,2,3].map(n=><option key={n} value={n}>ST {n}</option>) : [1,2].map(n=><option key={n} value={n}>Assignment {n}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="lbl">Title *</label>
          <input className="input" name="title" placeholder={isSlip?'Unit 1 & 2 — Slip Test':'Assignment 1 — Data Structures'} value={form.title} onChange={set} required/>
        </div>
        {!isSlip && (
          <>
            <div className="form-group">
              <label className="lbl">Description</label>
              <textarea className="input" name="description" rows={3} placeholder="Assignment instructions, topics, references…" value={form.description} onChange={set}/>
            </div>
            <div className="g2">
              <div className="form-group">
                <label className="lbl">Due Date</label>
                <input className="input" type="datetime-local" name="dueDate" value={form.dueDate} onChange={set}/>
              </div>
              <div className="form-group">
                <label className="lbl">Submission Mode</label>
                <select className="input" name="mode" value={form.mode} onChange={set}>
                  <option value="mixed">Mixed (online or offline)</option>
                  <option value="online">Online only</option>
                  <option value="offline">Offline only</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="lbl">Question Paper (optional)</label>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{display:'none'}} onChange={e=>setFile(e.target.files[0])}/>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button type="button" className="btn btn-white btn-sm" onClick={()=>fileRef.current.click()}>
                  <Upload size={13}/> {file?file.name.slice(0,30):'Choose file'}
                </button>
                {file && <button type="button" className="btn btn-ghost btn-xs" style={{color:'var(--red)'}} onClick={()=>setFile(null)}>✕</button>}
              </div>
              <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>PDF, Word, or image · max 20MB</p>
            </div>
          </>
        )}
        <div className="form-group">
          <label className="lbl">{isSlip?'Google Form Link *':'Google Form Link (optional)'}</label>
          <input className="input" name="formLink" type="url" placeholder="https://docs.google.com/forms/…" value={form.formLink} onChange={set} required={isSlip}/>
          <p style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
            {isSlip?'Students click this to open the slip test form.':'Paste a Google Form link for students to respond via form.'}
          </p>
        </div>
        <div style={{display:'flex',gap:10,marginTop:4}}>
          <button className="btn btn-brand" type="submit" disabled={saving}>
            {saving?<Spinner/>:isSlip?<><Link size={13}/> Post Form Link</>:<><Plus size={13}/> Post Assignment</>}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export function AssignmentCIEPanel({ subject, slotNo, type='assignment' }) {
  const [assignment, setAssignment] = useState(null);
  const [subsCount,  setSubsCount]  = useState(null);
  const [modal,      setModal]      = useState(false);
  const [loading,    setLoading]    = useState(true);

  const load = async () => {
    if (!subject?._id) return;
    setLoading(true);
    try {
      const { data } = await api.get('/api/teacher/assignments', { params:{ subjectId:subject._id } });
      const match = data.find(a => a.type===type && a.slotNo===slotNo);
      setAssignment(match||null);
      if (match) {
        const { data:subs } = await api.get(`/api/teacher/assignments/${match._id}/submissions`);
        setSubsCount(subs.stats);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[subject?._id,slotNo,type]);

  const isSlip = type === 'sliptest';
  const label  = isSlip ? `Slip Test ${slotNo}` : `Assignment ${slotNo}`;
  if (loading) return null;

  return (
    <div className="asgn-cie-panel">
      <div className="asgn-cie-panel__info">
        {assignment ? (
          <>
            <strong>{label} posted:</strong> {assignment.title}
            {assignment.dueDate && <span style={{marginLeft:8,opacity:.8,fontSize:11.5}}>· Due {new Date(assignment.dueDate).toLocaleDateString()}</span>}
            {isSlip && assignment.formLink && (
              <div style={{marginTop:4}}>
                <a href={assignment.formLink} target="_blank" rel="noreferrer"
                  style={{fontSize:12,color:'var(--blue)',display:'inline-flex',alignItems:'center',gap:4,textDecoration:'none'}}>
                  <Link size={11}/> Open Form Link
                </a>
              </div>
            )}
            {subsCount && !isSlip && (
              <div style={{marginTop:4,fontSize:11.5}}>
                <span style={{color:'var(--mint)',fontWeight:600}}>{subsCount.online} online</span> ·&nbsp;
                <span style={{color:'var(--blue)',fontWeight:600}}>{subsCount.offline} offline</span> ·&nbsp;
                <span style={{color:'var(--red)',fontWeight:600}}>{subsCount.notSubmitted} pending</span>
              </div>
            )}
          </>
        ) : (
          <span style={{color:'var(--text2)'}}>No {label} posted for this subject yet.</span>
        )}
      </div>
      <button className="btn btn-white btn-sm" onClick={()=>setModal(true)} style={{flexShrink:0}}>
        {assignment ? 'Edit' : `Post ${label}`}
      </button>
      <PostAssignmentModal open={modal} onClose={()=>setModal(false)} subjects={[subject]}
        prefill={{subjectId:subject._id,type,slotNo}} onSaved={()=>{ setModal(false); load(); }}/>
    </div>
  );
}
