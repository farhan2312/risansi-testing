"use client";

import ReportFormatChoice from "@/components/test-report/ReportFormatChoice";

const ReportFormatChoicePage = () => {
  return (
    <ReportFormatChoice
      heading="New Test Report"
      subheading="Choose which physical form this test was recorded on."
      observationHref="/reports/new/observation"
      viscosityChartHref="/reports/new/viscosity-chart"
      backHref="/reports"
      backLabel="Back to archive"
    />
  );
};

export default ReportFormatChoicePage;
