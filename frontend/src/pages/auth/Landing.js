import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, ArrowRight, Shield, BookOpen, GraduationCap, CheckCircle, ChevronRight } from 'lucide-react';

export default function Landing() {
  const nav = useNavigate();
  const [hovered, setHovered] = useState(null);

  const roles = [
    {
      id: 'admin',
      icon: <Shield size={18} color="#FF6B35"/>,
      label: 'Admin',
      sub: 'Department Administration',
      desc: 'Manage teachers, import students, assign subjects, track promotions.',
      path: '/admin/login',
      accent: '#FF6B35',
      bg: '#FFF4F0',
      border: '#FFD0BC',
    },
    {
      id: 'teacher',
      icon: <BookOpen size={18} color="#3B82F6"/>,
      label: 'Teacher',
      sub: 'Faculty & Lab Instructors',
      desc: 'Enter question-wise CIE marks, manage assignments, view CO attainment.',
      path: '/teacher/login',
      accent: '#3B82F6',
      bg: '#EFF6FF',
      border: '#BFDBFE',
    },
    {
      id: 'student',
      icon: <GraduationCap size={18} color="#10B981"/>,
      label: 'Student',
      sub: 'B.Tech · M.Tech · MBA',
      desc: 'Check published CIE marks with full breakdown. Submit assignments.',
      path: '/student/login',
      accent: '#10B981',
      bg: '#ECFDF5',
      border: '#A7F3D0',
    },
  ];

  const features = [
    'Question-wise CT1, CT2 entry with CO mapping',
    'Either/Or questions — auto-picks higher score',
    'Attendance formula built in (85/80/75/70)',
    'Lab CIE: ALI + AWCIE with weekly tracking',
    'CO Attainment report for NBA/NAAC',
    'Bulk student import from Excel',
    'Promotion, detention, supply management',
    'Medical condonation support',
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Inter', sans-serif",
      background: '#F4F6FB',
    }}>
      {/* Left panel — brand */}
      <div style={{
        width: '42%',
        minHeight: '100vh',
        background: '#0A0E1A',
        padding: '48px 52px',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'auto' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg,#FF6B35,#E85A22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(255,107,53,.5)',
          }}>
            <BarChart2 size={20} color="#fff"/>
          </div>
          <div>
            <div style={{
              fontFamily: "'Outfit',sans-serif", fontSize: 20, fontWeight: 800,
              color: '#fff', letterSpacing: '-.02em',
            }}>
              Eval<span style={{ color: '#FF6B35' }}>Pro</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              CIE Evaluation System
            </div>
          </div>
        </div>

        {/* Main headline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#FF6B35',
            letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            Chaitanya Bharathi Institute of Technology
          </div>

          <h1 style={{
            fontFamily: "'Outfit',sans-serif",
            fontSize: 44, fontWeight: 900, color: '#fff',
            lineHeight: 1.08, letterSpacing: '-.03em',
            marginBottom: 20,
          }}>
            CIE marks.<br/>
            <span style={{
              background: 'linear-gradient(135deg,#FF6B35,#FFB347)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Done right.</span>
          </h1>

          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,.5)',
            lineHeight: 1.7, marginBottom: 36, maxWidth: 380,
          }}>
            A complete CIE evaluation portal built for autonomous colleges. 
            From question-wise marks to CO attainment reports.
          </p>

          {/* Features list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.slice(0,6).map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'rgba(255,255,255,.55)' }}>
                <CheckCircle size={14} color="#FF6B35" style={{ flexShrink: 0, marginTop: 1 }}/>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Developer credit */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,.08)',
          paddingTop: 24, marginTop: 40,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{fontSize:10,color:'rgba(255,107,53,.6)',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase'}}>
            Developed by
          </div>
          <div style={{
            fontFamily:"'Outfit',sans-serif",
            fontWeight: 800, fontSize: 18, color: '#fff',
            letterSpacing: '-.01em'
          }}>
            Majeti Shreeram Phaneendra
          </div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.35)',marginTop:1}}>
            B.Tech Information Technology · CBIT, Hyderabad
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.15)',marginTop:10}}>
            EvalPro · CIE Evaluation System · 2026–27
          </div>
        </div>
      </div>

      {/* Right panel — login */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 52px',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{
            fontFamily: "'Outfit',sans-serif",
            fontSize: 26, fontWeight: 800,
            color: '#0D1117', letterSpacing: '-.02em',
            marginBottom: 6,
          }}>
            Sign in to your portal
          </h2>
          <p style={{ fontSize: 13.5, color: '#4A5568', marginBottom: 32 }}>
            Select your role to continue
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => nav(role.path)}
                onMouseEnter={() => setHovered(role.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px 20px',
                  background: hovered === role.id ? role.bg : '#fff',
                  border: `1.5px solid ${hovered === role.id ? role.border : '#E4E7F0'}`,
                  borderRadius: 14, cursor: 'pointer',
                  transition: 'all .16s',
                  transform: hovered === role.id ? 'translateX(4px)' : 'none',
                  boxShadow: hovered === role.id ? `0 4px 20px rgba(0,0,0,.06)` : '0 1px 3px rgba(0,0,0,.05)',
                  textAlign: 'left', width: '100%',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 11,
                  background: role.bg,
                  border: `1px solid ${role.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'transform .16s',
                  transform: hovered === role.id ? 'scale(1.05)' : 'none',
                }}>
                  {role.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'Outfit',sans-serif",
                    fontSize: 16, fontWeight: 700, color: '#0D1117',
                    letterSpacing: '-.01em',
                  }}>{role.label}</div>
                  <div style={{ fontSize: 11.5, color: '#8B97A8', marginTop: 1 }}>{role.sub}</div>
                  <div style={{ fontSize: 12.5, color: '#4A5568', marginTop: 5, lineHeight: 1.5 }}>
                    {role.desc}
                  </div>
                </div>
                <ChevronRight size={18} color={hovered === role.id ? role.accent : '#CBD5E0'}
                  style={{ flexShrink: 0, transition: 'color .16s, transform .16s',
                    transform: hovered === role.id ? 'translateX(2px)' : 'none' }}/>
              </button>
            ))}
          </div>

          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
            gap: 1, marginTop: 36,
            background: '#E4E7F0', borderRadius: 12, overflow: 'hidden',
          }}>
            {[
              { val: '40', label: 'Theory CIE max marks' },
              { val: '50', label: 'Lab CIE max marks' },
              { val: '8', label: 'Semesters tracked' },
            ].map(s => (
              <div key={s.val} style={{
                background: '#fff', padding: '14px 16px', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: "'Outfit',sans-serif",
                  fontSize: 24, fontWeight: 800, color: '#FF6B35', lineHeight: 1,
                }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#8B97A8', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
