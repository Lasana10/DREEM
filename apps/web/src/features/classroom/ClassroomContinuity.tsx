import type { ClassroomItem, UserProfile } from "../../shared/types";

interface ClassroomContinuityProps {
  items: ClassroomItem[];
  activeUser: UserProfile;
}

export function ClassroomContinuity({
  items,
  activeUser
}: ClassroomContinuityProps) {
  const filteredItems = items.filter((item) => {
    if (activeUser.role === "leadership" || activeUser.role === "support") {
      return true;
    }

    if (activeUser.role === "teacher") {
      return item.audience === "teacher" || item.audience === "student";
    }

    if (activeUser.role === "student") {
      return item.audience === "student";
    }

    if (activeUser.role === "parent") {
      return item.audience === "parent" || item.audience === "student";
    }

    return false;
  });
  const roleLabel =
    activeUser.role === "parent"
      ? "Family continuity"
      : activeUser.role === "student"
        ? "Learner continuity"
        : activeUser.role === "teacher"
          ? "Teaching continuity"
          : "Continuity layer";
  const roleCopy =
    activeUser.role === "parent"
      ? "Parents should be able to see notes, assignments, and follow-up material that helps them support learning at home."
      : activeUser.role === "student"
        ? "Learners should be able to recover classroom flow quickly when they miss class or need revision."
        : activeUser.role === "teacher"
          ? "Teachers should be able to publish and review continuity material without leaving their working rhythm."
          : "This continuity layer carries notes, assignments, and follow-up materials across the school.";

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">{roleLabel}</span>
          <h2>Notes, assignments, and follow-up</h2>
        </div>
      </div>

      <p className="section-copy">{roleCopy}</p>

      <div className="continuity-grid">
        {filteredItems.map((item) => (
          <article key={item.id} className="card continuity-card">
            <span className="mini-tag">{item.delivery}</span>
            <h3>{item.title}</h3>
            <strong>{item.subject}</strong>
            {item.className || item.dueDate ? (
              <small className="storage-meta">
                {item.className ? `Class: ${item.className}` : ""}
                {item.className && item.dueDate ? " · " : ""}
                {item.dueDate ? `Due: ${item.dueDate}` : ""}
              </small>
            ) : null}
            <p>{item.summary}</p>
            <small className="storage-meta">
              {item.publishedBy ? `Published by ${item.publishedBy} · ` : ""}
              Storage: {item.storageProvider ?? "supabase"}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
