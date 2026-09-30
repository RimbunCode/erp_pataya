import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

import { Button } from "../ui/button";
import { FormCheckbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { RunningTextContent } from "../ui/running-text";
import React from "react";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { compareLabels } from "@/lib/compareLabels";
import { highlightMatch } from "@/lib/highlightMatch";

function ColumnsFilter({ columns: initColumn, onApply, onReset, open }) {
  const { t, currentLocale } = useLaravelReactI18n();
  // `?.` -- banyak test me-mock i18n cuma dgn `t` (tanpa currentLocale); di
  // app nyata currentLocale selalu ada.
  const locale = currentLocale?.();
  const [columns, setColumns] = React.useState(initColumn);
  const [search, setSearch] = React.useState("");

  useDidMountEffect(() => {
    if (open) {
      setColumns(initColumn);
      setSearch("");
    }
  }, [open]);
  const _onApply = () => {
    onApply(columns);
  };
  const visibleColumns = columns.filter(
    ({ name, title, titleTrans, type, hidden, ignore, primaryKey }) => {
      if (type == "relations" || type == "mixed" || type == "json")
        return false;
      if (hidden || ignore || name === primaryKey) return false;
      if (!search) return true;
      return (title ?? t(titleTrans))
        .toLowerCase()
        .includes(search.toLowerCase());
    },
  );
  // Sort HANYA daftar tampilan (hasil filter = array baru), JANGAN state
  // `columns` -- urutannya dikirim balik lewat onApply & menentukan urutan
  // kolom tabel.
  visibleColumns.sort((a, b) =>
    compareLabels(
      a.title ?? t(a.titleTrans),
      b.title ?? t(b.titleTrans),
      locale,
    ),
  );
  return (
    <DialogContent className="max-w-full md:max-w-[85%]  min-w-64">
      <DialogHeader>
        <DialogTitle>{t("core.datatable.columns.select_column")}</DialogTitle>
        <DialogDescription className="sr-only">Select Column</DialogDescription>
      </DialogHeader>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("core.datatable.filter.column.search.placeholder")}
        className="h-8"
      />
      <div className="overflow-y-auto overflow-x-hidden max-h-[60vh] grid items-start grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-4 gap-y-5">
        {visibleColumns.length === 0 ? (
          <p className="text-muted-foreground text-sm col-span-full">
            {t("core.datatable.filter.column.not_found")}
          </p>
        ) : (
          visibleColumns.map(({ name, title, titleTrans, show, locked }) => (
            <FormCheckbox
              key={name}
              id={name}
              checked={locked ? true : show}
              disabled={locked}
              onCheckedChange={
                locked
                  ? undefined
                  : (val) => {
                      setColumns((x) => {
                        return x.map((y) => {
                          if (y.name === name) {
                            return { ...y, show: val };
                          }
                          return y;
                        });
                      });
                    }
              }
              className="overflow-x-hidden [&_label]:truncate"
            >
              {/* `label` prop FormCheckbox cuma di-wrap <label htmlFor> proper
                  kalau string/number (lihat hasPlainLabel di checkbox.jsx) --
                  hasil highlightMatch berupa array node, jadi harus lewat
                  `children` + bikin <label> sendiri (persis pola internal
                  FormCheckbox), supaya asosiasi htmlFor & marquee tetap ada. */}
              <label htmlFor={name}>
                <RunningTextContent
                  text={highlightMatch(title ?? t(titleTrans), search)}
                />
              </label>
            </FormCheckbox>
          ))
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
