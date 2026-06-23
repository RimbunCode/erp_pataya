import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import { Button } from "../ui/button";
import { FormCheckbox } from "../ui/checkbox";
import React from "react";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

function ColumnsFilter({ columns: initColumn, onApply, onReset, open }) {
  const { t } = useLaravelReactI18n();
  const [columns, setColumns] = React.useState(initColumn);

  useDidMountEffect(() => {
    if (open) setColumns(initColumn);
  }, [open]);
  const _onApply = () => {
    onApply(columns);
  };
  return (
    <DialogContent className="max-w-full md:max-w-[50%]  min-w-64">
      <DialogHeader>
        <DialogTitle>{t("core.datatable.columns.select_column")}</DialogTitle>
        <DialogDescription className="sr-only">Select Column</DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto columns-[196px] space-y-4 space-x-4 [&_div]:break-inside-avoid">
        {columns.map(
          ({ name, title, titleTrans, show, type, hidden, ignore }) => {
            if (type == "relations" || type == "mixed" || type == "json")
              return;
            if (hidden || ignore) return;
            return (
              <FormCheckbox
                key={name}
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
                label={title ?? t(titleTrans)}
                className="overflow-x-hidden [&_label]:truncate"
              />
            );
          },
        )}
      </div>
      <DialogFooter className="flex justify-end">
        <Button className="h-8 px-2!" variant="outline" onClick={onReset}>
          {t("core.datatable.columns.reset")}
        </Button>
        <Button className="h-8 px-2!" onClick={_onApply}>
          {t("core.datatable.columns.apply")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default ColumnsFilter;
