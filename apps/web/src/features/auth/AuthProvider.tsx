import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { demoUsers } from "../../shared/data";
import type { AccessIdentityDraft, UserProfile } from "../../shared/types";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";
import {
  loadActiveProfile,
  listSchoolProfiles,
  provisionSchoolAccessUser,
  requestOtpSignIn,
  signInWithEmail,
  signInWithGoogle,
  syncNeutralProfile,
  signOutActiveSession,
  updateSchoolUserAccessStatus
} from "./authRepository";

interface AuthContextValue {
  activeUser: UserProfile | null;
  users: UserProfile[];
  demoMode: boolean;
  pendingAccessEmail: string;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  selectDemoUser: (userId: string) => void;
  provisionAccess: (draft: AccessIdentityDraft) => Promise<{ ok: boolean; error?: string }>;
  updateAccessStatus: (
    userId: string,
    status: NonNullable<UserProfile["status"]>
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithMatricule: (
    identifier: string,
    password?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [localUsers, setLocalUsers] = useState<UserProfile[]>(demoUsers);
  const [liveUser, setLiveUser] = useState<UserProfile | null>(null);
  const [liveUsers, setLiveUsers] = useState<UserProfile[]>([]);
  const [pendingAccessEmail, setPendingAccessEmail] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(!env.demoMode && Boolean(supabase));

  useEffect(() => {
    if (!supabase || env.demoMode) {
      return;
    }

    const client = supabase;
    let mounted = true;

    async function hydrateSession() {
      setIsAuthLoading(true);
      const { data } = await client.auth.getSession();
      const sessionUser = data.session?.user;
      const sessionUserId = sessionUser?.id;

      if (!sessionUserId) {
        if (mounted) {
          setLiveUser(null);
          setIsAuthLoading(false);
        }
        return;
      }

      try {
        if (sessionUser) {
          await syncNeutralProfile(sessionUser);
        }
        const profile = await loadActiveProfile(sessionUserId);
        if (mounted) {
          setLiveUser(profile);
          setPendingAccessEmail(profile ? "" : sessionUser.email ?? "approved Google account");
          if (profile?.schoolId) {
            const schoolUsers = await listSchoolProfiles(profile.schoolId);
            if (mounted) {
              setLiveUsers(schoolUsers);
            }
          }
        }
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    }

    void hydrateSession();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      const sessionUserId = sessionUser?.id;

      if (!sessionUserId) {
        setLiveUser(null);
        setLiveUsers([]);
        setPendingAccessEmail("");
        setIsAuthLoading(false);
        return;
      }

      void (async () => {
        await syncNeutralProfile(sessionUser);
        return loadActiveProfile(sessionUserId);
      })()
        .then(async (profile) => {
          setLiveUser(profile);
          setPendingAccessEmail(profile ? "" : sessionUser.email ?? "approved Google account");
          if (profile?.schoolId) {
            const schoolUsers = await listSchoolProfiles(profile.schoolId);
            setLiveUsers(schoolUsers);
          } else {
            setLiveUsers([]);
          }
        })
        .finally(() => {
          setIsAuthLoading(false);
        });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const activeDemoUser = localUsers.find((user) => user.id === activeUserId) ?? null;
  const activeUser = env.demoMode || !supabase ? activeDemoUser : liveUser;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem("dreem:access-users");
    if (!raw) {
      return;
    }

    try {
      setLocalUsers(JSON.parse(raw) as UserProfile[]);
    } catch {
      setLocalUsers(demoUsers);
    }
  }, []);

  function persistLocalUsers(nextUsers: UserProfile[]) {
    setLocalUsers(nextUsers);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dreem:access-users", JSON.stringify(nextUsers));
    }
  }

  async function loginWithMatricule(identifier: string, password = "") {
    if (!supabase || env.demoMode) {
      const matched = localUsers.find(
        (user) => user.matricule.toLowerCase() === identifier.toLowerCase()
      );

      if (!matched) {
        return { ok: false, error: "That matricule is not in the current demo school list." };
      }

      setActiveUserId(matched.id);
      return { ok: true };
    }

    const normalized = identifier.trim();

    if (!normalized.includes("@") && !normalized.startsWith("+")) {
      return {
        ok: false,
        error:
          "Matricule-only live login needs the secure Supabase resolver/Edge Function. Use school email or phone OTP for now."
      };
    }

    setIsAuthLoading(true);
    const result = password
      ? await signInWithEmail(normalized, password)
      : await requestOtpSignIn(normalized);
    if (!result.ok) {
      setIsAuthLoading(false);
    }
    return result;
  }

  async function provisionAccess(draft: AccessIdentityDraft) {
    const normalizedMatricule = draft.matricule.trim().toUpperCase();

    if (!normalizedMatricule || !draft.fullName.trim()) {
      return { ok: false, error: "Full name and matricule are required." };
    }

    const comparableUsers = env.demoMode || !supabase ? localUsers : liveUsers;

    if (comparableUsers.some((user) => user.matricule.toUpperCase() === normalizedMatricule)) {
      return { ok: false, error: "That matricule already exists in this school." };
    }

    if (!env.demoMode && supabase) {
      if (!activeUser?.schoolId) {
        return { ok: false, error: "No active school context was found." };
      }

      const result = await provisionSchoolAccessUser(activeUser.schoolId, {
        ...draft,
        matricule: normalizedMatricule
      });

      if (!result.ok) {
        return result;
      }

      const profiles = await listSchoolProfiles(activeUser.schoolId);
      setLiveUsers(profiles);
      return { ok: true as const };
    }

    const nextUser: UserProfile = {
      id: `u-${Date.now()}`,
      name: draft.fullName.trim(),
      role: draft.role,
      department: draft.department.trim() || "General",
      matricule: normalizedMatricule,
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      schoolId: "demo-school",
      status: "invited"
    };

    persistLocalUsers([nextUser, ...localUsers]);
    return { ok: true as const };
  }

  async function updateAccessStatus(
    userId: string,
    status: NonNullable<UserProfile["status"]>
  ) {
    if (activeUser?.id === userId) {
      return { ok: false, error: "You cannot change your own access status." };
    }

    if (!env.demoMode && supabase) {
      if (!activeUser?.schoolId) {
        return { ok: false, error: "No active school context was found." };
      }

      const result = await updateSchoolUserAccessStatus(activeUser.schoolId, userId, status);

      if (!result.ok) {
        return result;
      }

      const profiles = await listSchoolProfiles(activeUser.schoolId);
      setLiveUsers(profiles);
      return { ok: true as const };
    }

    const nextUsers = localUsers.map((user) =>
      user.id === userId ? { ...user, status } : user
    );
    persistLocalUsers(nextUsers);
    return { ok: true as const };
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      activeUser,
      users: env.demoMode || !supabase ? localUsers : liveUsers,
      demoMode: env.demoMode || !supabase,
      pendingAccessEmail,
      isAuthLoading,
      isAuthenticated: Boolean(activeUser),
      selectDemoUser: setActiveUserId,
      provisionAccess,
      updateAccessStatus,
      loginWithMatricule,
      loginWithGoogle: async () => {
        if (env.demoMode || !supabase) {
          return {
            ok: false,
            error: "Google login is available in live Supabase mode after the Google provider is configured."
          };
        }

        return signInWithGoogle();
      },
      logout: async () => {
        if (env.demoMode || !supabase) {
          setActiveUserId(null);
          return;
        }

        await signOutActiveSession();
        setLiveUser(null);
      }
    }),
    [activeUser, isAuthLoading, liveUsers, localUsers, pendingAccessEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
