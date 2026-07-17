"use client";

import { useRouter } from "next/navigation";
import TestReportForm from "@/components/test-report/TestReportForm";

const NewTestReportPage = () => {
  const router = useRouter();

  return (
    <TestReportForm
      heading="New Test Report"
      subheading="Fill this in once physical testing is complete. Not tied to a requisition — use the requisition flow instead if this test was assigned from one."
      submitLabel="Submit Test Report"
      onSubmitted={(report) => router.push(`/reports/${report.id}`)}
      onCancel={() => router.push("/reports")}
    />
  );
};

export default NewTestReportPage;
