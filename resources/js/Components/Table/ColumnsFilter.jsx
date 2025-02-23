import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import React from "react";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ColumnsFilter({ columns: initColumn, onApply, open }) {
  const { t } = useLaravelReactI18n();
  const [columns, setColumns] = React.useState(initColumn);

  useDidMountEffect(() => {
    if (open) setColumns(initColumn);
  }, [open]);
  const _onApply = () => {
    onApply(columns);
  };
  return (
    <DialogContent className="max-w-full sm:max-w-sm w-fit min-w-64">
      <DialogHeader>
        <DialogTitle>{t("core.datatable.columns.select_column")}</DialogTitle>
        <DialogDescription className="sr-only">Select Column</DialogDescription>
      </DialogHeader>
      {columns.map(({ name, titleTrans, show }) => (
        <div key={name} className="flex items-center space-x-2">
          <Checkbox
            id={name + "-checkbox"}
            checked={show}
            onCheckedChange={(val) => {
              setColumns((x) => {
                return x.map((y) => {
                  if (y.name === name) {
                    return { ...y, show: val };
                  }
                  return y;
                });
              });
            }}
          />
          <label
            htmlFor={name + "-checkbox"}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {t(titleTrans)}
          </label>
        </div>
      ))}
      <DialogFooter className="flex justify-end">
        <Button className="h-8 !px-2" onClick={_onApply}>
          {t("core.datatable.columns.apply")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default ColumnsFilter;
