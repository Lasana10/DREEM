import { roleProfiles } from "../../shared/data";
import type { UserProfile } from "../../shared/types";

interface SessionPanelProps {
  demoMode: boolean;
  users: UserProfile[];
  activeUser: UserProfile;
  onSelectUser: (userId: string) => void;
}

export function SessionPanel({
  demoMode,
  users,
  activeUser,
  onSelectUser
}: SessionPanelProps) {
  const canSwitchSession = demoMode && users.length > 1;
  const activeProfile = roleProfiles[activeUser.role];

  return (
    <section className="panel session-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Signed in as</span>
          <h2>{activeUser.name}</h2>
        </div>
      </div>

      <p className="section-copy">
        {activeProfile.mandate} In live mode this panel reflects the real
        Supabase-linked school identity currently driving access across the platform.
      </p>

      <div className="role-identity-strip">
        <article className="role-identity-card">
          <span>Workspace</span>
          <strong>{activeProfile.title}</strong>
          <small>{activeProfile.workstyle}</small>
        </article>
        <article className="role-identity-card">
          <span>Focus</span>
          <strong>{activeProfile.focus}</strong>
          <small>{activeProfile.authority}</small>
        </article>
        <article className="role-identity-card">
          <span>Primary actions</span>
          <strong>{activeProfile.primaryActions.join(" · ")}</strong>
          <small>{activeUser.department}</small>
        </article>
      </div>

      {canSwitchSession ? (
        <div className="user-list">
          {users.map((user) => (
            <button
              key={user.id}
              className={user.id === activeUser.id ? "user-chip active" : "user-chip"}
              onClick={() => onSelectUser(user.id)}
            >
              <strong>{user.name}</strong>
              <span>
                {user.matricule} · {roleProfiles[user.role].title} · {user.department}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="user-list">
          <article className="user-chip static active">
            <strong>{activeUser.name}</strong>
            <span>
              {activeUser.matricule} · {activeProfile.title} · {activeUser.department}
            </span>
          </article>
        </div>
      )}
    </section>
  );
}
