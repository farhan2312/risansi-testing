"use client";

import { useRouter } from "next/navigation";
import ViscosityChartForm from "@/components/test-report/ViscosityChartForm";

const NewViscosityChartPage = () => {
  const router = useRouter();

  return (
    <ViscosityChartForm
      heading="New Test Report — Viscosity Correction Chart"
      subheading="Fill this in once physical testing is complete. Not tied to a requisition — use the requisition flow instead if this test was assigned from one."
      submitLabel="Submit Test Report"
      onSubmitted={(report) => router.push(`/reports/${report.id}`)}
      onCancel={() => router.push("/reports/new")}
    />
  );
};

export default NewViscosityChartPage;
