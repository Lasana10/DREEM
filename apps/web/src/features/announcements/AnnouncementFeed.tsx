import { useMemo, useState } from "react";
import type { Announcement, UserProfile } from "../../shared/types";

interface AnnouncementFeedProps {
  announcements: Announcement[];
  activeUser: UserProfile;
}

export function AnnouncementFeed({
  announcements,
  activeUser
}: AnnouncementFeedProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    Announcement["category"] | "all"
  >("all");

  const visibleAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const audienceMatch =
        item.audience === "everyone" || item.audience === activeUser.role;
      const categoryMatch =
        selectedCategory === "all" || item.category === selectedCategory;
      return audienceMatch && categoryMatch;
    });
  }, [activeUser.role, announcements, selectedCategory]);

  const publishedCount = announcements.filter(
    (item) => item.status === "published"
  ).length;
  const acknowledgementCount = announcements.filter(
    (item) => item.requiresAck
  ).length;
  const urgentCount = announcements.filter(
    (item) => item.priority === "urgent"
  ).length;
  const roleLabel =
    activeUser.role === "parent"
      ? "Family communications"
      : activeUser.role === "student"
        ? "Student notices"
        : activeUser.role === "teacher"
          ? "Staff communications"
          : "Live feed";
  const roleCopy =
    activeUser.role === "parent"
      ? "This feed should help families quickly see notices, recognition, transport alerts, and actions that need acknowledgement."
      : activeUser.role === "student"
        ? "This feed should keep learners focused on what matters next across school life and classroom expectations."
        : activeUser.role === "teacher"
          ? "This feed should keep staff aligned on operational notices, academic timing, and urgent school communication."
          : "This communication center carries notices, recognition, transport alerts, and school-wide updates.";

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{roleLabel}</span>
          <h2>Announcements command center</h2>
        </div>
      </div>

      <p className="section-copy">{roleCopy}</p>

      <div className="announcement-stats">
        <article className="signal-card good">
          <span>Published today</span>
          <strong>{publishedCount}</strong>
        </article>
        <article className="signal-card warm">
          <span>Need acknowledgement</span>
          <strong>{acknowledgementCount}</strong>
        </article>
        <article className="signal-card alert">
          <span>Urgent notices</span>
          <strong>{urgentCount}</strong>
        </article>
      </div>

      <div className="filter-row">
        <button
          className={selectedCategory === "all" ? "module-chip active-chip" : "module-chip"}
          onClick={() => setSelectedCategory("all")}
        >
          All
        </button>
        <button
          className={
            selectedCategory === "announcement" ? "module-chip active-chip" : "module-chip"
          }
          onClick={() => setSelectedCategory("announcement")}
        >
          School notices
        </button>
        <button
          className={
            selectedCategory === "campus-news" ? "module-chip active-chip" : "module-chip"
          }
          onClick={() => setSelectedCategory("campus-news")}
        >
          Campus news
        </button>
        <button
          className={
            selectedCategory === "recognition" ? "module-chip active-chip" : "module-chip"
          }
          onClick={() => setSelectedCategory("recognition")}
        >
          Recognition
        </button>
        <button
          className={
            selectedCategory === "transport" ? "module-chip active-chip" : "module-chip"
          }
          onClick={() => setSelectedCategory("transport")}
        >
          Transport
        </button>
      </div>

      <div className="feed-list">
        {visibleAnnouncements.map((item) => (
          <article key={item.id} className="feed-card">
            <div className="feed-meta">
              <span className="feed-tag">{item.category}</span>
              <span>{item.createdAt}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            <div className="module-chip-row">
              <span className="module-chip">{item.priority ?? "routine"}</span>
              <span className="module-chip">{item.status ?? "published"}</span>
              <span className="module-chip">
                {item.audience === "everyone" ? "everyone" : item.audience}
              </span>
              {item.requiresAck ? (
                <span className="module-chip">ack required</span>
              ) : null}
              {item.channels?.map((channel) => (
                <span key={channel} className="module-chip">
                  {channel}
                </span>
              ))}
            </div>
            <small>
              By {item.author}
              {item.targetCount ? ` · Target reach: ${item.targetCount}` : ""}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
