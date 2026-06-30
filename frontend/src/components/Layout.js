import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, BarChart2 } from 'lucide-react';

export function Layout({ nav, children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const doLogout = () => { logout(); navigate('/'); };
  const initials = (user?.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="page-layout">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <BarChart2 size={17} color="#fff"/>
          </div>
          <div>
            <div className="sidebar-logo-text">Eval<span>Pro</span></div>
            <div className="sidebar-version">CIE Portal · 2026-27</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="sidebar-nav">
          {nav.map((item, i) => {
            if (item.type === 'section') return (
              <div key={i} className="nav-section-title">{item.label}</div>
            );
            const isActive = location.pathname === item.path ||
              (!item.switchTo && item.match && location.pathname.startsWith(item.match));
            return (
              <button key={i}
                className={`nav-item${isActive && !item.switchTo ? ' active' : ''}`}
                onClick={() => navigate(item.switchTo || item.path)}
                style={item.switchTo ? { color:'#FF6B35', opacity:.85 } : undefined}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User + sign out */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">
                {user?.isAdmin ? 'Admin · Teacher' : user?.role}
              </div>
            </div>
          </div>
          <button className="nav-item" onClick={doLogout}
            style={{ color:'#F87171', gap:8 }}>
            <LogOut size={14} style={{ opacity:.9 }}/>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <span className="topbar-title">{title}</span>
            {subtitle && <span className="topbar-sub">{subtitle}</span>}
          </div>
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.isAdmin ? 'Admin' : user?.role}</div>
            </div>
          </div>
        </div>

        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ size = 'sm' }) {
  return <span className={`spinner${size === 'lg' ? ' spinner-lg' : ''}`}/>;
}

export function Empty({ icon = '📋', msg = 'Nothing here yet', sub }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <p className="empty-title">{msg}</p>
      {sub && <p className="empty-sub">{sub}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, gap:12 }}>
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'var(--text3)', fontSize:22, lineHeight:1,
            width:30, height:30, display:'flex', alignItems:'center',
            justifyContent:'center', borderRadius:6, flexShrink:0,
            transition:'background .13s, color .13s'
          }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--surface2)'; e.currentTarget.style.color='var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--text3)'; }}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
