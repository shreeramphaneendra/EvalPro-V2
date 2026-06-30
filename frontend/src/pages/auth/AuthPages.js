import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Shield, BookOpen, GraduationCap, ArrowLeft, Eye, EyeOff, BarChart2, Lock } from 'lucide-react';

function AuthLayout({ children, icon, accent, title, subtitle, backTo }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F6FB',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Inter',sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg,#FF6B35,#E85A22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(255,107,53,.4)',
            }}>
              <BarChart2 size={16} color="#fff"/>
            </div>
            <span style={{
              fontFamily: "'Outfit',sans-serif", fontSize: 17, fontWeight: 800,
              color: '#0D1117', letterSpacing: '-.02em',
            }}>
              Eval<span style={{ color: '#FF6B35' }}>Pro</span>
            </span>
          </div>
          {backTo && (
            <Link to={backTo} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12.5, color: '#8B97A8', textDecoration: 'none',
              transition: 'color .14s',
            }}
              onMouseEnter={e => e.currentTarget.style.color='#FF6B35'}
              onMouseLeave={e => e.currentTarget.style.color='#8B97A8'}
            >
              <ArrowLeft size={13}/> Back
            </Link>
          )}
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', border: '1px solid #E4E7F0',
          borderRadius: 20, padding: '32px 32px',
          boxShadow: '0 4px 24px rgba(13,17,23,.07)',
        }}>
          {/* Role badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: accent + '12', border: `1px solid ${accent}25`,
            borderRadius: 8, padding: '6px 12px', marginBottom: 20,
          }}>
            {icon}
            <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {title}
            </span>
          </div>

          <h2 style={{
            fontFamily: "'Outfit',sans-serif",
            fontSize: 22, fontWeight: 800, color: '#0D1117',
            letterSpacing: '-.02em', marginBottom: 4,
          }}>Sign in</h2>
          <p style={{ fontSize: 13, color: '#8B97A8', marginBottom: 24 }}>{subtitle}</p>

          {children}
        </div>
      </div>
    </div>
  );
}

function FInput({ label, name, type='text', placeholder, value, onChange, required, hint, autoFocus, style: s }) {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11.5, fontWeight: 700, color: '#4A5568',
        letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          name={name} type={isPw && show ? 'text' : type}
          placeholder={placeholder} value={value}
          onChange={onChange} required={required} autoFocus={autoFocus}
          style={{
            width: '100%', padding: '10px 13px',
            paddingRight: isPw ? 40 : 13,
            background: '#F8F9FC', border: '1.5px solid #E4E7F0',
            borderRadius: 10, color: '#0D1117',
            fontFamily: "'Inter',sans-serif", fontSize: 14,
            outline: 'none', transition: 'border-color .14s, box-shadow .14s, background .14s',
            ...s,
          }}
          onFocus={e => { e.target.style.borderColor='#FF6B35'; e.target.style.boxShadow='0 0 0 3px rgba(255,107,53,.12)'; e.target.style.background='#fff'; }}
          onBlur={e => { e.target.style.borderColor='#E4E7F0'; e.target.style.boxShadow='none'; e.target.style.background='#F8F9FC'; }}
        />
        {isPw && (
          <button type="button" onClick={() => setShow(!show)} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#8B97A8',
            display: 'flex', alignItems: 'center',
          }}>
            {show ? <EyeOff size={15}/> : <Eye size={15}/>}
          </button>
        )}
      </div>
      {hint && <p style={{ fontSize: 11.5, color: '#8B97A8', marginTop: 5 }}>{hint}</p>}
    </div>
  );
}

function SubmitBtn({ loading, accent, children }) {
  return (
    <button type="submit" disabled={loading} style={{
      width: '100%', padding: '11px', border: 'none',
      borderRadius: 10, fontSize: 14, fontWeight: 700,
      background: loading ? '#E4E7F0' : `linear-gradient(135deg,${accent},${accent}CC)`,
      color: loading ? '#8B97A8' : '#fff',
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'all .16s',
      boxShadow: loading ? 'none' : `0 4px 16px ${accent}35`,
      marginTop: 8,
    }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${accent}45`; } }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=loading?'none':`0 4px 16px ${accent}35`; }}
    >
      {loading
        ? <><span className="spinner" style={{ borderTopColor: '#8B97A8', borderColor: '#d1d5db' }}/> Signing in...</>
        : children
      }
    </button>
  );
}

export function AdminLogin() {
  const nav = useNavigate(); const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await api.post('/api/auth/admin/login', form);
      login(data.user, data.token, 'teacher');
      toast.success(`Welcome, ${data.user.name.split(' ')[0]}!`);
      nav('/admin');
    } catch(err) { toast.error(err.response?.data?.message || 'Login failed'); }
    finally { setLoading(false); }
  };
  return (
    <AuthLayout icon={<Shield size={14} color="#FF6B35"/>} accent="#FF6B35"
      title="Admin Portal" subtitle="Department administration & HOD dashboard" backTo="/">
      <form onSubmit={submit}>
        <FInput label="Email address" name="email" type="email" placeholder="admin@cbit.ac.in" value={form.email} onChange={set} required autoFocus/>
        <FInput label="Password" name="password" type="password" placeholder="Your password" value={form.password} onChange={set} required/>
        <SubmitBtn loading={loading} accent="#FF6B35"><Shield size={14}/> Sign in as Admin</SubmitBtn>
      </form>
    </AuthLayout>
  );
}

export function TeacherLogin() {
  const nav = useNavigate(); const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await api.post('/api/auth/teacher/login', form);
      login(data.user, data.token, 'teacher');
      toast.success(`Welcome, ${data.user.name.split(' ')[0]}!`);
      if (data.user.isFirstLogin) nav('/change-password');
      else if (data.user.isAdmin) nav('/admin');
      else nav('/teacher');
    } catch(err) { toast.error(err.response?.data?.message || 'Login failed'); }
    finally { setLoading(false); }
  };
  return (
    <AuthLayout icon={<BookOpen size={14} color="#3B82F6"/>} accent="#3B82F6"
      title="Teacher Portal" subtitle="CIE mark entry, assignments, mentoring" backTo="/">
      <form onSubmit={submit}>
        <FInput label="Email address" name="email" type="email" placeholder="teacher@cbit.ac.in" value={form.email} onChange={set} required autoFocus/>
        <FInput label="Password" name="password" type="password" placeholder="Your password" value={form.password} onChange={set} required/>
        <SubmitBtn loading={loading} accent="#3B82F6"><BookOpen size={14}/> Sign in as Teacher</SubmitBtn>
      </form>
    </AuthLayout>
  );
}

export function StudentLogin() {
  const nav = useNavigate(); const { login } = useAuth();
  const [form, setForm] = useState({ usn: '', password: '' });
  const [loading, setLoading] = useState(false);
  const set = e => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await api.post('/api/auth/student/login', form);
      login(data.user, data.token, 'student');
      toast.success(`Welcome, ${data.user.name.split(' ')[0]}!`);
      nav(data.user.isFirstLogin ? '/change-password' : '/student');
    } catch(err) { toast.error(err.response?.data?.message || 'Invalid roll number or password'); }
    finally { setLoading(false); }
  };
  return (
    <AuthLayout icon={<GraduationCap size={14} color="#10B981"/>} accent="#10B981"
      title="Student Portal" subtitle="View CIE marks, assignments, mentor details" backTo="/">
      <div style={{
        background: '#F0FDF9', border: '1px solid #A7F3D0',
        borderRadius: 8, padding: '9px 13px', marginBottom: 20, fontSize: 12.5,
        color: '#065F46', lineHeight: 1.5,
      }}>
        💡 Username: your <strong>Roll Number (USN)</strong> · Default password: your roll number
      </div>
      <form onSubmit={submit}>
        <FInput label="Roll Number (USN)" name="usn" placeholder="160124737047"
          value={form.usn} onChange={e => setForm({...form, usn: e.target.value.toUpperCase()})}
          required autoFocus style={{ textTransform: 'uppercase', fontFamily: "'JetBrains Mono',monospace" }}/>
        <FInput label="Password" name="password" type="password" placeholder="Default: your roll number" value={form.password} onChange={set} required/>
        <SubmitBtn loading={loading} accent="#10B981"><GraduationCap size={14}/> Sign in as Student</SubmitBtn>
      </form>
    </AuthLayout>
  );
}

export function ChangePassword() {
  const nav = useNavigate(); const { user, role, updateUser } = useAuth();
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.newPassword.length < 6) { toast.error('Minimum 6 characters'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/change-password', { newPassword: form.newPassword });
      updateUser({ ...user, isFirstLogin: false });
      toast.success('Password set! Please sign in again.');
      nav(role === 'student' ? '/student/login' : user?.isAdmin ? '/admin/login' : '/teacher/login');
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };
  return (
    <AuthLayout icon={<Lock size={14} color="#FF6B35"/>} accent="#FF6B35"
      title="Set Password" subtitle="Required before you can continue">
      <div style={{
        background: '#FFF4F0', border: '1px solid #FFD0BC',
        borderRadius: 8, padding: '9px 13px', marginBottom: 20, fontSize: 12.5,
        color: '#C44A18', lineHeight: 1.5,
      }}>
        🔒 First login — set a strong password to secure your account.
      </div>
      <form onSubmit={submit}>
        <FInput label="New Password" name="newPassword" type="password" placeholder="At least 6 characters"
          value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})} required autoFocus/>
        <FInput label="Confirm Password" name="confirm" type="password" placeholder="Type it again"
          value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required/>
        <SubmitBtn loading={loading} accent="#FF6B35"><Lock size={14}/> Set Password & Continue</SubmitBtn>
      </form>
    </AuthLayout>
  );
}

export default AdminLogin;
