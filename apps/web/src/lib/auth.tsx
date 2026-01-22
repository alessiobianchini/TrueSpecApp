"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

type User = {
  id: string;
  email: string;
  name?: string | null;
};

type Org = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  orgs: Org[];
  activeOrgId: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (payload: {
    email: string;
    password: string;
    name?: string;
    orgName?: string;
  }) => Promise<boolean>;
  logout: () => void;
  setActiveOrgId: (orgId: string) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "truespec_token";
const ORG_KEY = "truespec_org";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistOrg = (orgId: string) => {
    setActiveOrgIdState(orgId);
    localStorage.setItem(ORG_KEY, orgId);
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    setOrgs([]);
    setActiveOrgIdState(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_KEY);
  };

  const loadMe = async (sessionToken: string) => {
    const data = await apiRequest<{ user: User; orgs: Org[] }>("/v1/auth/me", {
      token: sessionToken,
    });
    setUser(data.user);
    setOrgs(data.orgs);

    const storedOrg = localStorage.getItem(ORG_KEY);
    if (storedOrg && data.orgs.some((org) => org.id === storedOrg)) {
      setActiveOrgIdState(storedOrg);
    } else if (data.orgs.length > 0) {
      persistOrg(data.orgs[0].id);
    }
  };

  const refresh = async () => {
    if (!token) return;
    await loadMe(token);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);
    loadMe(storedToken)
      .catch((err) => {
        setError(err.message);
        clearSession();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const data = await apiRequest<{ token: string }>("/v1/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      await loadMe(data.token);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      return false;
    }
  };

  const register = async (payload: {
    email: string;
    password: string;
    name?: string;
    orgName?: string;
  }) => {
    setError(null);
    try {
      const data = await apiRequest<{ token: string }>("/v1/auth/register", {
        method: "POST",
        body: payload,
      });
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      await loadMe(data.token);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
      return false;
    }
  };

  const logout = () => {
    clearSession();
  };

  const contextValue = useMemo(
    () => ({
      token,
      user,
      orgs,
      activeOrgId,
      loading,
      error,
      login,
      register,
      logout,
      setActiveOrgId: persistOrg,
      refresh,
    }),
    [token, user, orgs, activeOrgId, loading, error]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
