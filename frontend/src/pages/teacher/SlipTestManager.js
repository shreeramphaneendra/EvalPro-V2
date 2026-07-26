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
  const [bankOpen, setBankOpen] = useState(false);

  const saveToBank = async () => {
    const valid = form.questions.filter(q => q.text?.trim());
    if (!valid.length) { toast.error('Add some questions first'); return; }
    try {
      const { data } = await api.post(`/api/questionbank/${subject._id}/add`, { questions: valid });
      toast.success(data.message);
    } catch(e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const importFromBank = (picked) => {
    const start = form.questions.length;
    const mapped = picked.map((q, i) => ({
      qNo: start + i + 1, type: q.type, text: q.text, marks: q.marks || 1,
      options: q.options || ['','','',''], correct: q.correct ?? 0, hint: q.hint || ''
    }));
    setForm(f => ({ ...f, questions: [...f.questions, ...mapped] }));
    api.post(`/api/questionbank/${subject._id}/used`, { questionIds: picked.map(q=>q._id) }).catch(()=>{});
    setBankOpen(false);
    toast.success(`${picked.length} question(s) imported`);
  };

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
      const res = await api.post('/api/sliptests/create', {
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
      toast.success(res?.data?.message || 'Slip test created!');
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
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="btn btn-white btn-sm" onClick={() => addQ('mcq')}><Plus size={12}/> MCQ</button>
              <button className="btn btn-white btn-sm" onClick={() => addQ('short')}><Plus size={12}/> Short Answer</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setBankOpen(true)}>📚 From Bank</button>
              {form.questions.some(q=>q.text?.trim()) &&
                <button className="btn btn-ghost btn-sm" onClick={saveToBank}>💾 Save to Bank</button>}
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

      {bankOpen && (
        <QuestionBankPicker subject={subject}
          onClose={()=>setBankOpen(false)} onImport={importFromBank}/>
      )}
    </Modal>
  );
}

/* ── QUESTION BANK PICKER ─────────────────────────────────────────────── */
function QuestionBankPicker({ subject, onClose, onImport }) {
  const [bank,    setBank]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked,  setPicked]  = useState({});
  const [search,  setSearch]  = useState('');
  const [typeF,   setTypeF]   = useState('all');

  useEffect(() => {
    api.get(`/api/questionbank/${subject._id}`)
      .then(r => setBank(r.data))
      .catch(() => setBank({ questions: [] }))
      .finally(() => setLoading(false));
  }, [subject._id]);

  const remove = async (qid) => {
    if (!window.confirm('Remove this question from the bank permanently?')) return;
    try {
      await api.delete(`/api/questionbank/${subject._id}/${qid}`);
      setBank(b => ({ ...b, questions: b.questions.filter(q => q._id !== qid) }));
      toast.success('Removed from bank');
    } catch(e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const qs = (bank?.questions || [])
    .filter(q => typeF === 'all' || q.type === typeF)
    .filter(q => !search || q.text.toLowerCase().includes(search.toLowerCase()));
  const chosen = qs.filter(q => picked[q._id]);

  return (
    <Modal open onClose={onClose} width={720} title={`Question Bank — ${subject.name}`}>
      <div style={{display:'flex',flexDirection:'column',gap:12,maxHeight:'70vh'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input className="input" style={{flex:1,minWidth:180}} placeholder="Search questions…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <select className="input" style={{width:140}} value={typeF} onChange={e=>setTypeF(e.target.value)}>
            <option value="all">All types</option>
            <option value="mcq">MCQ only</option>
            <option value="short">Short answer</option>
          </select>
        </div>

        {loading ? <div style={{textAlign:'center',padding:36}}><Spinner/></div>
        : qs.length === 0 ? (
          <div style={{textAlign:'center',padding:'36px 20px',color:'var(--text3)'}}>
            <div style={{fontSize:30,marginBottom:8}}>📚</div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>
              {bank?.questions?.length ? 'No questions match your filter' : 'Bank is empty'}
            </div>
            <div style={{fontSize:12}}>
              Create a test, then click <strong>Save to Bank</strong> to reuse those questions later.
            </div>
          </div>
        ) : (
          <div style={{overflowY:'auto',display:'flex',flexDirection:'column',gap:8,flex:1}}>
            {qs.map(q => (
              <label key={q._id} style={{
                display:'flex',gap:10,padding:'11px 13px',cursor:'pointer',
                border:`1px solid ${picked[q._id]?'var(--brand)':'var(--border)'}`,
                background:picked[q._id]?'var(--brand-l)':'var(--surface2)',
                borderRadius:'var(--r2)'
              }}>
                <input type="checkbox" checked={!!picked[q._id]} style={{marginTop:3,flexShrink:0}}
                  onChange={e=>setPicked(p=>({...p,[q._id]:e.target.checked}))}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
                    <span className={`tag ${q.type==='mcq'?'tag-blue':'tag-mint'}`} style={{fontSize:9}}>
                      {q.type==='mcq'?'MCQ':'SHORT'}
                    </span>
                    <span style={{fontSize:11,color:'var(--text3)'}}>{q.marks} mark{q.marks!==1?'s':''}</span>
                    {q.timesUsed > 0 && <span style={{fontSize:11,color:'var(--text3)'}}>· used {q.timesUsed}×</span>}
                  </div>
                  <div style={{fontSize:13,color:'var(--text)',lineHeight:1.5}}>{q.text}</div>
                  {q.type === 'mcq' && q.options?.length > 0 && (
                    <div style={{fontSize:11.5,color:'var(--text2)',marginTop:4}}>
                      {q.options.map((o,i)=>(
                        <span key={i} style={{marginRight:10,fontWeight:i===q.correct?700:400,
                          color:i===q.correct?'var(--mint-d)':'var(--text2)'}}>
                          {String.fromCharCode(65+i)}. {o}{i===q.correct?' ✓':''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn btn-ghost btn-xs" style={{color:'var(--red)',flexShrink:0}}
                  onClick={(e)=>{e.preventDefault();remove(q._id);}}>
                  <Trash2 size={12}/>
                </button>
              </label>
            ))}
          </div>
        )}

        <div style={{display:'flex',gap:10,alignItems:'center',borderTop:'1px solid var(--border)',paddingTop:12}}>
          <button className="btn btn-brand" disabled={!chosen.length}
            onClick={()=>onImport(chosen)}>
            Import {chosen.length > 0 ? `${chosen.length} question(s)` : ''}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <span style={{marginLeft:'auto',fontSize:12,color:'var(--text3)'}}>
            {bank?.questions?.length || 0} in bank
          </span>
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
