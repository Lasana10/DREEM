import { roleProfiles, roleWorkspaceAccess, roleLabels } from "../../shared/data";
import type { RoleId, WorkspaceView } from "../../shared/types";

const navItems: Array<{ id: WorkspaceView; label: string; detail: string }> = [
  { id: "overview", label: "Command", detail: "Daily queue and signals" },
  { id: "academics", label: "Academics", detail: "Attendance, notes, assignments" },
  { id: "finance", label: "Bursar", detail: "Fees, receipts, reminders" },
  { id: "transport", label: "Transport", detail: "Routes, delays, pickup state" },
  { id: "communications", label: "Comms", detail: "Notices, news, recognition" },
  { id: "operations", label: "Admin", detail: "Users, setup, storage, sync" },
  { id: "reporting", label: "Reports", detail: "Government and school health" }
];

interface WorkspaceNavProps {
  activeView: WorkspaceView;
  activeRole: RoleId;
  enabledModules?: string[];
  onChange: (view: WorkspaceView) => void;
}

export function WorkspaceNav({ activeView, activeRole, enabledModules, onChange }: WorkspaceNavProps) {
  const alwaysEnabled: WorkspaceView[] = ["overview", "operations"];
  const activeProfile = roleProfiles[activeRole];
  const visibleItems = navItems.filter((item) =>
    roleWorkspaceAccess[activeRole].includes(item.id) &&
    (alwaysEnabled.includes(item.id) || !enabledModules || enabledModules.includes(item.id))
  );

  return (
    <aside className="workspace-nav panel">
      <div className="section-head nav-head">
        <div>
          <span className="eyebrow">Role access</span>
          <h2>{roleLabels[activeRole]}</h2>
          <p className="nav-support-copy">{activeProfile.workstyle}</p>
        </div>
      </div>

      <div className="nav-role-summary">
        <span>{activeProfile.authority}</span>
        <small>{activeProfile.focus}</small>
      </div>

      <div className="nav-list">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            className={activeView === item.id ? "nav-item active-nav" : "nav-item"}
            onClick={() => onChange(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
