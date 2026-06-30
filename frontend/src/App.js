import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './api';
import './index.css';

import Landing          from './pages/auth/Landing';
import SetupPage        from './pages/auth/SetupPage';
import { AdminLogin, TeacherLogin, StudentLogin, ChangePassword } from './pages/auth/AuthPages';

import AdminDashboard   from './pages/admin/AdminDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import StudentDashboard from './pages/student/StudentDashboard';

function Guard({ children, role: r, needAdmin }) {
  const { token, role, user } = useAuth();
  if (!token) return <Navigate to="/" replace/>;
  if (user?.isFirstLogin && window.location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace/>;
  if (needAdmin && !(role === 'teacher' && user?.isAdmin)) return <Navigate to="/" replace/>;
  if (r && role !== r) return <Navigate to="/" replace/>;
  return children;
}

// Checks if setup is needed — shows SetupPage before anything else
function AppRoutes() {
  const [needsSetup, setNeedsSetup] = useState(null); // null = loading

  useEffect(() => {
    api.get('/api/auth/setup-status')
      .then(r => setNeedsSetup(r.data.needsSetup))
      .catch(() => setNeedsSetup(false)); // on error assume setup done
  }, []);

  // While checking, show nothing (avoids flash)
  if (needsSetup === null) return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#f0f2f5'
    }}>
      <span className="spinner spinner-lg"/>
    </div>
  );

  // System has no admin — force setup first
  if (needsSetup) return (
    <Routes>
      <Route path="*" element={<SetupPage/>}/>
    </Routes>
  );

  // Normal app
  return (
    <Routes>
      <Route path="/"                element={<Landing/>}/>
      <Route path="/setup"           element={<Navigate to="/" replace/>}/>
      <Route path="/admin/login"     element={<AdminLogin/>}/>
      <Route path="/teacher/login"   element={<TeacherLogin/>}/>
      <Route path="/student/login"   element={<StudentLogin/>}/>
      <Route path="/change-password" element={<Guard><ChangePassword/></Guard>}/>
      <Route path="/admin/*"         element={<Guard role="teacher" needAdmin><AdminDashboard/></Guard>}/>
      <Route path="/teacher/*"       element={<Guard role="teacher"><TeacherDashboard/></Guard>}/>
      <Route path="/student/*"       element={<Guard role="student"><StudentDashboard/></Guard>}/>
      <Route path="*"                element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background:'#fff', color:'#111827',
              border:'1px solid #e5e7eb',
              fontFamily:'Inter,sans-serif', fontSize:13,
              borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,.08)'
            }
          }}
        />
        <AppRoutes/>
      </BrowserRouter>
    </AuthProvider>
  );
}
