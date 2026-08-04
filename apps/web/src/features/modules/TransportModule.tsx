import { hasUserPermission } from "../../lib/permissions";
import type { TransportRoute } from "../../shared/types";
import type { UserProfile } from "../../shared/types";

interface TransportModuleProps {
  activeUser: UserProfile;
  routes: TransportRoute[];
  onUpdateRouteStatus: (
    routeId: string,
    status: "on-time" | "delayed" | "maintenance"
  ) => void;
}

export function TransportModule({
  activeUser,
  routes,
  onUpdateRouteStatus
}: TransportModuleProps) {
  const delayedCount = routes.filter((route) => route.status === "delayed").length;
  const maintenanceCount = routes.filter(
    (route) => route.status === "maintenance"
  ).length;
  const canUpdateTransport = hasUserPermission(activeUser, "transport.status.write");

  return (
    <section className="module-surface">
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">Transport command</span>
            <h2>Routes and fleet status</h2>
          </div>
        </div>

        <div className="announcement-stats">
          <article className="signal-card good">
            <span>On time</span>
            <strong>{routes.length - delayedCount - maintenanceCount}</strong>
          </article>
          <article className="signal-card warm">
            <span>Delayed</span>
            <strong>{delayedCount}</strong>
          </article>
          <article className="signal-card alert">
            <span>Maintenance</span>
            <strong>{maintenanceCount}</strong>
          </article>
        </div>

        <div className="table-list">
          {routes.map((route) => (
            <article key={route.id} className="record-row">
              <div>
                <strong>{route.routeName}</strong>
                <p>
                  {route.driver} · {route.vehicle} · {route.studentsAssigned} students · Next stop {route.nextStop}
                </p>
              </div>
              <div className="action-row">
                <span className="module-chip">{route.status}</span>
                <button
                  className="module-chip"
                  disabled={!canUpdateTransport}
                  onClick={() => onUpdateRouteStatus(route.id, "on-time")}
                >
                  On time
                </button>
                <button
                  className="module-chip"
                  disabled={!canUpdateTransport}
                  onClick={() => onUpdateRouteStatus(route.id, "delayed")}
                >
                  Delayed
                </button>
                <button
                  className="module-chip"
                  disabled={!canUpdateTransport}
                  onClick={() => onUpdateRouteStatus(route.id, "maintenance")}
                >
                  Maintenance
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
