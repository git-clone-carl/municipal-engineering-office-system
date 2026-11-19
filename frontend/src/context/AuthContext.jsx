import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStaffGuide, setShowStaffGuide] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      Promise.all([api.getMe(), api.getPermissions()])
        .then(([userData, permData]) => {
          setUser(userData);
          setPermissions(permData.modules);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const permData = await api.getPermissions();
    setPermissions(permData.modules);
    if (data.user?.role === 'engineering_staff') {
      const hidden = localStorage.getItem(`hide_staff_guide_${data.user.id}`) === 'true';
      if (!hidden) setShowStaffGuide(true);
    }
    return data;
  };

  const register = async (userData) => {
    const data = await api.register(userData);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const permData = await api.getPermissions();
    setPermissions(permData.modules);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPermissions([]);
    setShowStaffGuide(false);
  };

  const dismissStaffGuide = () => setShowStaffGuide(false);

  const hasAccess = (module) => permissions.includes(module);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        showStaffGuide,
        dismissStaffGuide,
        login,
        register,
        logout,
        hasAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
