import React, { createContext, useContext, useState } from 'react';

const Ctx = createContext();

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [role,  setRole]  = useState(() => localStorage.getItem('role')  || null);

  // Token is attached to every request by the axios interceptor in api.js
  // (it reads localStorage fresh on each call), so there is no effect-timing
  // race where a request could fire before the auth header is set.

  const login = (u, t, r) => {
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('token', t);
    localStorage.setItem('role', r);
    setUser(u); setToken(t); setRole(r);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null); setToken(null); setRole(null);
  };

  const updateUser = u => { setUser(u); localStorage.setItem('user', JSON.stringify(u)); };

  return <Ctx.Provider value={{ user, token, role, login, logout, updateUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
