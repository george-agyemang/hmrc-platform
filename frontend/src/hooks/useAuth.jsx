import { useState, useEffect, createContext, useContext } from 'react';
import { authService } from '../services/api.jsx';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authService.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  return <AuthContext.Provider value={{ user, loading, login: setUser, logout: () => setUser(null) }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
