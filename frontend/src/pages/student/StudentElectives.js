import React, { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Spinner } from '../../components/Layout';
import { CheckCircle, Clock, AlertTriangle, BookOpen } from 'lucide-react';

export default function StudentElectives() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null);

  const load = async () => {
    setLoading(true);
    try { const { data: d } = await api.get('/api/electives/student/available'); setData(d); }
    catch { /* No electives yet */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{textAlign:'center',padding:60}}><Spinner/></div>;

  if (!data.length) return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">Elective Registration</h2>
        <p className="s-page-sub">Choose your elective subjects</p>
      </div>
      <div className="s-card s-card--empty">
        <div className="s-empty-icon">📚</div>
        <h3 className="s-empty-title">No elective registration open</h3>
        <p className="s-empty-sub">Your admin will open elective registration when it's time.</p>
      </div>
    </div>
  );

  return (
    <div className="s-page">
      <div className="s-page-header">
        <h2 className="s-page-title">Elective Registration</h2>
        <p className="s-page-sub">Submit your subject preferences — admin will confirm final allotments</p>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {data.map(({ group, choice }) => (
          <ElectiveCard key={group._id} group={group} choice={choice}
            saving={saving===group._id}
            onSubmit={async (groupId, prefs) => {
              setSaving(groupId);
              try {
                await api.post('/api/electives/student/submit', { groupId, ...prefs });
                toast.success('Preferences submitted!');
                load();
              } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
              finally { setSaving(null); }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ElectiveCard({ group, choice, saving, onSubmit }) {
  const [pref1, setPref1] = useState(choice?.pref1||'');
  const [pref2, setPref2] = useState(choice?.pref2||'');
  const [pref3, setPref3] = useState(choice?.pref3||'');
  const [dirty, setDirty] = useState(false);

  const now         = new Date();
  const regOpen     = new Date(group.registrationOpen);
  const regClose    = new Date(group.registrationClose);
  const isOpen      = group.status === 'open' && now >= regOpen && now <= regClose;
  const isClosed    = group.status === 'closed' || group.status === 'allotted' || now > regClose;
  const isAllotted  = group.resultDeclared;

  const availableSubjects = group.subjects.filter(s => s.status !== 'cancelled');

  const handleSubmit = () => {
    if (!pref1) { toast.error('Please select your 1st preference'); return; }
    if (pref2 && pref2 === pref1) { toast.error('1st and 2nd preference cannot be the same'); return; }
    if (pref3 && (pref3 === pref1 || pref3 === pref2)) { toast.error('Preferences must be different'); return; }
    onSubmit(group._id, { pref1, pref2, pref3 });
    setDirty(false);
  };

  return (
    <div className="s-card" style={{padding:0,overflow:'hidden'}}>
      {/* Header */}
      <div style={{
        padding:'16px 20px',
        background:'linear-gradient(135deg,var(--navy),#1C2333)',
        display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'
      }}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
            <BookOpen size={16} color="#FF6B35"/>
            <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:16,color:'#fff'}}>
              {group.slotLabel}
            </span>
            <span style={{fontSize:11,color:'rgba(255,255,255,.35)',marginLeft:4}}>
              (Sem {group.targetSemester})
            </span>
            <span style={{
              fontSize:10,fontWeight:700,padding:'2px 10px',borderRadius:20,
              color: isAllotted?'#10B981':isOpen?'#10B981':isClosed?'#F59E0B':'#94A3B8',
              background: isAllotted?'rgba(16,185,129,.2)':isOpen?'rgba(16,185,129,.2)':isClosed?'rgba(245,158,11,.2)':'rgba(148,163,184,.1)'
            }}>
              {isAllotted?'RESULT DECLARED':isOpen?'REGISTRATION OPEN':isClosed?'REGISTRATION CLOSED':'NOT YET OPEN'}
            </span>
          </div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.4)'}}>
            <Clock size={11} style={{display:'inline',marginRight:4}}/>
            Registration: {regOpen.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} →{' '}
            {regClose.toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>

        {/* Status badge */}
        {choice && (
          <div style={{
            padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:700,
            color: choice.status==='confirmed'?'#10B981':choice.status==='rejected'?'#EF4444':'#F59E0B',
            background: choice.status==='confirmed'?'rgba(16,185,129,.15)':choice.status==='rejected'?'rgba(239,68,68,.15)':'rgba(245,158,11,.15)',
            border: `1px solid ${choice.status==='confirmed'?'rgba(16,185,129,.3)':choice.status==='rejected'?'rgba(239,68,68,.3)':'rgba(245,158,11,.3)'}`,
            flexShrink:0
          }}>
            {choice.status==='confirmed'?'✓ Allotted':choice.status==='rejected'?'✗ Rejected':'⏳ Pending'}
          </div>
        )}
      </div>

      <div style={{padding:'20px'}}>

        {/* RESULT DECLARED — show allotment */}
        {isAllotted && choice?.status === 'confirmed' && (
          <div style={{
            padding:'20px',marginBottom:16,
            background:'var(--mint-l)',border:'2px solid var(--mint)',borderRadius:'var(--r3)',
            textAlign:'center'
          }}>
            <CheckCircle size={28} color="var(--mint)" style={{marginBottom:8}}/>
            <div style={{fontFamily:"'Outfit',sans-serif",fontWeight:800,fontSize:18,color:'var(--mint-d)'}}>
              Allotted: {choice.allottedSubjectName}
            </div>
            <div style={{fontSize:13,color:'var(--text2)',marginTop:4}}>
              {choice.allottedSubjectCode}
              {choice.allottedSplitLabel && <span style={{marginLeft:8}} className="tag tag-blue">Group {choice.allottedSplitLabel}</span>}
            </div>
          </div>
        )}

        {isAllotted && choice?.status === 'rejected' && (
          <div style={{
            padding:'16px',marginBottom:16,
            background:'var(--red-l)',border:'1px solid var(--red)',borderRadius:'var(--r3)'
          }}>
            <AlertTriangle size={18} color="var(--red)" style={{marginBottom:6}}/>
            <div style={{fontWeight:600,fontSize:13,color:'var(--red-d)',marginBottom:4}}>Preference could not be accommodated</div>
            <div style={{fontSize:12,color:'var(--text2)'}}>{choice.rejectionReason || 'Please contact admin for re-allotment'}</div>
          </div>
        )}

        {/* Available subjects */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:'var(--text2)',marginBottom:10,textTransform:'uppercase',letterSpacing:'.05em'}}>
            Available Subjects ({availableSubjects.length})
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {availableSubjects.map(sub => (
              <div key={sub.subjectCode} style={{
                padding:'12px 14px',background:'var(--surface2)',
                border:'1px solid var(--border)',borderRadius:'var(--r2)',
                display:'flex',alignItems:'flex-start',gap:10
              }}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13.5}}>{sub.subjectName}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>
                    {sub.subjectCode}
                    {sub.hasLab && <span className="tag tag-blue" style={{fontSize:9,marginLeft:6,fontFamily:'inherit'}}>+Lab: {sub.labCode}</span>}
                  </div>
                </div>
                {/* Which preference they selected */}
                {pref1===sub.subjectCode && <span className="tag tag-orange" style={{fontSize:10,flexShrink:0}}>1st Choice</span>}
                {pref2===sub.subjectCode && <span className="tag tag-blue"   style={{fontSize:10,flexShrink:0}}>2nd Choice</span>}
                {pref3===sub.subjectCode && <span className="tag tag-mint"   style={{fontSize:10,flexShrink:0}}>3rd Choice</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Preference form */}
        {(isOpen || (choice && !isAllotted)) && (
          <div style={{
            padding:'16px',background:'var(--surface2)',
            border:'1px solid var(--border)',borderRadius:'var(--r3)'
          }}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:14,color:'var(--text)'}}>
              {choice ? 'Update Your Preferences' : 'Submit Your Preferences'}
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
              {[
                { label:'🥇 1st Preference', key:'pref1', val:pref1, set:v=>{setPref1(v);setDirty(true);}, required:true },
                { label:'🥈 2nd Preference', key:'pref2', val:pref2, set:v=>{setPref2(v);setDirty(true);}, required:false },
                { label:'🥉 3rd Preference', key:'pref3', val:pref3, set:v=>{setPref3(v);setDirty(true);}, required:false },
              ].map(p => (
                <div key={p.key} style={{display:'flex',alignItems:'center',gap:12}}>
                  <label style={{fontSize:13,fontWeight:600,width:150,flexShrink:0}}>{p.label}</label>
                  <select
                    className="input"
                    style={{flex:1}}
                    value={p.val}
                    disabled={!isOpen}
                    onChange={e=>p.set(e.target.value)}
                  >
                    <option value="">{p.required?'— Select subject —':'— No preference —'}</option>
                    {availableSubjects
                      .filter(s => {
                        if (p.key==='pref1') return true;
                        if (p.key==='pref2') return s.subjectCode!==pref1;
                        return s.subjectCode!==pref1 && s.subjectCode!==pref2;
                      })
                      .map(s => (
                        <option key={s.subjectCode} value={s.subjectCode}>{s.subjectName} ({s.subjectCode})</option>
                      ))
                    }
                  </select>
                </div>
              ))}
            </div>

            <div className="alert alert-blue" style={{fontSize:11.5,marginBottom:12}}>
              Your 1st preference will be given priority. If it gets cancelled due to low enrollment,
              admin may allot your 2nd or 3rd preference. Submit before the deadline.
            </div>

            {isOpen && (
              <button className="btn btn-brand" onClick={handleSubmit} disabled={saving||!dirty&&!!choice}>
                {saving?<Spinner/>:choice?'Update Preferences':'Submit Preferences'}
              </button>
            )}
            {!isOpen && isClosed && !isAllotted && (
              <div style={{fontSize:12,color:'var(--amber)',fontWeight:600}}>
                ⏳ Registration closed — awaiting admin allotment
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
