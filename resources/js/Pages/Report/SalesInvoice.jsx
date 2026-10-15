import { usePage } from "@inertiajs/react";

import DataTable2 from "../Core/DataTable2";
import ReportFilterBar from "./Components/ReportFilterBar";
import ReportLayout from "./Components/ReportLayout";

export default function SalesInvoice() {
  const { kpi, consistency, filterFields, filterValues } = usePage().props;

  return (
    <DataTable2
      selectable={false}
      hideDeleteAction
      beforeTable={
        <ReportLayout
          kpi={kpi}
          consistency={consistency}
          filters={
            <ReportFilterBar fields={filterFields} values={filterValues} />
          }
        />
      }
    />
  );
}
