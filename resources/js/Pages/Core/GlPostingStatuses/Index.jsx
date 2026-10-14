import { router, usePage } from "@inertiajs/react";
import { RefreshCw } from "lucide-react";

import DataTable2 from "@/Pages/Core/DataTable2";
import usePermission from "@/Hooks/usePermission";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Index() {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const { model } = usePage().props;
  const { can } = usePermission(model);

  const handleRetry = (id) => {
    router.post(route("gl-posting-statuses.retry", id));
  };

  return (
    <DataTable2
      rowActions={[
        {
          key: "retry",
          label: t("core.glPostingStatus.retry"),
          icon: RefreshCw,
          requires: ["canRetry"],
          enabled: (row) => row.canRetry === true && can("write"),
          onAction: ([row]) => handleRetry(row.id),
        },
      ]}
    />
  );
}
