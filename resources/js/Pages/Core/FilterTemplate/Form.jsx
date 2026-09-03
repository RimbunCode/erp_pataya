import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FilterBuilderBody } from "@/Components/Table/Filter/FilterBuilder";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import LinkModel from "@/Components/LinkModel";
import useNestedFilters, {
  NestedFiltersProvider,
} from "@/Hooks/useNestedFilters";
import PermissionLinkModel from "../PermissionLinkModel";
import Select from "@/Components/Select";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { Button } from "@/Components/ui/button";
import { useLaravelReactI18n } from "laravel-react-i18n";

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

function BuilderSection({
  data,
  setData,
  modelClass,
  columns,
  loadingColumns,
}) {
  const { t } = useLaravelReactI18n();
  const { setFromInitial } = useNestedFilters();
  const currentUserId = usePage().props.auth?.user?.id;
  const [importValue, setImportValue] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Reset field import tiap ganti model (tree lama sudah tidak relevan).
  useEffect(() => {
    setImportValue(null);
  }, [modelClass]);

  const applyImport = useCallback(
    (picked) => {
      setImportValue(picked);
      if (!picked?.filter) return;
      setFromInitial(picked.filter);
      setData((prev) => ({ ...prev, filter: picked.filter }));
    },
    [setFromInitial, setData],
  );

  const sortableColumns = useMemo(
    () =>
      (columns ?? []).filter(
        (col) =>
          col.sortable !== false &&
          !["relations", "mixed", "json"].includes(col.type),
      ),
    [columns],
  );
  const sortColumnOptions = useMemo(
    () => [
      { value: "__none", label: t("core.filterTemplate.form.sort.none") },
      ...sortableColumns.map((col) => ({
        value: col.name,
        label: col.titleTrans ? t(col.titleTrans) : col.name,
      })),
    ],
    [sortableColumns, t],
  );
  const sortOrderOptions = useMemo(
    () => [
      { value: "asc", label: t("core.filterTemplate.form.sort.ascending") },
      { value: "desc", label: t("core.filterTemplate.form.sort.descending") },
    ],
    [t],
  );

  const parseSort = (raw) => {
    if (!raw) return { key: "", order: "asc" };
    const order = raw.startsWith("-") ? "desc" : "asc";
    return { key: order === "desc" ? raw.slice(1) : raw, order };
  };
  const { key: sortKey, order: sortOrder } = parseSort(data?.sort);
  const setSort = useCallback(
    (key, order) => {
      if (!key || key === "__none") {
        setData("sort", null);
        return;
      }
      setData("sort", `${order === "desc" ? "-" : ""}${key}`);
    },
    [setData],
  );

  // Preview otomatis (debounced) — tak perlu tombol, mengikuti perubahan
  // filter/sort/model seperti halaman list biasa.
  useEffect(() => {
    if (!modelClass) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      axios
        .post(route("filterTemplates.preview"), {
          model: modelClass,
          filter: data.filter,
          sort: data.sort ?? null,
        })
        .then((res) => setPreview(res.data))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [modelClass, data.filter, data.sort]);

  return (
    <FormPageContent
      title={t("core.filterTemplate.filterTemplate")}
      value="detail"
    >
      <div className="grid gap-4">
        <FormInput name="import" label={t("core.filterTemplate.form.import")}>
          <LinkModel
            model="App\Models\Core\SavedFilter"
            placeholder={t("core.filterTemplate.form.import.placeholder")}
            disabledAddButton
            disabledNavigation
            fields={["filter"]}
            filters={{
              model: modelClass,
              is_saved: true,
              or: { user_id: currentUserId, is_shared: true },
            }}
            value={importValue}
            onValueChange={applyImport}
          />
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
              className="flex-1"
              value={sortKey || "__none"}
              options={sortColumnOptions}
              onValueChange={(val) => setSort(val, sortOrder)}
            />
            {sortKey && (
              <Select
                className="w-40"
                value={sortOrder}
                options={sortOrderOptions}
                onValueChange={(val) => setSort(sortKey, val)}
              />
            )}
          </div>
        </FormInput>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">
              {t("core.filterTemplate.form.preview")}
            </span>
            {previewLoading && (
              <span className="text-xs text-muted-foreground">
                {t("core.form.loading")}
              </span>
            )}
          </div>
          {preview && (
            <div className="overflow-x-auto border rounded-lg">
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
                      <tr
                        key={row.id ?? idx}
                        className="border-b last:border-0"
                      >
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
