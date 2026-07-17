"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TestReportForm from "@/components/test-report/TestReportForm";
import { getRequisition } from "@/services/testingService";
import type { TestRequisition } from "@/types/testing";

const TestReportPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [requisition, setRequisition] = useState<TestRequisition | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getRequisition(id).then(setRequisition).catch(() => setError("Could not load requisition."));
  }, [id]);

  if (error) return <div className="form-error-banner">{error}</div>;
  if (!requisition) return <p className="detail-empty">Loading...</p>;

  return (
    <TestReportForm
      lockedModel={requisition.model}
      requisitionId={id}
      heading={`Test Report — ${requisition.model}`}
      subheading={`Submitting this report will close requisition ${requisition.id.slice(0, 8)}.`}
      submitLabel="Submit Report & Close Requisition"
      onSubmitted={() => router.push(`/requisitions/${id}`)}
      onCancel={() => router.push(`/requisitions/${id}`)}
    />
  );
};

export default TestReportPage;
