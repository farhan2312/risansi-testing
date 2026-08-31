"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./AdminActionRegistryPage.css";
import { listActionRegistry } from "@/services/adminService";
import { formatDate, formatNumber } from "@/lib/formUtils";
import type { ActionRegistryEntry } from "@/types/testing";

interface UnmetField {
  label: string;
  unit: string;
  rated: number | null;
  measured: number | null;
}

/** Only the fields that were actually flagged "not met" on this entry --
 * unmet_fields is the comma-joined label list the assign-retest route wrote
 * (e.g. "Head, Power"), so an entry with just one bad parameter doesn't drag
 * two empty rated/measured columns along with it. */
const unmetFieldsOf = (e: ActionRegistryEntry): UnmetField[] => {
  const unmet = e.unmet_fields.split(",").map((s) => s.trim());
  return [
    unmet.includes("Head") && { label: "Head", unit: "KG/CM2", rated: e.rated_head, measured: e.measured_head },
    unmet.includes("Capacity") && {
      label: "Capacity",
      unit: "M3/Hr",
      rated: e.rated_capacity,
      measured: e.measured_capacity,
    },
    unmet.includes("Power") && {
      label: "Power",
      unit: "KW",
      rated: e.rated_power_kw,
      measured: e.measured_power_kw,
    },
  ].filter((f): f is UnmetField => Boolean(f));
};

const AdminActionRegistryPage = () => {
  const [entries, setEntries] = useState<ActionRegistryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listActionRegistry()
      .then(setEntries)
      .catch(() => setError("Could not load the Action Registry."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="registry-page">
      <div className="registry-header sticky-page-header">
        <h1>Action Registry</h1>
        <p>
          Every time a report missed a rated requirement and a retest was assigned, the unmet parameters, the
          action points raised against them, and who raised/assigned them are logged here.
        </p>
      </div>

      {isLoading && <p className="registry-status">Loading...</p>}
      {error && <p className="registry-status registry-status-error">{error}</p>}

      {!isLoading && !error && entries.length === 0 && (
        <p className="registry-empty">Nothing here yet.</p>
      )}

      {!isLoading && !error && entries.length > 0 && (
        <div className="registry-table-card">
          <div className="registry-table-scroll">
            <table className="registry-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Parameters not met</th>
                  <th>Action points</th>
                  <th>Assigned by</th>
                  <th>Originally raised by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="registry-model">{e.model}</div>
                      {e.report_no && <div className="registry-report-no">{e.report_no}</div>}
                    </td>
                    <td>
                      <div className="registry-unmet-list">
                        {unmetFieldsOf(e).map((f) => (
                          <div className="registry-unmet-field" key={f.label}>
                            <span className="registry-unmet-badge">{f.label}</span>
                            <span className="registry-unmet-values">
                              {formatNumber(f.rated)} <span className="registry-unmet-arrow">&rarr;</span>{" "}
                              <strong>{formatNumber(f.measured)}</strong> {f.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      {e.action_points.length > 0 ? (
                        <ul className="registry-action-points">
                          {e.action_points.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="registry-dash">-</span>
                      )}
                    </td>
                    <td>
                      <div className="registry-person">{e.assigned_by_name ?? "-"}</div>
                      <div className="registry-date">{formatDate(e.created_at)}</div>
                    </td>
                    <td>
                      <div className="registry-person">{e.originally_raised_by ?? "-"}</div>
                    </td>
                    <td>
                      <Link href={`/requisitions/${e.requisition_id}`} className="registry-link-btn">
                        View requisition
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminActionRegistryPage;
