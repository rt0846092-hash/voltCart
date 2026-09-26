import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokens } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Restore the session on page load
  useEffect(() => {
    if (!tokens.access) {
      setReady(true);
      return;
    }
    api("/auth/me/")
      .then(setUser)
      .catch(() => tokens.clear())
      .finally(() => setReady(true));
  }, []);

  const finish = useCallback((data) => {
    tokens.set(data);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    (email, password) => api("/auth/login/", { method: "POST", body: { email, password }, auth: false }).then(finish),
    [finish]
  );
  const register = useCallback(
    (name, email, password) =>
      api("/auth/register/", { method: "POST", body: { name, email, password }, auth: false }).then(finish),
    [finish]
  );
  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
