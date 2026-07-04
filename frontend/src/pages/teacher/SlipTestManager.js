import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Modal, Empty, Spinner } from '../../components/Layout';
import { Plus, Trash2, Eye, Send, Lock, BarChart2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SlipTestManager({ subject, slot }) {
  const [tests,   setTests]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [viewTest, setViewTest] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/sliptests/my-tests', { params: { subjectId: subject._id } }); setTests(slot ? data.filter(t=>t.slot===slot) : data); }
    catch { toast.error('Failed to load slip tests'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [subject._id]);

  const publish = async (id) => {
    try { await api.post(`/api/sliptests/${id}/publish`); toast.success('Test published!'); load(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const close = async (id) => {
    if (!window.confirm('Close this test? Students cannot start new attempts.')) return;
    try { await api.post(`/api/sliptests/${id}/close`); toast.success('Test closed'); load(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this test and all attempts?')) return;
    try { await api.delete(`/api/sliptests/${id}`); toast.success('Deleted'); load(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const statusColor = { draft:'var(--text3)', active:'var(--mint)', closed:'var(--red)' };
  const statusBg    = { draft:'var(--surface2)', active:'var(--mint-l)', closed:'var(--red-l)' };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h3 style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:15}}>Proctored Slip Test {slot ? `— ${slot}` : ''}</h3>
          <p style={{fontSize:12,color:'var(--text2)',marginTop:2}}>Create auto-graded proctored test · MCQ scores push to CIE automatically · Short answers need manual grading</p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={() => setModal(true)}>
          <Plus size={13}/> Create Slip Test
        </button>
      </div>

      {loading ? <div style={{textAlign:'center',padding:32}}><Spinner/></div>
      : tests.length === 0 ? <Empty icon="📝" msg="No slip tests yet" sub="Create your first proctored slip test"/>
      : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {tests.map(t => (
            <div key={t._id} style={{
              padding:'14px 16px',background:'var(--surface)',
              border:'1px solid var(--border)',borderRadius:'var(--r3)',
              borderLeft:`4px solid ${statusColor[t.status]}`,
              display:'flex',alignItems:'flex-start',gap:14
            }}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                  <span style={{fontWeight:600,fontSize:14}}>{t.title}</span>
                  <span className={`tag tag-${t.slot==='ST1'?'orange':t.slot==='ST2'?'blue':'violet'}`} style={{fontSize:10}}>{t.slot}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,
                    color:statusColor[t.status],background:statusBg[t.status]}}>
                    {t.status.toUpperCase()}
                  </span>
                  {t.section && <span className="tag tag-gray" style={{fontSize:10}}>Sec {t.section}</span>}
                </div>
                <div style={{fontSize:12,color:'var(--text2)',display:'flex',gap:14,flexWrap:'wrap'}}>
                  <span>{t.questions?.length || 0} questions · {t.totalMarks} marks total · {t.duration} min</span>
                  <span>🕐 {new Date(t.windowStart).toLocaleString()} → {new Date(t.windowEnd).toLocaleString()}</span>
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                {t.status === 'draft' && (
                  <button className="btn btn-mint btn-sm" onClick={() => publish(t._id)}>
                    <Send size={12}/> Publish
                  </button>
                )}
                {t.status === 'active' && (
                  <button className="btn btn-white btn-sm" onClick={() => close(t._id)}>
                    <Lock size={12}/> Close
                  </button>
                )}
                <button className="btn btn-white btn-sm" onClick={() => setViewTest(t._id)}>
                  <BarChart2 size={12}/> Results
                </button>
                {t.status === 'draft' && (
                  <button className="btn btn-ghost btn-xs" style={{color:'var(--red)'}} onClick={() => del(t._id)}>
                    <Trash2 size={12}/>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CreateSlipTestModal subject={subject} defaultSlot={slot || 'ST1'} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }}/>
      )}
      {viewTest && (
        <ResultsModal testId={viewTest} onClose={() => setViewTest(null)}/>
      )}
    </div>
  );
}

function CreateSlipTestModal({ subject, defaultSlot='ST1', onClose, onSaved }) {
  const sections = subject.mySections?.length ? subject.mySections : [null];
  const [form, setForm] = useState({
    title: '', instructions: '', slot: 'ST1',
    section: sections[0] || '', duration: '20',
    windowStart: '', windowEnd: '',
    questions: []
  });
  const [saving, setSaving] = useState(false);

  const addQ = (type) => {
    const qNo = form.questions.length + 1;
    const q = type === 'mcq'
      ? { qNo, type, text:'', marks:1, options:['','','',''], correct:0 }
      : { qNo, type, text:'', marks:1, hint:'' };
    setForm(f => ({ ...f, questions: [...f.questions, q] }));
  };

  const updateQ = (i, field, val) => {
    const qs = [...form.questions];
    qs[i] = { ...qs[i], [field]: val };
    setForm(f => ({ ...f, questions: qs }));
  };

  const updateOption = (qi, oi, val) => {
    const qs = [...form.questions];
    const opts = [...(qs[qi].options || ['','','',''])];
    opts[oi] = val;
    qs[qi] = { ...qs[qi], options: opts };
    setForm(f => ({ ...f, questions: qs }));
  };

  const removeQ = (i) => {
    const qs = form.questions.filter((_,j) => j !== i).map((q,j) => ({ ...q, qNo: j+1 }));
    setForm(f => ({ ...f, questions: qs }));
  };

  const totalMarks = form.questions.reduce((s,q) => s + (Number(q.marks)||0), 0);

  const save = async () => {
    if (!form.title) { toast.error('Enter a title'); return; }
    if (!form.questions.length) { toast.error('Add at least one question'); return; }
    if (!form.windowStart || !form.windowEnd) { toast.error('Set test window'); return; }
    setSaving(true);
    try {
      await api.post('/api/sliptests/create', {
        subjectId:    subject._id,
        slot:         form.slot,
        section:      form.section || null,
        title:        form.title,
        instructions: form.instructions,
        questions:    form.questions,
        duration:     Number(form.duration),
        windowStart:  new Date(form.windowStart).toISOString(),
        windowEnd:    new Date(form.windowEnd).toISOString(),
      });
      toast.success('Slip test created!');
      onSaved();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Create Proctored Slip Test" width={780}>
      <div style={{display:'flex',flexDirection:'column',gap:16,maxHeight:'75vh',overflowY:'auto',paddingRight:4}}>
        {/* Basic info */}
        <div className="g2">
          <div className="form-group" style={{flex:2}}>
            <label className="lbl">Test Title *</label>
            <input className="input" placeholder="Unit 1 & 2 Slip Test" value={form.title}
              onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="lbl">CIE Slot *</label>
            <select className="input" value={form.slot} onChange={e=>setForm(f=>({...f,slot:e.target.value}))}>
              <option value="ST1">ST 1</option>
              <option value="ST2">ST 2</option>
              <option value="ST3">ST 3</option>
            </select>
          </div>
          {sections.length > 1 && (
            <div className="form-group">
              <label className="lbl">Section</label>
              <select className="input" value={form.section} onChange={e=>setForm(f=>({...f,section:e.target.value}))}>
                <option value="">All Sections</option>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="g2">
          <div className="form-group">
            <label className="lbl">Window Start *</label>
            <input className="input" type="datetime-local" value={form.windowStart}
              onChange={e=>setForm(f=>({...f,windowStart:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="lbl">Window End *</label>
            <input className="input" type="datetime-local" value={form.windowEnd}
              onChange={e=>setForm(f=>({...f,windowEnd:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label className="lbl">Duration (minutes) *</label>
            <input className="input" type="number" min="5" max="180" value={form.duration}
              onChange={e=>setForm(f=>({...f,duration:e.target.value}))}/>
          </div>
        </div>

        <div className="form-group">
          <label className="lbl">Instructions (optional)</label>
          <textarea className="input" rows={2} placeholder="Read each question carefully. MCQ questions are auto-graded."
            value={form.instructions} onChange={e=>setForm(f=>({...f,instructions:e.target.value}))}/>
        </div>

        {/* Questions */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div>
              <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14}}>Questions</span>
              {totalMarks > 0 && (
                <span style={{marginLeft:10,fontSize:12,color:'var(--text2)'}}>
                  Total: <strong>{totalMarks} marks</strong>
                  <span style={{color:'var(--text3)',marginLeft:4}}>→ scaled to /5</span>
                </span>
              )}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-white btn-sm" onClick={() => addQ('mcq')}><Plus size={12}/> MCQ</button>
              <button className="btn btn-white btn-sm" onClick={() => addQ('short')}><Plus size={12}/> Short Answer</button>
            </div>
          </div>

          {form.questions.length === 0 && (
            <div style={{textAlign:'center',padding:'24px',background:'var(--surface2)',borderRadius:'var(--r2)',border:'1px dashed var(--border2)',color:'var(--text3)',fontSize:13}}>
              No questions yet — click MCQ or Short Answer to add
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {form.questions.map((q, i) => (
              <div key={i} style={{
                padding:'14px',borderRadius:'var(--r3)',
                background:q.type==='mcq'?'var(--blue-l)':'var(--mint-l)',
                border:`1px solid ${q.type==='mcq'?'#BFDBFE':'#A7F3D0'}`
              }}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <span style={{
                    fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:10,
                    background:q.type==='mcq'?'var(--blue)':'var(--mint)',color:'#fff'
                  }}>{q.type==='mcq'?'MCQ':'Short Answer'}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'var(--text3)'}}>Q{q.qNo}</span>
                  <div style={{flex:1}}/>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <label style={{fontSize:11,color:'var(--text2)'}}>Marks:</label>
                    <input type="number" min="0.5" max="20" step="0.5"
                      style={{width:60,padding:'3px 8px',border:'1px solid var(--border)',borderRadius:'var(--r1)',fontSize:12}}
                      value={q.marks} onChange={e=>updateQ(i,'marks',Number(e.target.value))}/>
                  </div>
                  <button className="btn btn-ghost btn-xs" style={{color:'var(--red)'}} onClick={() => removeQ(i)}>
                    <Trash2 size={12}/>
                  </button>
                </div>

                <textarea rows={2} className="input" style={{marginBottom:10}}
                  placeholder={`Question ${q.qNo} text...`}
                  value={q.text} onChange={e=>updateQ(i,'text',e.target.value)}/>

                {q.type === 'mcq' && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {(q.options||['','','','']).map((opt, oi) => (
                      <div key={oi} style={{display:'flex',alignItems:'center',gap:6}}>
                        <input type="radio" name={`correct_${i}`} checked={q.correct===oi}
                          onChange={() => updateQ(i,'correct',oi)}
                          style={{accentColor:'var(--mint)',width:14,height:14,cursor:'pointer'}}/>
                        <input className="input" style={{flex:1,padding:'5px 8px',fontSize:12.5}}
                          placeholder={`Option ${String.fromCharCode(65+oi)}`}
                          value={opt} onChange={e=>updateOption(i,oi,e.target.value)}/>
                      </div>
                    ))}
                    <p style={{gridColumn:'1/-1',fontSize:11,color:'var(--text3)',margin:0}}>
                      ● = correct answer
                    </p>
                  </div>
                )}

                {q.type === 'short' && (
                  <input className="input" style={{fontSize:12.5}}
                    placeholder="Answer hint / expected answer (only visible to you)"
                    value={q.hint||''} onChange={e=>updateQ(i,'hint',e.target.value)}/>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Proctor info */}
        <div className="alert alert-blue" style={{fontSize:12}}>
          <strong>Proctoring enabled:</strong> Tab switching triggers immediate auto-submit.
          Fullscreen exit and window blur are logged as violations (3 = auto-submit).
          MCQ answers are auto-graded. Short answers require manual grading.
        </div>

        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-brand" onClick={save} disabled={saving}>
            {saving ? <Spinner/> : 'Save as Draft'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function ResultsModal({ testId, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState({});
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get(`/api/sliptests/${testId}/attempts`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [testId]);

  const setShortScore = (attemptId, score) => {
    setGrading(g => ({ ...g, [attemptId]: score }));
  };

  const saveGrades = async () => {
    setSaving(true);
    try {
      const grades = Object.entries(grading).map(([attemptId, shortScore]) => {
        const result = data.result.find(r => r.attempt?._id === attemptId);
        if (!result?.attempt) return null;
        // Build answer grades for short answers
        const shortAnswers = result.attempt.answers
          .filter(a => a.type === 'short')
          .map(a => ({ qNo: a.qNo, marksAwarded: Number(shortScore) / result.attempt.answers.filter(x=>x.type==='short').length }));
        return { attemptId, answers: shortAnswers, shortScore: Number(shortScore) };
      }).filter(Boolean);

      await api.post(`/api/sliptests/${testId}/grade`, { grades, pushToCIE: false });
      toast.success('Grades saved!');
      const { data: refreshed } = await api.get(`/api/sliptests/${testId}/attempts`);
      setData(refreshed);
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const allowRetake = async (attemptId, name) => {
    if (!window.confirm(`Clear ${name}'s attempt so they can retake? Their current answers and score will be deleted.`)) return;
    try {
      await api.delete(`/api/sliptests/${testId}/attempts/${attemptId}`);
      toast.success('Attempt cleared — student can retake');
      const { data: refreshed } = await api.get(`/api/sliptests/${testId}/attempts`);
      setData(refreshed);
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const pushToCIE = async () => {
    setSaving(true);
    try {
      const { data: r } = await api.post(`/api/sliptests/${testId}/push-to-cie`);
      toast.success(r.message);
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <Modal open onClose={onClose} title="Results"><div style={{textAlign:'center',padding:40}}><Spinner/></div></Modal>;

  const { test, result, totalStudents, submitted } = data || {};
  const hasShort = test?.questions?.some(q => q.type === 'short');
  const allGraded = result?.filter(r => r.attempt).every(r => r.attempt?.graded);

  return (
    <Modal open onClose={onClose} title={`Results — ${test?.title}`} width={860}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          {[
            { val:totalStudents, lbl:'Total', color:'var(--text)' },
            { val:submitted,     lbl:'Submitted', color:'var(--mint)' },
            { val:totalStudents-submitted, lbl:'Not Attempted', color:'var(--red)' },
            { val:test?.slot,    lbl:'CIE Slot', color:'var(--brand)' },
          ].map(s => (
            <div key={s.lbl} style={{padding:'12px',background:'var(--surface2)',borderRadius:'var(--r2)',textAlign:'center',border:'1px solid var(--border)'}}>
              <div style={{fontFamily:"'Outfit',sans-serif",fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Results table */}
        <div style={{border:'1px solid var(--border)',borderRadius:'var(--r3)',overflow:'hidden',maxHeight:450}}>
          <div style={{overflowY:'auto',maxHeight:450}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th className="center">Status</th>
                  <th className="center">MCQ Score</th>
                  {hasShort && <th className="center">Short Score</th>}
                  <th className="center">Final /5</th>
                  <th className="center">Violations</th>
                  <th className="center">Auto-Sub</th>
                  <th className="center">Time</th>
                  <th className="center">Retake</th>
                </tr>
              </thead>
              <tbody>
                {result?.map((r, i) => (
                  <tr key={i} style={r.attempt?.autoSubmitted?{background:'#FFF8F0'}:{}}>
                    <td style={{color:'var(--text3)',fontSize:11}}>{i+1}</td>
                    <td>
                      <div style={{fontWeight:500,fontSize:13}}>{r.student.name}</div>
                      <span className="mono" style={{fontSize:11,color:'var(--text3)'}}>{r.student.usn}</span>
                    </td>
                    <td className="center">
                      {!r.attempt
                        ? <span className="tag tag-gray" style={{fontSize:10}}>Not Attempted</span>
                        : r.attempt.status==='submitted'
                          ? <span className="tag tag-mint" style={{fontSize:10}}>✓ Submitted</span>
                          : <span className="tag tag-amber" style={{fontSize:10}}>In Progress</span>
                      }
                    </td>
                    <td className="center" style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
                      {r.attempt?.mcqScore ?? '—'}
                    </td>
                    {hasShort && (
                      <td className="center">
                        {r.attempt?.status === 'submitted' ? (
                          r.attempt.graded
                            ? <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{r.attempt.shortScore}</span>
                            : <input type="number" min={0} max={test?.totalMarks} step={0.5}
                                style={{width:60,padding:'3px 6px',border:'1px solid var(--border)',borderRadius:'var(--r1)',fontSize:12,textAlign:'center'}}
                                placeholder="—"
                                value={grading[r.attempt._id] ?? ''}
                                onChange={e=>setShortScore(r.attempt._id,e.target.value)}/>
                        ) : '—'}
                      </td>
                    )}
                    <td className="center">
                      {r.attempt?.scaledScore != null
                        ? <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:15,
                            color:r.attempt.scaledScore>=3?'var(--mint)':r.attempt.scaledScore>=2?'var(--amber)':'var(--red)'}}>
                            {r.attempt.scaledScore}
                          </span>
                        : '—'
                      }
                    </td>
                    <td className="center">
                      {r.attempt?.violationCount > 0
                        ? <span className="tag tag-amber" style={{fontSize:10}}>{r.attempt.violationCount} ⚠</span>
                        : <span style={{color:'var(--text4)'}}>—</span>
                      }
                    </td>
                    <td className="center">
                      {r.attempt?.autoSubmitted
                        ? <span className="tag tag-red" style={{fontSize:10}}>Auto</span>
                        : r.attempt ? <span className="tag tag-mint" style={{fontSize:10}}>Manual</span> : '—'
                      }
                    </td>
                    <td className="center" style={{fontSize:11,color:'var(--text2)'}}>
                      {r.attempt?.timeSpent
                        ? `${Math.floor(r.attempt.timeSpent/60)}m ${r.attempt.timeSpent%60}s`
                        : '—'
                      }
                    </td>
                    <td className="center">
                      {r.attempt
                        ? <button className="btn btn-ghost btn-xs" style={{color:'var(--brand)',fontSize:11}}
                            onClick={() => allowRetake(r.attempt._id, r.student.name)}>
                            ↺ Retake
                          </button>
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {hasShort && Object.keys(grading).length > 0 && (
            <button className="btn btn-brand btn-sm" onClick={saveGrades} disabled={saving}>
              {saving ? <Spinner/> : 'Save Short Answer Grades'}
            </button>
          )}
          {allGraded && (
            <button className="btn btn-mint" onClick={pushToCIE} disabled={saving}>
              {saving ? <Spinner/> : <><CheckCircle size={13}/> Push All to CIE {test?.slot}</>}
            </button>
          )}
          {!allGraded && hasShort && (
            <p style={{fontSize:12,color:'var(--text3)'}}>
              Grade short answers above, then push to CIE
            </p>
          )}
          {!hasShort && (
            <button className="btn btn-mint" onClick={pushToCIE} disabled={saving}>
              {saving ? <Spinner/> : <><CheckCircle size={13}/> Push All to CIE {test?.slot}</>}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
