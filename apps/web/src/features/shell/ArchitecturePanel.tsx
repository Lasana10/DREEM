const roleSummaries = [
  "Leadership sees institution-wide risk, finance, transport, and academic signals.",
  "Teachers manage notes, assignments, interventions, and classroom continuity.",
  "Students and parents receive materials, reminders, notices, and progress support.",
  "Operations teams run communication, finance, support, and school coordination."
];

export function ArchitecturePanel() {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Agreed architecture</span>
          <h2>What DREEM is now modeling</h2>
        </div>
      </div>
      <div className="summary-list">
        {roleSummaries.map((item) => (
          <article key={item} className="card summary-card">
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

