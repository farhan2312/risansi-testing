"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import "./ReportDetailPage.css";
import { deleteReport, getReport } from "@/services/testingService";
import { getCurrentUser } from "@/services/session";
import { isWithinReportEditWindow, REPORT_EDIT_WINDOW_DAYS } from "@/lib/reportEditWindow";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ReportDetailSections from "@/components/report-detail/ReportDetailSections";
import type { PumpTestReport } from "@/types/testing";

const FORMAT_LABELS: Record<string, string> = {
  observation: "Observation Sheet",
  "viscosity-chart": "Viscosity Correction Chart",
};

const ReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<PumpTestReport | null>(null);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const canEditOrDelete = getCurrentUser()?.role === "testing";

  useEffect(() => {
    if (!id) return;
    getReport(id).then(setReport).catch(() => setError("Could not load report."));
  }, [id]);

  const handleDelete = async () => {
    if (!report) return;
    setIsDeleting(true);
    try {
      await deleteReport(report.id);
      router.push("/reports");
    } catch {
      setError("Could not delete report. Please try again.");
      setIsDeleting(false);
    }
  };

  if (error) return <div className="form-error-banner">{error}</div>;
  if (!report) return <p className="detail-empty">Loading...</p>;

  return (
    <div className="report-detail-page">
      {/* Only visible when printing (Export PDF) — a plain header showing
       * the Risansi logo doesn't belong in the on-screen app chrome. */}
      <div className="print-header">
        <img src="/logo.png" alt="Risansi Industries" />
        <div>
          <strong>Risansi Industries Ltd</strong>
          <span>
            Pump Test Report — {FORMAT_LABELS[report.report_format ?? ""] ?? "Observation Sheet"}
            {report.report_no ? ` — ${report.report_no}` : ""}
          </span>
        </div>
      </div>

      <div className="detail-header sticky-page-header">
        <div>
          <h1>
            {report.model}
            {report.report_no && <span className="report-no-pill">{report.report_no}</span>}
          </h1>
          <span className="format-pill">
            {FORMAT_LABELS[report.report_format ?? ""] ?? "Observation Sheet"}
          </span>
        </div>
        <div className="detail-header-actions">
          <button type="button" className="export-pdf-btn" onClick={() => window.print()}>
            Export PDF
          </button>
          {canEditOrDelete && isWithinReportEditWindow(report.created_at) && (
            <Link href={`/reports/${report.id}/edit`} className="edit-report-btn">
              Edit
            </Link>
          )}
          {canEditOrDelete && (
            <button
              type="button"
              className="delete-report-btn"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
          <Link href="/reports" className="back-link">
            &larr; Back to archive
          </Link>
        </div>
      </div>

      <ReportDetailSections report={report} />

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete report"
          message={`Delete report ${report.report_no ?? report.id}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

export default ReportDetailPage;
