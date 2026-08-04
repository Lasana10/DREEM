import { useState } from "react";
import type { AuthDraft, UserProfile } from "../../shared/types";

interface LoginScreenProps {
  demoMode: boolean;
  users: UserProfile[];
  pendingAccessEmail: string;
  onDemoLogin: (
    identifier: string,
    password?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onGoogleLogin: () => Promise<{ ok: boolean; error?: string }>;
}

const initialDraft: AuthDraft = {
  identifier: "",
  password: "",
  mode: "password"
};

const entryHighlights = [
  "Leadership command center",
  "Assignments and learning continuity",
  "Bursar fee and receipt flow",
  "Transport and bus alerts",
  "Campus announcements and recognition",
  "Parent and student support materials"
];

const entryPanels = [
  {
    title: "School operations",
    text: "Admin, academics, bursar, support, and school-wide coordination in one place."
  },
  {
    title: "Learning continuity",
    text: "Notes, assignments, and follow-up materials stay reachable when students are away from campus."
  },
  {
    title: "Communication",
    text: "Announcements, campus news, recognition, and official updates stay visible across roles."
  },
  {
    title: "Transport",
    text: "Routes, delays, parent alerts, and pickup visibility are part of the platform, not a side tool."
  }
];

export function LoginScreen({
  demoMode,
  users,
  pendingAccessEmail,
  onDemoLogin,
  onGoogleLogin
}: LoginScreenProps) {
  const [draft, setDraft] = useState<AuthDraft>(initialDraft);
  const [error, setError] = useState("");

  function updateField<K extends keyof AuthDraft>(key: K, value: AuthDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function fillDemoUser(user: UserProfile) {
    setDraft((current) => ({
      ...current,
      identifier: user.matricule,
      password: ""
    }));
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.identifier.trim()) {
      setError("Enter your school-issued matricule, email, or phone to continue.");
      return;
    }

    const result = await onDemoLogin(
      draft.identifier.trim(),
      draft.mode === "password" ? draft.password : ""
    );
    if (!result.ok) {
      setError(result.error ?? "Sign-in failed.");
      return;
    }

    setError("");
  }

  async function handleGoogleLogin() {
    setError("");
    const result = await onGoogleLogin();

    if (!result.ok) {
      setError(result.error ?? "Google sign-in failed.");
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">Controlled access</span>
            <h1>DREEM Sign In</h1>
          </div>
        </div>

        <p className="section-copy">
          DREEM access is controlled by the school. Google can identify the person,
          but DREEM only opens a workspace after that person has an approved school
          membership.
        </p>

        <button className="secondary-button" type="button" onClick={handleGoogleLogin}>
          Continue with Google
        </button>

        <form className="composer" onSubmit={handleSubmit}>
          <label>
            <span>Access method</span>
            <select
              value={draft.mode}
              onChange={(event) =>
                updateField("mode", event.target.value as AuthDraft["mode"])
              }
            >
              <option value="password">Password / demo matricule</option>
              <option value="otp">Email sign-in link</option>
            </select>
          </label>

          <label>
            <span>Matricule / email / phone</span>
            <input
              value={draft.identifier}
              onChange={(event) => updateField("identifier", event.target.value)}
              placeholder="DRM-TCH-014 or teacher@school.cm or +237..."
            />
          </label>

          {draft.mode === "password" ? (
            <label>
              <span>Password</span>
              <input
                type="password"
                value={draft.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="School-managed password"
              />
            </label>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" type="submit">
            {draft.mode === "otp" ? "Send secure sign-in link" : "Continue to workspace"}
          </button>
        </form>

        {demoMode ? (
          <div className="quick-entry">
            <span className="eyebrow">Quick demo access</span>
            <div className="quick-entry-grid">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="quick-entry-chip"
                  onClick={() => fillDemoUser(user)}
                >
                  <strong>{user.name}</strong>
                  <span>{user.matricule}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="auth-note">
            <strong>
              {pendingAccessEmail ? "Waiting for DREEM school approval." : "Live school access is active."}
            </strong>
            {pendingAccessEmail ? (
              <p>
                {pendingAccessEmail} is authenticated in Supabase, but no approved
                DREEM school membership exists yet. Leadership or support must add
                this account through controlled access before the workspace opens.
              </p>
            ) : (
              <p>
                Sign in with Google, school email/password, or email link. If your
                Google account is new to DREEM, it will remain pending until school
                leadership or support approves the membership.
              </p>
            )}
          </div>
        )}

        <div className="auth-note">
          <strong>{demoMode ? "Demo mode is active." : "Live mode is expected."}</strong>
          <p>
            The final production flow should let admins create or import users, issue
            matricules, reset access, and control who belongs to each school. For
            launch, email auth is the most reliable Supabase-first path; phone auth
            should wait until the SMS provider is configured.
          </p>
        </div>
      </section>

      <section className="panel auth-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Platform at entry</span>
            <h2>DREEM should already feel broad here</h2>
          </div>
        </div>

        <div className="auth-highlight-list">
          {entryHighlights.map((item) => (
            <article key={item} className="auth-highlight">
              <span>{item}</span>
            </article>
          ))}
        </div>

        <div className="auth-domain-grid">
          {entryPanels.map((panel) => (
            <article key={panel.title} className="auth-domain-card">
              <h3>{panel.title}</h3>
              <p>{panel.text}</p>
            </article>
          ))}
        </div>

        {demoMode ? (
          <div className="user-list compact">
            {users.map((user) => (
              <article key={user.id} className="user-chip static">
                <strong>{user.name}</strong>
                <span>
                  {user.matricule} · {user.role}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-domain-card">
            <h3>Production access path</h3>
            <p>
              School accounts are provisioned by leadership, linked to one school,
              and then granted role-based access across academics, finance,
              transport, communications, and reporting.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
