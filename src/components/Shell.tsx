import {
  BarChart3,
  BookOpenCheck,
  Building2,
  BusFront,
  CircleUserRound,
  ClipboardCheck,
  FolderHeart,
  GraduationCap,
  Menu,
  MessageSquareMore,
  ReceiptText,
  Settings2,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Role, SchoolBrand } from "../domain/types";

export type ViewKey =
  | "command"
  | "admissions"
  | "operations"
  | "academics"
  | "learning"
  | "learners"
  | "teachers"
  | "care"
  | "transport"
  | "finance"
  | "signals"
  | "studio";
const nav = [
  { id: "command" as const, label: "Command centre", icon: BarChart3 },
  { id: "admissions" as const, label: "Admissions", icon: UserPlus },
  {
    id: "operations" as const,
    label: "Daily operations",
    icon: ClipboardCheck,
  },
  { id: "academics" as const, label: "Academic delivery", icon: BookOpenCheck },
  { id: "learning" as const, label: "Assignments", icon: ClipboardCheck },
  { id: "learners" as const, label: "Learner OneFiles", icon: GraduationCap },
  { id: "teachers" as const, label: "Teacher studio", icon: BookOpenCheck },
  { id: "care" as const, label: "Care & safeguarding", icon: FolderHeart },
  { id: "transport" as const, label: "School transport", icon: BusFront },
  { id: "finance" as const, label: "TrustLedger", icon: ReceiptText },
  { id: "signals" as const, label: "Voice & signals", icon: MessageSquareMore },
  { id: "studio" as const, label: "School studio", icon: Settings2 },
];

const roleViews: Record<Role, ViewKey[]> = {
  platform_founder: [
    "command",
    "admissions",
    "operations",
    "academics",
    "learning",
    "learners",
    "teachers",
    "care",
    "transport",
    "finance",
    "signals",
    "studio",
  ],
  school_owner: [
    "command",
    "admissions",
    "operations",
    "academics",
    "learning",
    "learners",
    "teachers",
    "care",
    "transport",
    "finance",
    "signals",
    "studio",
  ],
  principal: [
    "command",
    "admissions",
    "operations",
    "academics",
    "learning",
    "learners",
    "teachers",
    "care",
    "transport",
    "finance",
    "signals",
    "studio",
  ],
  administrator: [
    "command",
    "admissions",
    "operations",
    "academics",
    "learning",
    "learners",
    "teachers",
    "care",
    "transport",
    "finance",
    "signals",
    "studio",
  ],
  academic_head: [
    "command",
    "admissions",
    "operations",
    "academics",
    "learning",
    "learners",
    "teachers",
    "care",
    "signals",
    "studio",
  ],
  bursar: ["command", "learners", "finance"],
  accountant: ["command", "finance"],
  teacher: ["operations", "learning", "learners", "care", "signals"],
  tutor: ["learning", "learners", "care", "signals"],
  transport_manager: ["command", "transport", "signals"],
  driver: ["transport", "signals"],
  security_guard: ["transport", "signals"],
  parent: ["learning", "learners", "transport", "signals"],
  student: ["learning", "learners", "transport", "signals"],
  auditor: ["command", "learners", "finance", "signals"],
};

function roleLabel(role: Role) {
  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Shell({
  brand,
  viewer,
  view,
  onView,
  signalCount,
  onFeedback,
  children,
}: {
  brand: SchoolBrand;
  viewer: { name: string; email: string; role: Role };
  view: ViewKey;
  onView: (view: ViewKey) => void;
  signalCount: number;
  onFeedback: () => void;
  children: ReactNode;
}) {
  const visibleNav = nav.filter((item) =>
    roleViews[viewer.role].includes(item.id),
  );
  const canOpenStudio = roleViews[viewer.role].includes("studio");
  const [online, setOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const connect = () => setOnline(true);
    const disconnect = () => setOnline(false);
    window.addEventListener("online", connect);
    window.addEventListener("offline", disconnect);
    return () => {
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", disconnect);
    };
  }, []);
  return (
    <main
      className="shell"
      style={
        {
          "--brand": brand.primaryColor,
          "--accent": brand.accentColor,
        } as React.CSSProperties
      }
    >
      <aside className="sidebar">
        <div className="brand">
          <span>D</span>
          <div>
            <strong>DREEM</strong>
            <small>Proof to Progress</small>
          </div>
        </div>
        <div className="school">
          <span>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" />
            ) : (
              brand.shortName
            )}
          </span>
          <div>
            <strong>{brand.name}</strong>
            <small>
              <Building2 size={11} />
              {brand.city} · {brand.subsystem}
            </small>
          </div>
        </div>
        <nav>
          <small>OPERATIONS</small>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => onView(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "signals" && signalCount > 0 ? (
                <b>{signalCount}</b>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure">
            <ShieldCheck size={17} />
            <span>
              <strong>Protected workspace</strong>
              <small>Audit trail active</small>
            </span>
          </div>
          <div className="account">
            <CircleUserRound />
            <span>
              <strong>{viewer.name}</strong>
              <small>{roleLabel(viewer.role)}</small>
            </span>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header>
          <div>
            <span>DREEM SCHOOL OPERATING SYSTEM</span>
            <h1>{nav.find((item) => item.id === view)?.label}</h1>
          </div>
          <div>
            <span className={`connectivity ${online ? "online" : "offline"}`}>
              {online ? "Online" : "Offline · writes paused"}
            </span>
            <button className="language">EN / FR</button>
            {canOpenStudio && view !== "studio" ? (
              <button className="feedback" onClick={() => onView("studio")}>
                <Settings2 size={15} />
                School Studio
              </button>
            ) : null}
            <button className="feedback" onClick={onFeedback}>
              <MessageSquareMore size={15} />
              Give feedback
            </button>
          </div>
        </header>
        {children}
      </section>
      {mobileMenuOpen ? (
        <div
          className="mobile-more-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        >
          <section
            className="mobile-more-menu"
            aria-label="All DREEM workspaces"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <strong>All workspaces</strong>
              <button
                aria-label="Close workspace menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X />
              </button>
            </header>
            {visibleNav.map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => {
                  onView(item.id);
                  setMobileMenuOpen(false);
                }}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
              </button>
            ))}
          </section>
        </div>
      ) : null}
      <nav className="mobile-nav">
        {visibleNav.slice(0, 4).map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "active" : ""}
            onClick={() => onView(item.id)}
          >
            <item.icon size={19} />
            <span>{item.label.split(" ")[0]}</span>
          </button>
        ))}
        <button
          className={
            visibleNav.slice(4).some((item) => item.id === view) ? "active" : ""
          }
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={19} />
          <span>More</span>
        </button>
      </nav>
    </main>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <UsersRound />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
