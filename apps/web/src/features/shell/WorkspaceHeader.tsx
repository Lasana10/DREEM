import { roleLabels } from "../../shared/data";
import type { SchoolConfig, UserProfile } from "../../shared/types";

interface WorkspaceHeaderProps {
  activeUser: UserProfile;
  demoMode: boolean;
  config: SchoolConfig;
}

export function WorkspaceHeader({
  activeUser,
  demoMode,
  config
}: WorkspaceHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">DREEM EduOS</span>
        <h1>{config.schoolName}</h1>
        <small>
          {config.campusName ?? "Main Campus"} · {config.academicYear ?? "Academic year"} · {config.activeTerm ?? "Active term"}
        </small>
      </div>
      <div className="topbar-status">
        <span>{roleLabels[activeUser.role]}</span>
        <strong>{activeUser.name}</strong>
        <small>{activeUser.department} · {activeUser.matricule}</small>
      </div>
      <div className={demoMode ? "status-pill warm" : "status-pill good"}>
        {demoMode ? "Demo data" : "Live Supabase"}
      </div>
    </header>
  );
}
