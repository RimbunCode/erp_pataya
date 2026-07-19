import { Tabs, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import DataTable2 from "@/Pages/Core/DataTable2";
import Form from "./Form";
import React from "react";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Index() {
  const { t } = useLaravelReactI18n();
  const params = new URLSearchParams(window.location.search);
  const scope = params.get("scope") ?? "all";

  const handleScopeChange = (value) => {
    router.get(
      window.route("todos.index"),
      value === "all" ? {} : { scope: value },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={scope} onValueChange={handleScopeChange}>
        <TabsList>
          <TabsTrigger value="all">{t("core.todo.scope.all")}</TabsTrigger>
          <TabsTrigger value="mine">{t("core.todo.scope.mine")}</TabsTrigger>
          <TabsTrigger value="byMe">{t("core.todo.scope.by_me")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable2 classNameDialog="max-w-4xl!" form={<Form />} />
    </div>
  );
}

export default Index;
