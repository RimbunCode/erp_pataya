import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/Components/ui/button";
import { FilterBuilderBody } from "@/Components/Table/Filter/FilterBuilder";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import { NestedFiltersProvider } from "@/Hooks/useNestedFilters";
import PermissionLinkModel from "../PermissionLinkModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useNestedFiltersImport from "./useFilterTemplateBuilder";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const [columns, setColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);

  const modelClass = data?.permission?.model ?? data?.model;

  // Jadikan default — aksi terpisah dari save form biasa (langsung hit
  // endpoint setDefault, bukan menunggu tombol Simpan). Backend TIDAK
  // mendukung "lepas default" tanpa menjadikan filter lain default (Req 1 AC
  // 8: default lepas hanya lewat hapus record) — tombol ini sengaja bukan
  // toggle, disabled begitu sudah default.
  const setAsDefault = useCallback(() => {
    if (!data?.id || savingDefault || data?.is_default) return;
    setSavingDefault(true);
    axios
      .post(route("filterTemplates.setDefault", data.id))
      .then(() => setData((prev) => ({ ...prev, is_default: true })))
      .catch(() => {})
      .finally(() => setSavingDefault(false));
  }, [data?.id, data?.is_default, savingDefault, setData]);

  useEffect(() => {
    if (!modelClass) {
      setColumns([]);
      return;
    }
    setLoadingColumns(true);
    axios
      .get(route("model.columns", { model: modelClass }))
      .then((res) => setColumns(res.data?.columns ?? []))
      .catch(() => setColumns([]))
      .finally(() => setLoadingColumns(false));
  }, [modelClass]);

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            name="model"
            required
            label={t("core.filterTemplate.columns.model")}
          >
            <PermissionLinkModel
              required
              disabled={!!data?.id}
              placeholder={t("core.filterTemplate.columns.model.placeholder")}
              value={data.permission}
              onValueChange={(val) =>
                setData((prev) => ({
                  ...prev,
                  permission: val,
                  model: val?.model,
                }))
              }
            />
          </FormInput>
          <FormInput
            name="name"
            required
            label={t("core.filterTemplate.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onValueChange={(e) => setData("name", e)}
            />
          </FormInput>
          {data?.id && (
            <Button
              type="button"
              variant={data?.is_default ? "secondary" : "outline"}
              size="sm"
              className="w-fit"
              disabled={savingDefault || data?.is_default}
              onClick={setAsDefault}
            >
              {data?.is_default
                ? t("core.filterTemplate.form.isDefault")
                : t("core.filterTemplate.form.setDefault")}
            </Button>
          )}
        </div>
      </FormPageContent>

      {modelClass ? (
        <NestedFiltersProvider
          key={modelClass}
          initialFilters={data.filter}
          columns={columns}
        >
          <BuilderSection
            data={data}
            setData={setData}
            modelClass={modelClass}
            columns={columns}
            loadingColumns={loadingColumns}
          />
        </NestedFiltersProvider>
      ) : (
        <FormPageContent
          title={t("core.filterTemplate.filterTemplate")}
          value="detail"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-4 border border-dashed rounded-lg">
            {t("core.filterTemplate.columns.model.placeholder")}
          </div>
        </FormPageContent>
      )}
    </>
  );
}

function BuilderSection({ data, setData, modelClass, columns, loadingColumns }) {
  const { t } = useLaravelReactI18n();
  const { importItems, loadingImport, applyImport } =
    useNestedFiltersImport(modelClass);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const sortableColumns = useMemo(
    () =>
      (columns ?? []).filter(
        (col) =>
          col.sortable !== false &&
          !["relations", "mixed", "json"].includes(col.type),
      ),
    [columns],
  );

  const parseSort = (raw) => {
    if (!raw) return { key: "", order: "asc" };
    const order = raw.startsWith("-") ? "desc" : "asc";
    return { key: order === "desc" ? raw.slice(1) : raw, order };
  };
  const { key: sortKey, order: sortOrder } = parseSort(data?.sort);
  const setSort = useCallback(
    (key, order) => {
      if (!key) {
        setData("sort", null);
        return;
      }
      setData("sort", `${order === "desc" ? "-" : ""}${key}`);
    },
    [setData],
  );

  const handlePreview = useCallback(() => {
    if (!modelClass) return;
    setPreviewLoading(true);
    axios
      .post(route("filterTemplates.preview"), {
        model: modelClass,
        filter: data.filter,
        sort: data.sort ?? null,
      })
      .then((res) => setPreview(res.data))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [modelClass, data.filter, data.sort]);

  return (
    <FormPageContent
      title={t("core.filterTemplate.filterTemplate")}
      value="detail"
    >
      <div className="grid gap-4">
        <FormInput
          name="import"
          label={t("core.filterTemplate.form.import")}
        >
          <Select
            disabled={loadingImport || importItems.length === 0}
            onValueChange={(id) => {
              const picked = importItems.find((x) => x.id === id);
              if (picked) applyImport(picked, setData);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t("core.filterTemplate.form.import.placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {importItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name || item.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormInput>

        <div className="border rounded-lg p-3 min-h-40">
          {loadingColumns ? (
            <div className="text-muted-foreground text-sm">
              {t("core.form.loading")}
            </div>
          ) : (
            <FilterBuilderBody onChange={(tree) => setData("filter", tree)} />
          )}
        </div>

        <FormInput name="sort" label={t("core.filterTemplate.form.sort")}>
          <div className="flex gap-2">
            <Select
              value={sortKey || "__none"}
              onValueChange={(val) =>
                setSort(val === "__none" ? "" : val, sortOrder)
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">
                  {t("core.filterTemplate.form.sort.none")}
                </SelectItem>
                {sortableColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.titleTrans ? t(col.titleTrans) : col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sortKey && (
              <Select
                value={sortOrder}
                onValueChange={(val) => setSort(sortKey, val)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">
                    {t("core.filterTemplate.form.sort.ascending")}
                  </SelectItem>
                  <SelectItem value="desc">
                    {t("core.filterTemplate.form.sort.descending")}
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </FormInput>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={previewLoading}
            onClick={handlePreview}
          >
            {t("core.filterTemplate.form.preview")}
          </Button>
          {preview && (
            <div className="mt-3 overflow-x-auto border rounded-lg">
              {preview.data.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("core.filterTemplate.form.preview.empty")}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {Object.keys(preview.data[0]).map((key) => (
                        <th key={key} className="text-left p-2 font-medium">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data.map((row, idx) => (
                      <tr key={row.id ?? idx} className="border-b last:border-0">
                        {Object.keys(preview.data[0]).map((key) => (
                          <td key={key} className="p-2">
                            {String(row[key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </FormPageContent>
  );
}
