import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { router } from "@inertiajs/react";
import { useState } from "react";

const STATUS_ACTIONS = {
  active: ["scrap", "setInMaintenance", "setOutOfOrder"],
  issued: ["scrap", "setInMaintenance", "setOutOfOrder"],
  in_maintenance: ["reactivate"],
  out_of_order: ["reactivate", "scrap"],
};

export default function Show({ asset, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [loading, setLoading] = useState(false);

  const statuses = asset?.status ?? [];
  const availableActions = statuses.flatMap(
    (status) => STATUS_ACTIONS[status] ?? [],
  );
  const uniqueActions = [...new Set(availableActions)];

  const handleAction = (action) => {
    setLoading(true);
    router.post(
      route("assets.action", { asset: asset.id, action }),
      {},
      {
        onFinish: () => setLoading(false),
      },
    );
  };

  return (
    <FormPage
      isCreate={!asset}
      ignoreDraft={defaultData}
      name="asset"
      disabled={asset?.submitted_at}
      submitable
      defaultValues={defaultData}
      controls={() => {
        if (!asset?.submitted_at || uniqueActions.length === 0) {
          return null;
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="p-2! size-fit h-8"
                variant="secondary"
                disabled={loading}
              >
                {t("core.form.actions")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {uniqueActions.map((action) => (
                <DropdownMenuItem
                  key={action}
                  onSelect={() => handleAction(action)}
                >
                  {t(`asset.asset.actions.${toSnakeCase(action)}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
    >
      <Form />
    </FormPage>
  );
}

function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
