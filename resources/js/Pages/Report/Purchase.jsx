import { usePage } from "@inertiajs/react";

import DataTable2 from "../Core/DataTable2";
import ReportFilterBar from "./Components/ReportFilterBar";
import ReportLayout from "./Components/ReportLayout";
import ReportLineChart from "./Components/ReportLineChart";

export default function Purchase() {
  const { kpi, consistency, chart, filterFields, filterValues } =
    usePage().props;

  return (
    <ReportLayout
      kpi={kpi}
      consistency={consistency}
      filters={<ReportFilterBar fields={filterFields} values={filterValues} />}
      chart={
        chart ? (
          <ReportLineChart
            title={chart.title}
            valueLabel={chart.valueLabel}
            series={chart.series}
          />
        ) : null
      }
    >
      <DataTable2 selectable={false} hideDeleteAction />
    </ReportLayout>
  );
}
