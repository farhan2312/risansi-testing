"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import "./RequisitionDetailPage.css";
import { headToKgcm2 } from "@/lib/unitConversion";
import { targetDateFor } from "@/lib/formUtils";
import { computeRequirementStatus, unmetRequirementLabels } from "@/lib/requirementCheck";
import { dedupCheck, getRequisition, updateRequisition } from "@/services/testingService";
import { getCurrentUser } from "@/services/session";
import { ecQuotationLabel } from "@/types/testing";
import type { DedupCheckResult, PumpTestReport, TestRequisition } from "@/types/testing";

/** Short "did this report meet its rated targets" label for a list row --
 * empty string when there's nothing to flag (still valid either way, this
 * is informational only). */
const reportUnmetTitle = (r: PumpTestReport): string => {
  const labels = unmetRequirementLabels(computeRequirementStatus(r, r.points));
  return labels.length ? `Did not meet rated ${labels.join(", ")}` : "";
};

const RequisitionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = getCurrentUser();
  const canProcessTesting = currentUser?.role !== "source";

  const [requisition, setRequisition] = useState<TestRequisition | null>(null);
  const [dedup, setDedup] = useState<DedupCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    setError("");
    try {
      const req = await getRequisition(id);
      setRequisition(req);
      const dedupResult = await dedupCheck(req.model);
      dedupResult.priorReports = dedupResult.priorReports.filter((r) => r.requisition_id !== id);
      setDedup(dedupResult);
    } catch {
      setError("Could not load testing summary.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const markRetest = async (retestNeeded: boolean) => {
    if (!id) return;
    setIsSaving(true);
    try {
      const updated = await updateRequisition(id, {
        retest_needed: retestNeeded,
        status: retestNeeded ? "Retest Needed" : "In Testing",
      });
      setRequisition(updated);
    } catch {
      setError("Could not update testing summary.");
    } finally {
      setIsSaving(false);
    }
  };

  const startTesting = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const updated = await updateRequisition(id, { status: "In Testing" });
      setRequisition(updated);
    } catch {
      setError("Could not update testing summary.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <p className="detail-empty">Loading...</p>;
  if (error) return <div className="form-error-banner">{error}</div>;
  if (!requisition) return <p className="detail-empty">Testing summary not found.</p>;

  const hasPriorReports = (dedup?.priorReports.length ?? 0) > 0;
  const submittedReport = requisition.reports?.[0];
  const hasObservation =
    requisition.reports?.some((r) => (r.report_format ?? "observation") === "observation") ?? false;
  const hasViscosityChart = requisition.reports?.some((r) => r.report_format === "viscosity-chart") ?? false;
  const canEditRequisition = currentUser?.role === "source" && requisition.created_by === currentUser.id;
  const headConvertedKgcm2 = headToKgcm2(requisition.head_kgcm2, requisition.head_unit, requisition.specific_gravity);

  return (
    <div className="requisition-detail-page">
      <div className="detail-header sticky-page-header">
        <div>
          <h1>{requisition.model}</h1>
          {requisition.status === "Closed" && submittedReport ? (
            <Link href={`/reports/${submittedReport.id}`} className="status-pill status-view-report">
              View Report
            </Link>
          ) : (
            <span className={`status-pill status-${requisition.status.replace(/\s+/g, "-").toLowerCase()}`}>
              {requisition.status}
            </span>
          )}
        </div>
        <div className="detail-header-actions">
          {canEditRequisition && (
            <Link href={`/requisitions/${requisition.id}/edit`} className="edit-report-btn">
              Edit
            </Link>
          )}
          <Link href="/dashboard" className="back-link">
            &larr; Back to testing summaries
          </Link>
        </div>
      </div>

      <section className="detail-card">
        <h2>Testing Summary Details</h2>
        <div className="detail-grid">
          <div>
            <span className="label">Category</span>
            <span>{requisition.category ?? "-"}</span>
          </div>
          <div>
            <span className="label">{ecQuotationLabel(requisition.category)}</span>
            <span>{requisition.ec_quotation_no ?? "-"}</span>
          </div>
          <div>
            <span className="label">Offer Date</span>
            <span>{requisition.offer_date ?? "-"}</span>
          </div>
          <div>
            <span className="label">Responsible Person</span>
            <span>{requisition.responsible_person ?? "-"}</span>
          </div>
          <div>
            <span className="label">Source Team</span>
            <span>{requisition.source_team ?? "-"}</span>
          </div>
          <div>
            <span className="label">Date of Receipt</span>
            <span>{requisition.date_of_receipt ?? "-"}</span>
          </div>
          <div>
            <span className="label">Target Date</span>
            <span>
              {(() => {
                const target = targetDateFor(requisition);
                if (!target) return "-";
                return (
                  <>
                    {target.date}
                    {target.isAuto && <span className="target-date-auto-hint"> (auto)</span>}
                  </>
                );
              })()}
            </span>
          </div>
          <div>
            <span className="label">Test Qty</span>
            <span>{requisition.test_qty ?? "-"}</span>
          </div>
          <div>
            <span className="label">Specific Gravity</span>
            <span>{requisition.specific_gravity ?? "-"}</span>
          </div>
          <div>
            <span className="label">Power (HP / KW)</span>
            <span>
              {requisition.power_hp ?? "-"} / {requisition.power_kw ?? "-"}
            </span>
          </div>
          <div>
            <span className="label">Head</span>
            <span>
              {requisition.head_kgcm2 ?? "-"} {requisition.head_unit ?? ""}
              {headConvertedKgcm2 !== null && ` (= ${headConvertedKgcm2} KG/CM2)`}
            </span>
          </div>
          <div>
            <span className="label">RPM</span>
            <span>{requisition.rpm ?? "-"}</span>
          </div>
          <div>
            <span className="label">Motor RPM</span>
            <span>{requisition.motor_rpm ?? "-"}</span>
          </div>
          <div>
            <span className="label">Submitted By</span>
            <span>{requisition.submitted_by ?? "-"}</span>
          </div>
          {requisition.category === "Against R&D Trials" && (
            <>
              <div>
                <span className="label">Media Type</span>
                <span>{requisition.media_type ?? "-"}</span>
              </div>
              <div>
                <span className="label">Open Remarks</span>
                <span>{requisition.general_remarks ?? "-"}</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="detail-card">
        <h2>Prior Test Reports for &quot;{requisition.model}&quot;</h2>
        {!hasPriorReports ? (
          <p className="dedup-note">No prior test report found for this model. Proceed with testing.</p>
        ) : (
          <>
            <p className="dedup-note">
              This model has been tested before. Confirm with the source team
              (verbally) whether a retest is actually needed, then record the
              decision below.
            </p>
            <table className="prior-reports-table">
              <thead>
                <tr>
                  <th>Report Date</th>
                  <th>Gearbox No.</th>
                  <th>Motor</th>
                  <th>Rated Head</th>
                  <th>Rated RPM</th>
                  <th>Test Points</th>
                </tr>
              </thead>
              <tbody>
                {dedup!.priorReports.map((r) => {
                  const unmetTitle = reportUnmetTitle(r);
                  return (
                    <tr key={r.id} className={unmetTitle ? "requirement-row-not-met" : ""} title={unmetTitle || undefined}>
                      <td>
                        {r.test_date ?? r.created_at.slice(0, 10)}
                        {unmetTitle && <span className="requirement-flag">⚠</span>}
                      </td>
                      <td>{r.gearbox_no ?? "-"}</td>
                      <td>{r.motor ?? "-"}</td>
                      <td>{r.rated_head ?? "-"}</td>
                      <td>{r.rated_rpm ?? "-"}</td>
                      <td>{r.points.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {requisition.status === "Pending" && canProcessTesting && (
          <div className="retest-actions">
            {hasPriorReports ? (
              <>
                <button disabled={isSaving} onClick={() => markRetest(true)}>
                  Retest Needed: Yes
                </button>
                <button disabled={isSaving} className="secondary" onClick={() => markRetest(false)}>
                  Retest Needed: No
                </button>
              </>
            ) : (
              <button disabled={isSaving} onClick={startTesting}>
                Start Testing
              </button>
            )}
          </div>
        )}
      </section>

      {(requisition.status === "In Testing" || requisition.status === "Retest Needed") && canProcessTesting && (
        <section className="detail-card">
          <h2>Test Report</h2>
          <p className="dedup-note">
            Once physical testing is complete, submit the test report below.
            This will close the testing summary.
          </p>
          <button onClick={() => router.push(`/requisitions/${requisition.id}/report`)}>
            Fill Test Report
          </button>
        </section>
      )}

      {requisition.status === "Closed" && (
        <section className="detail-card">
          <h2>Test Report</h2>
          <p className="dedup-note">
            This testing summary is closed.
            {submittedReport && (
              <>
                {" "}
                <Link href={`/reports/${submittedReport.id}`}>View the full report &rarr;</Link>
              </>
            )}
          </p>

          {(!hasObservation || !hasViscosityChart) && canProcessTesting && (
            <>
              <p className="dedup-note">
                This pump is still missing its {!hasObservation ? "Observation Sheet" : "Viscosity Correction Chart"}
                {" "}— submit it below so both reports exist for this pump.
              </p>
              <div className="retest-actions">
                {!hasObservation && (
                  <button onClick={() => router.push(`/requisitions/${requisition.id}/report/observation`)}>
                    + Fill Observation Sheet
                  </button>
                )}
                {!hasViscosityChart && (
                  <button onClick={() => router.push(`/requisitions/${requisition.id}/report/viscosity-chart`)}>
                    + Fill Viscosity Correction Chart
                  </button>
                )}
              </div>
            </>
          )}

          {requisition.reports?.map((r) => {
            const unmetTitle = reportUnmetTitle(r);
            return (
            <table key={r.id} className="prior-reports-table">
              <tbody>
                <tr className={unmetTitle ? "requirement-row-not-met" : ""} title={unmetTitle || undefined}>
                  <td className="label">
                    <Link href={`/reports/${r.id}`}>
                      {(r.report_format ?? "observation") === "viscosity-chart"
                        ? "Viscosity Correction Chart"
                        : "Observation Sheet"}
                    </Link>
                    {unmetTitle && <span className="requirement-flag">⚠</span>}
                  </td>
                  <td colSpan={3}>{r.report_no ?? "-"}</td>
                </tr>
                <tr>
                  <td className="label">Gearbox No.</td>
                  <td>{r.gearbox_no ?? "-"}</td>
                  <td className="label">Motor</td>
                  <td>{r.motor ?? "-"}</td>
                </tr>
                <tr>
                  <td className="label">Rated Head</td>
                  <td>{r.rated_head ?? "-"}</td>
                  <td className="label">Rated RPM</td>
                  <td>{r.rated_rpm ?? "-"}</td>
                </tr>
                <tr>
                  <td className="label">Test Points</td>
                  <td colSpan={3}>{r.points.length}</td>
                </tr>
              </tbody>
            </table>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default RequisitionDetailPage;
