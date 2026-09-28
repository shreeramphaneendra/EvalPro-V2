import React from 'react';

// Without this, a single render error anywhere unmounts the entire React tree
// and the user sees a blank white page with no explanation — which is exactly
// what a production build does (no dev overlay). This catches it and shows
// something actionable instead.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[EvalPro] render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:99999,
        display:'flex', alignItems:'center', justifyContent:'center',
        background:'#F8FAFC', padding:20, overflowY:'auto',
      }}>
        <div style={{ maxWidth:440, width:'100%', textAlign:'center' }}>
          <div style={{ fontSize:44, marginBottom:14 }}>⚠️</div>
          <h1 style={{
            fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22,
            color:'#1E293B', marginBottom:10,
          }}>
            Something went wrong on this page
          </h1>
          <p style={{ fontSize:14, color:'#64748B', lineHeight:1.6, marginBottom:22 }}>
            Your data is safe — nothing was lost. Reloading usually fixes it.
            If it keeps happening, please report it to the department.
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding:'12px 24px', background:'linear-gradient(135deg,#FF6B35,#E55A2B)',
                border:'none', borderRadius:10, color:'#fff', fontWeight:700,
                fontSize:14, cursor:'pointer',
              }}>
              Reload page
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding:'12px 24px', background:'#fff', border:'1px solid #CBD5E1',
                borderRadius:10, color:'#334155', fontWeight:600,
                fontSize:14, cursor:'pointer',
              }}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
