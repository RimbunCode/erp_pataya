import { usePage } from "@inertiajs/react";

import DataTable2 from "../Core/DataTable2";
import ReportFilterBar from "./Components/ReportFilterBar";
import ReportLayout from "./Components/ReportLayout";

export default function StockMutation() {
  const { kpi, consistency, filterFields, filterValues } = usePage().props;

  return (
    <ReportLayout
      kpi={kpi}
      consistency={consistency}
      filters={<ReportFilterBar fields={filterFields} values={filterValues} />}
    >
      <DataTable2 selectable={false} hideDeleteAction />
    </ReportLayout>
  );
}
