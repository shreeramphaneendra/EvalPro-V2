import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Empty, Spinner } from '../../components/Layout';
import { Upload, Link, CheckCircle, Clock, Trash2, FileText, ExternalLink, AlertCircle } from 'lucide-react';

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

export default function StudentAssignmentsPage() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/student/assignments'); setItems(data); }
    catch { toast.error('Failed to load assignments'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter(item => {
    if (filter === 'all')       return true;
    if (filter === 'sliptest')  return item.assignment.type === 'sliptest';
    if (filter === 'pending')   return item.assignment.type === 'assignment' && !item.submission;
    if (filter === 'submitted') return item.assignment.type === 'assignment' && !!item.submission;
    return true;
  });

  const pendingCount = items.filter(i => i.assignment.type === 'assignment' && !i.submission).length;

  return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">Assignments & Slip Tests</h2>
        <p className="s-page-sub">
          {pendingCount > 0
            ? <span style={{color:'var(--red)',fontWeight:600}}>{pendingCount} assignment{pendingCount>1?'s':''} pending submission</span>
            : 'All assignments submitted — great work!'
          }
        </p>
      </div>

      <div className="tabs">
        {[
          { key:'all',       label:'All' },
          { key:'pending',   label:'Pending' },
          { key:'submitted', label:'Submitted' },
          { key:'sliptest',  label:'Slip Tests' },
        ].map(f => (
          <button key={f.key} className={`tab-btn${filter===f.key?' active':''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{textAlign:'center',padding:48}}><Spinner size="lg"/></div>
        : filtered.length === 0
          ? <Empty icon="📝" msg="Nothing here" sub="Check back later"/>
          : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {filtered.map(item => (
                <AssignmentItem key={item.assignment._id} item={item} onRefresh={load}/>
              ))}
            </div>
          )
      }
    </div>
  );
}

function AssignmentItem({ item, onRefresh }) {
  const { assignment: a, submission: s, isOverdue } = item;
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const isSlip     = a.type === 'sliptest';
  const label      = isSlip ? `ST ${a.slotNo}` : `Assignment ${a.slotNo}`;
  const canUpload  = !isSlip && a.mode !== 'offline' && !isOverdue;
  const canRetract = s?.method === 'online' && !isOverdue;

  const variant = isSlip
    ? 'sasgn-card--sliptest'
    : s ? 'sasgn-card--submitted'
    : isOverdue ? 'sasgn-card--overdue'
    : 'sasgn-card--pending';

  const upload = async (file) => {
    if (!file) return;
    const allowedTypes = ['application/pdf','image/jpeg','image/png','image/jpg',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) { toast.error('Only PDF, Word, and images allowed'); return; }
    if (file.size > 20*1024*1024) { toast.error('File too large. Max 20MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`/api/student/assignments/${a._id}/submit`, fd, {
        headers: { 'Content-Type':'multipart/form-data' }
      });
      if (!data.submission?.fileUrl || !data.submission.fileUrl.startsWith('http')) {
        toast.error('Upload failed — file was not stored. Try again.'); return;
      }
      toast.success(data.isLate ? 'Submitted (late)' : s ? 'Resubmitted!' : 'Submitted successfully!');
      onRefresh();
    } catch(err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const retract = async () => {
    if (!window.confirm('Remove your submission? You can re-upload before the deadline.')) return;
    try { await api.delete(`/api/student/assignments/${a._id}/submission`); toast.success('Submission removed'); onRefresh(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const statusTag = () => {
    if (isSlip) return null;
    if (!s)       return <span className={`tag ${isOverdue?'tag-red':'tag-amber'}`} style={{fontSize:10}}>{isOverdue?'Overdue':'Pending'}</span>;
    if (s.isLate) return <span className="tag tag-amber" style={{fontSize:10}}>Submitted Late</span>;
    return <span className="tag tag-mint" style={{fontSize:10}}>Submitted ✓</span>;
  };

  return (
    <div className={`sasgn-card ${variant}`}>
      <div className="sasgn-body">
        <div className="sasgn-top">
          <div style={{flex:1,minWidth:0}}>
            <div className="sasgn-title">
              {a.title}
              <span className={`tag ${isSlip?'tag-blue':'tag-orange'}`} style={{fontSize:10}}>{label}</span>
              {statusTag()}
              {!isSlip && a.mode && a.mode !== 'mixed' && <span className="tag tag-gray" style={{fontSize:10}}>{a.mode}</span>}
            </div>
            <p className="sasgn-subject">
              {a.subject?.name} ({a.subject?.code})
              {a.teacher?.name && <span> · {a.teacher.name}</span>}
            </p>
            {a.description && <p className="sasgn-desc">{a.description}</p>}
            <div className="sasgn-times">
              {a.dueDate && (
                <span className="sasgn-time" style={{color:isOverdue?'var(--red)':'var(--text2)'}}>
                  <Clock size={11}/> Due: {new Date(a.dueDate).toLocaleString()}
                </span>
              )}
              {s?.submittedAt && (
                <span className="sasgn-time" style={{color:'var(--mint)'}}>
                  <CheckCircle size={11}/> Submitted: {new Date(s.submittedAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="sasgn-links">
              {isSlip && a.formLink && (
                <a href={a.formLink} target="_blank" rel="noreferrer"
                  className="btn btn-brand btn-sm" style={{textDecoration:'none'}}>
                  <ExternalLink size={12}/> Open Google Form
                </a>
              )}
              {a.attachmentUrl && (
                <a href={inlineUrl(a.attachmentUrl,a.attachmentName)} target="_blank" rel="noreferrer"
                  className="btn btn-white btn-sm" style={{textDecoration:'none'}}>
                  <FileText size={12}/> Question Paper
                </a>
              )}
              {s?.fileUrl && (
                <a href={inlineUrl(s.fileUrl,s.fileName)} target="_blank" rel="noreferrer"
                  className="btn btn-white btn-sm" style={{textDecoration:'none'}}>
                  <FileText size={12}/> {s.fileName?.slice(0,22)||'My Submission'}
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isSlip && (
            <div className="sasgn-actions">
              {canUpload && (
                <>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    style={{display:'none'}} onChange={e=>upload(e.target.files[0])}/>
                  <button className="btn btn-brand btn-sm" onClick={()=>fileRef.current.click()} disabled={uploading}>
                    {uploading ? <Spinner/> : <><Upload size={13}/> {s?'Resubmit':'Upload'}</>}
                  </button>
                </>
              )}
              {canRetract && (
                <button className="btn btn-ghost btn-xs" style={{color:'var(--red)'}} onClick={retract}>
                  <Trash2 size={12}/> Retract
                </button>
              )}
              {a.mode === 'offline' && !s && (
                <span className="sasgn-offline-note">Physical submission only</span>
              )}
              {isOverdue && !s && (
                <span className="sasgn-deadline-passed">Deadline passed</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
