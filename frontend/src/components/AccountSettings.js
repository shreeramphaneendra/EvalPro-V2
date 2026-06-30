import React, { useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Spinner } from './Layout';
import { KeyRound, User } from 'lucide-react';

export default function AccountSettings({ accent = '#FF6B35', fields = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [saving, setSaving] = useState(false);

  const savePassword = async e => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) { toast.error('Passwords do not match'); return; }
    if (pw.newPassword.length < 6) { toast.error('Min 6 characters'); return; }
    setSaving(true);
    try {
      await api.put('/api/auth/change-my-password', {
        currentPassword: pw.currentPassword, newPassword: pw.newPassword
      });
      toast.success('Password changed — signing you out.');
      setTimeout(() => { logout(); navigate('/'); }, 1400);
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Profile info */}
      <div className="card fade-up">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div style={{
            width:36, height:36, borderRadius:9,
            background: accent + '12', border:`1px solid ${accent}25`,
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <User size={16} color={accent}/>
          </div>
          <div>
            <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:15, fontWeight:700 }}>My Profile</h3>
            <p style={{ fontSize:12, color:'var(--text2)', marginTop:1 }}>Your account details</p>
          </div>
        </div>

        <div style={{
          display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:12
        }}>
          <ProfileField label="Name"   value={user?.name}/>
          {user?.email && <ProfileField label="Email"       value={user.email}/>}
          {user?.usn   && <ProfileField label="Roll Number" value={user.usn} mono/>}
          {fields.map(f => <ProfileField key={f.label} label={f.label} value={f.value} mono={f.mono}/>)}
        </div>

        <p style={{ fontSize:11.5, color:'var(--text3)', marginTop:14, fontStyle:'italic' }}>
          To update your profile details, contact your department administrator.
        </p>
      </div>

      {/* Change password */}
      <div className="card fade-up2">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{
            width:36, height:36, borderRadius:9,
            background:'#FEF2F2', border:'1px solid #FECACA',
            display:'flex', alignItems:'center', justifyContent:'center'
          }}>
            <KeyRound size={16} color="var(--red)"/>
          </div>
          <div>
            <h3 style={{ fontFamily:"'Outfit',sans-serif", fontSize:15, fontWeight:700 }}>Change Password</h3>
            <p style={{ fontSize:12, color:'var(--text2)', marginTop:1 }}>You'll be signed out after changing</p>
          </div>
        </div>

        <div className="alert alert-amber" style={{ fontSize:12, marginBottom:16 }}>
          ⚠ You will be automatically signed out after your password is changed.
        </div>

        <form onSubmit={savePassword} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="form-group">
            <label className="lbl">Current Password</label>
            <input className="input" type="password" placeholder="Your current password"
              value={pw.currentPassword} onChange={e=>setPw({...pw,currentPassword:e.target.value})} required/>
          </div>
          <div className="g2">
            <div className="form-group">
              <label className="lbl">New Password</label>
              <input className="input" type="password" placeholder="Min 6 characters"
                value={pw.newPassword} onChange={e=>setPw({...pw,newPassword:e.target.value})} required minLength={6}/>
            </div>
            <div className="form-group">
              <label className="lbl">Confirm Password</label>
              <input className="input" type="password" placeholder="Type again"
                value={pw.confirm} onChange={e=>setPw({...pw,confirm:e.target.value})} required/>
            </div>
          </div>
          <button className="btn btn-danger" type="submit" disabled={saving} style={{ alignSelf:'flex-start' }}>
            {saving ? <Spinner/> : <><KeyRound size={13}/> Change Password</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProfileField({ label, value, mono }) {
  return (
    <div style={{
      padding:'11px 14px', background:'var(--surface2)',
      borderRadius:'var(--r2)', border:'1px solid var(--border)'
    }}>
      <div style={{
        fontSize:10, color:'var(--text3)', fontWeight:700,
        textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5
      }}>{label}</div>
      <div style={{
        fontWeight:600, fontSize:13.5, color:'var(--text)',
        fontFamily: mono ? "'JetBrains Mono',monospace" : 'inherit'
      }}>{value || '—'}</div>
    </div>
  );
}
