import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, BarChart2, Menu, X, Bell } from 'lucide-react';

export function Layout({ nav, children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const doLogout = () => { logout(); navigate('/'); };
  const initials = (user?.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="page-layout">
      {/* Mobile hamburger */}
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
        {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
      </button>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)}/>}
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
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
                onClick={() => { navigate(item.switchTo || item.path); setMobileOpen(false); }}
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
          <NotificationBell/>
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


/* ── NOTIFICATION BELL ──────────────────────────────────────────────── */
export function NotificationBell() {
  const [open,   setOpen]   = useState(false);
  const [items,  setItems]  = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading,setLoading]= useState(false);
  const navigate = useNavigate();

  const loadCount = async () => {
    try { const { data } = await api.get('/api/notifications/unread-count'); setUnread(data.unread || 0); }
    catch {}
  };
  const loadItems = async () => {
    setLoading(true);
    try { const { data } = await api.get('/api/notifications', { params:{ limit:20 } });
      setItems(data.items || []); setUnread(data.unread || 0); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    loadCount();
    const id = setInterval(loadCount, 60000);  // poll once a minute
    return () => clearInterval(id);
  }, []);

  const toggle = () => { const next = !open; setOpen(next); if (next) loadItems(); };

  const openItem = async (n) => {
    if (!n.read) {
      try { await api.post(`/api/notifications/${n._id}/read`); } catch {}
      setItems(list => list.map(x => x._id === n._id ? { ...x, read:true } : x));
      setUnread(u => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    try { await api.post('/api/notifications/read-all'); } catch {}
    setItems(list => list.map(x => ({ ...x, read:true })));
    setUnread(0);
  };

  const ago = (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    if (s < 604800) return `${Math.floor(s/86400)}d ago`;
    return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  };

  return (
    <div style={{position:'relative'}}>
      <button onClick={toggle} aria-label="Notifications"
        style={{position:'relative',width:38,height:38,borderRadius:12,
          border:'1px solid var(--border)',background:'var(--surface)',
          cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          marginRight:10}}>
        <Bell size={17} color={unread>0?'var(--brand)':'var(--text2)'}/>
        {unread > 0 && (
          <span style={{position:'absolute',top:-4,right:-4,minWidth:18,height:18,
            padding:'0 5px',borderRadius:9,background:'var(--brand)',color:'#fff',
            fontSize:10,fontWeight:800,display:'flex',alignItems:'center',
            justifyContent:'center',border:'2px solid var(--surface)'}}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={()=>setOpen(false)}
            style={{position:'fixed',inset:0,zIndex:1400}}/>
          <div style={{position:'absolute',top:46,right:0,zIndex:1401,
            width:'min(380px, calc(100vw - 32px))',maxHeight:460,
            background:'var(--surface)',border:'1px solid var(--border)',
            borderRadius:'var(--r3)',boxShadow:'0 12px 40px rgba(0,0,0,.18)',
            overflow:'hidden',display:'flex',flexDirection:'column'}}>

            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',
              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:"'Outfit',sans-serif",fontWeight:700,fontSize:14}}>
                Notifications {unread > 0 && <span style={{color:'var(--brand)'}}>({unread})</span>}
              </span>
              {unread > 0 && (
                <button onClick={markAll}
                  style={{border:'none',background:'none',color:'var(--brand)',
                    fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  Mark all read
                </button>
              )}
            </div>

            <div style={{overflowY:'auto',flex:1}}>
              {loading ? (
                <div style={{padding:32,textAlign:'center'}}><Spinner/></div>
              ) : items.length === 0 ? (
                <div style={{padding:'36px 20px',textAlign:'center',color:'var(--text3)'}}>
                  <div style={{fontSize:28,marginBottom:8}}>🔔</div>
                  <div style={{fontSize:13}}>No notifications yet</div>
                </div>
              ) : items.map(n => (
                <div key={n._id} onClick={()=>openItem(n)}
                  style={{padding:'12px 16px',borderBottom:'1px solid var(--border2)',
                    cursor:'pointer',display:'flex',gap:12,
                    background: n.read ? 'transparent' : 'var(--brand-l)'}}>
                  <span style={{fontSize:17,lineHeight:1.3,flexShrink:0}}>{n.icon || '🔔'}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:n.read?500:700,
                      color:'var(--text)',marginBottom:2}}>{n.title}</div>
                    {n.body && <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.5}}>{n.body}</div>}
                    <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>{ago(n.createdAt)}</div>
                  </div>
                  {!n.read && <span style={{width:7,height:7,borderRadius:'50%',
                    background:'var(--brand)',flexShrink:0,marginTop:5}}/>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
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
