import { router, usePage } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
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
      actions={({ dataRow }) =>
        dataRow.status === "failed" &&
        can("write") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleRetry(dataRow.id)}
          >
            {t("core.glPostingStatus.retry")}
          </Button>
        )
      }
    />
  );
}
