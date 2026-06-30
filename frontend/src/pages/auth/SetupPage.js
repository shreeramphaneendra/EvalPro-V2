import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { BarChart2, Shield, CheckCircle } from 'lucide-react';
import { Spinner } from '../../components/Layout';

export default function SetupPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name:'', employeeId:'', email:'', password:'', confirm:'',
    department:'IT', college:'CBIT',
    programs:['B.Tech'],
    bootstrapSecret:''
  });
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  useEffect(() => {
    api.get('/api/auth/setup-status').then(r => {
      if (!r.data.needsSetup) nav('/');
    }).catch(() => {});
  }, [nav]);

  const set = e => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleProgram = p => {
    const arr = form.programs.includes(p)
      ? form.programs.filter(x => x !== p)
      : [...form.programs, p];
    if (arr.length > 0) setForm({ ...form, programs: arr });
  };

  const submit = async e => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6)       { toast.error('Password must be at least 6 characters'); return; }
    if (!form.programs.length)          { toast.error('Select at least one program'); return; }
    setSaving(true);
    try {
      await api.post('/api/auth/bootstrap-admin', form);
      setDone(true);
      toast.success('Admin account created!');
      setTimeout(() => nav('/admin/login'), 2000);
    } catch(err) { toast.error(err.response?.data?.message || 'Setup failed'); }
    finally { setSaving(false); }
  };

  if (done) return (
    <div className="setup-done">
      <div className="setup-done-card">
        <div className="setup-done-icon"><CheckCircle size={36} color="var(--mint)"/></div>
        <h2 className="setup-done-title">Setup Complete!</h2>
        <p className="setup-done-sub">Redirecting to admin login…</p>
      </div>
    </div>
  );

  return (
    <div className="setup-page">
      <div className="setup-glow-1"/>
      <div className="setup-glow-2"/>

      <div className="setup-card">
        {/* Logo */}
        <div className="setup-logo">
          <div className="setup-logo-icon"><BarChart2 size={20} color="#fff"/></div>
          <span className="setup-logo-text">Eval<span>Pro</span></span>
        </div>

        <div className="setup-form-card">
          {/* Role badge */}
          <div className="setup-role-badge">
            <Shield size={14} color="var(--brand)"/>
            <span className="setup-role-text">First Time Setup</span>
          </div>

          <h2 className="setup-heading">Create Admin Account</h2>
          <p className="setup-sub">This page only appears once. Fill in the department admin details.</p>

          {/* Security note */}
          <div className="setup-info">
            ⚠ After this account is created, this setup page is <strong>permanently locked</strong>.
            No one can create another admin through this page.
          </div>

          <form onSubmit={submit}>
            <div className="setup-grid-2">
              <div>
                <label className="setup-label">Full Name *</label>
                <input className="setup-input" name="name" placeholder="N. Shivakumar" value={form.name} onChange={set} required/>
              </div>
              <div>
                <label className="setup-label">Employee ID *</label>
                <input className="setup-input" name="employeeId" placeholder="EMP001" value={form.employeeId} onChange={set} required/>
              </div>
            </div>

            <label className="setup-label">Email *</label>
            <input className="setup-input" name="email" type="email" placeholder="admin@cbit.ac.in" value={form.email} onChange={set} required/>

            <div className="setup-grid-2">
              <div>
                <label className="setup-label">Department *</label>
                <input className="setup-input" name="department" placeholder="IT" value={form.department} onChange={set} required/>
              </div>
              <div>
                <label className="setup-label">College</label>
                <input className="setup-input" name="college" placeholder="CBIT" value={form.college} onChange={set}/>
              </div>
            </div>

            <span className="setup-program-label">Programs *</span>
            <div className="setup-programs">
              {['B.Tech','M.Tech','MBA','B.E.','M.E.'].map(p => (
                <button key={p} type="button"
                  className={`setup-program-btn ${form.programs.includes(p)?'setup-program-btn--on':'setup-program-btn--off'}`}
                  onClick={() => toggleProgram(p)}>
                  {p}
                </button>
              ))}
            </div>

            <div className="setup-grid-2">
              <div>
                <label className="setup-label">Password *</label>
                <input className="setup-input" name="password" type="password" placeholder="Min 6 characters" value={form.password} onChange={set} required/>
              </div>
              <div>
                <label className="setup-label">Confirm Password *</label>
                <input className="setup-input" name="confirm" type="password" placeholder="Repeat password" value={form.confirm} onChange={set} required/>
              </div>
            </div>

            <label className="setup-label">Setup Secret *</label>
            <input className="setup-input" name="bootstrapSecret" type="password"
              placeholder="Value from BOOTSTRAP_SECRET in .env file"
              value={form.bootstrapSecret} onChange={set} required/>
            <p style={{fontSize:11,color:'rgba(255,255,255,.22)',marginTop:-10,marginBottom:20}}>
              This is the BOOTSTRAP_SECRET from your backend .env file.
            </p>

            <button type="submit" disabled={saving}
              className={`setup-submit ${saving?'setup-submit--loading':'setup-submit--active'}`}>
              {saving
                ? <><span className="spinner" style={{borderTopColor:'rgba(255,255,255,.6)',borderColor:'rgba(255,255,255,.2)'}}/> Creating…</>
                : <><Shield size={15}/> Create Admin Account</>
              }
            </button>
          </form>
        </div>

        <p className="setup-footer">EvalPro v2 · CIE Evaluation System</p>
      </div>
    </div>
  );
}
