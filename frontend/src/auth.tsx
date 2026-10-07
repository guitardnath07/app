import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { api, setApiToken, setOnUnauthorized } from "@/src/api";
import { queryClient } from "@/src/query-client";
import type { User } from "@/src/types";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "cp_session_token";
const AUTH_URL = "https://auth.emergentagent.com/?redirect=";

type AuthState = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  login: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  register: (b: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>;
  updateUser: (u: User) => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(new Set<string>());

  const clear = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setApiToken(null);
    queryClient.clear();
    setUser(null);
  }, []);

  const exchange = useCallback(async (sessionId: string) => {
    if (sent.current.has(sessionId)) return false;
    sent.current.add(sessionId);
    setSigningIn(true);
    try {
      const res = await api<{ session_token: string; user: User }>("/auth/session", {
        method: "POST",
        body: { session_id: sessionId },
      });
      await storage.secureSet(TOKEN_KEY, res.session_token);
      setApiToken(res.session_token);
      setUser(res.user);
      setError(null);
      return true;
    } catch {
      setError("Connexion impossible, réessayez.");
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      clear();
    });
    let sub: { remove: () => void } | undefined;
    (async () => {
      // 1. session_id in the URL first
      let sid: string | null = null;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        sid = extractSessionId(window.location.href);
      } else {
        sid = extractSessionId(await Linking.getInitialURL());
      }
      if (sid) {
        const ok = await exchange(sid);
        if (ok && Platform.OS === "web") {
          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");
          const hash = url.hash.replace(/^#/, "").split("&").filter((p) => !p.startsWith("session_id=")).join("&");
          url.hash = hash;
          window.history.replaceState(window.history.state, "", url.toString());
        }
        if (ok) {
          setLoading(false);
          return;
        }
      }
      // 2. existing token
      const t = await storage.secureGet(TOKEN_KEY, null);
      if (typeof t === "string" && t) {
        setApiToken(t);
        try {
          const me = await api<User>("/auth/me");
          setUser(me);
        } catch {
          await clear();
        }
      }
      setLoading(false);
    })();
    if (Platform.OS !== "web") {
      sub = Linking.addEventListener("url", ({ url }) => {
        const s = extractSessionId(url);
        if (s) exchange(s);
      });
    }
    return () => sub?.remove();
  }, [clear, exchange]);

  const login = useCallback(async () => {
    setError(null);
    if (Platform.OS === "web") {
      const redirect = window.location.origin + "/";
      window.location.href = AUTH_URL + encodeURIComponent(redirect);
      return;
    }
    const redirect = Linking.createURL("");
    let captured: string | null = null;
    const listener = Linking.addEventListener("url", ({ url }) => {
      captured = url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(AUTH_URL + encodeURIComponent(redirect), redirect);
      const url =
        (result.type === "success" ? result.url : null) ?? captured ?? (await Linking.getInitialURL());
      const sid = extractSessionId(url);
      if (sid) await exchange(sid);
    } catch {
      setError("Connexion impossible, réessayez.");
    } finally {
      listener.remove();
    }
  }, [exchange]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clear();
  }, [clear]);

  const finishLogin = useCallback(async (res: { session_token: string; user: User }) => {
    await storage.secureSet(TOKEN_KEY, res.session_token);
    setApiToken(res.session_token);
    setUser(res.user);
  }, []);

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      finishLogin(await api("/auth/login", { method: "POST", body: { email, password } }));
    },
    [finishLogin],
  );

  const register = useCallback(
    async (b: { email: string; password: string; first_name: string; last_name: string }) => {
      finishLogin(await api("/auth/register", { method: "POST", body: b }));
    },
    [finishLogin],
  );

  const deleteAccount = useCallback(async () => {
    await api("/me", { method: "DELETE" });
    await clear();
  }, [clear]);

  return (
    <AuthCtx.Provider
      value={{ user, loading, signingIn, error, login, loginEmail, register, updateUser: setUser, logout, deleteAccount }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
