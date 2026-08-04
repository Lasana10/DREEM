import { useState } from "react";
import { hasUserPermission } from "../../lib/permissions";
import type { Announcement, RoleId, UserProfile } from "../../shared/types";
import { roleLabels } from "../../shared/data";

interface AnnouncementComposerProps {
  activeUser: UserProfile;
  onCreate: (announcement: Announcement) => Promise<void>;
}

const audienceOptions: Array<RoleId | "everyone"> = [
  "everyone",
  "leadership",
  "teacher",
  "student",
  "parent",
  "bursar",
  "transport",
  "support"
];

export function AnnouncementComposer({
  activeUser,
  onCreate
}: AnnouncementComposerProps) {
  const canPublish = hasUserPermission(activeUser, "communications.publish");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<RoleId | "everyone">("everyone");
  const [category, setCategory] =
    useState<Announcement["category"]>("announcement");
  const [priority, setPriority] =
    useState<Announcement["priority"]>("important");
  const [requiresAck, setRequiresAck] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPublish) {
      setError("This role cannot publish school-wide announcements.");
      return;
    }
    if (!title.trim() || !body.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onCreate({
        id: crypto.randomUUID(),
        title: title.trim(),
        body: body.trim(),
        audience,
        category,
        author: activeUser.name,
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }),
        schoolId: activeUser.schoolId,
        status: "published",
        priority,
        requiresAck,
        channels: requiresAck ? ["app", "email"] : ["app"],
        targetCount: audience === "everyone" ? 1248 : 120
      });

      setTitle("");
      setBody("");
      setAudience("everyone");
      setCategory("announcement");
      setPriority("important");
      setRequiresAck(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to publish announcement."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">User-created content</span>
          <h2>Announcement composer</h2>
        </div>
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Write a school update"
          />
        </label>

        <label>
          <span>Message</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Announcements, campus news, recognition, or transport notices start here."
            rows={5}
          />
        </label>

        <div className="composer-grid">
          <label>
            <span>Audience</span>
            <select
              value={audience}
              onChange={(event) =>
                setAudience(event.target.value as RoleId | "everyone")
              }
            >
              {audienceOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "everyone" ? "Everyone" : roleLabels[item]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Category</span>
            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as Announcement["category"])
              }
            >
              <option value="announcement">Announcement</option>
              <option value="campus-news">Campus news</option>
              <option value="recognition">Recognition</option>
              <option value="transport">Transport</option>
            </select>
          </label>
        </div>

        <div className="composer-grid">
          <label>
            <span>Priority</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as Announcement["priority"])
              }
            >
              <option value="routine">Routine</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label className="toggle-row">
            <span>Require acknowledgement</span>
            <input
              type="checkbox"
              checked={requiresAck}
              onChange={(event) => setRequiresAck(event.target.checked)}
            />
          </label>
        </div>

        <button className="primary-button" type="submit" disabled={!canPublish}>
          {isSubmitting ? "Publishing..." : `Publish as ${activeUser.name}`}
        </button>

        {!canPublish ? (
          <p className="form-error">
            This role can view communication but cannot publish school-wide announcements.
          </p>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </section>
  );
}
