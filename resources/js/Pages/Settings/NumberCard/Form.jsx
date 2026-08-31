import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { useEffect, useMemo, useState } from "react";

import AssignableLinkModel from "@/Pages/Users/ManageUsers/AssignableLinkModel";
import ColorInput from "@/Components/ColorInput";
import FilterTable2 from "@/Components/Table/Filter/FilterTable2";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import IconPicker from "@/Components/IconPicker";
import { Input } from "@/Components/ui/input";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import Select from "@/Components/Select";
import TiptapEditor from "@/Components/TiptapEditor";
import axios from "axios";
import { richTextValue } from "@/lib/richText";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Feedback user: pisah dari Widget lama — NumberCard TANPA time-series
// (value = 1 query agregat langsung, lihat NumberCardService::getValue()).
export default function Form() {
  const { t } = useLaravelReactI18n();
  // Bug ditemukan (verifikasi manual): Select `source_type` SEBELUMNYA
  // pakai fallback display-only (`data?.source_type ?? "document_type"`)
  // — tampil terisi "Tipe Dokumen" tapi `data.source_type` sungguhan TETAP
  // undefined kalau user tidak klik dropdown-nya, submit gagal validasi
  // "source type wajib diisi". Default SUNGGUHAN diberikan lewat parameter
  // `useFormPage` (mekanisme resmi hook ini utk default value baru, TIDAK
  // ditimpa saat draft localStorage di-restore — beda dari `useEffect`
  // ad-hoc yang saya coba duluan, kalah lawan restore draft).
  const { data, setData } = useFormPage(
    { source_type: "document_type" },
    { trackDefaultValue: false },
  );

  const [columns, setColumns] = useState([]);
  const sourceType = data?.source_type ?? "document_type";
  const modelClass = data?.model?.model;

  useEffect(() => {
    const reloadData = setTimeout(() => {
      if (!modelClass) {
        setColumns([]);
        setData("aggregate_function_based_on", null);
        return;
      }
      axios
        .get(window.route("model.columns", { model: modelClass }))
        // Feedback user: tambahkan Filter (pola sama FilterTable2 di
        // QuickList) — butuh SEMUA tipe kolom (termasuk relation/
        // formStatus), bukan cuma yang bisa jadi target agregat. Filter
        // number/currency utk aggregate_function_based_on tetap difilter
        // terpisah lewat `numberColumns` di bawah, bukan di sini.
        .then((res) => setColumns(res.data?.columns ?? []))
        .catch((err) => console.log(err));
    }, 500);

    return () => clearTimeout(reloadData);
  }, [modelClass]);

  const numberColumns = useMemo(
    () =>
      columns
        .filter((x) => ["number", "currency"].includes(x.type))
        .map((x) => ({ value: x.name, titleTrans: x.titleTrans })),
    [columns],
  );

  const nestedColumns = useMemo(
    () => [
      {
        name: "assignable",
        title: "Role / User",
        required: true,
        cell({ data: rowData, setData: setRowData, attributes }) {
          return (
            <AssignableLinkModel
              value={rowData}
              onValueChange={(val) => setRowData("assignable", val)}
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <FormPageContent value="detail" title={t("settings.number_card.details")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="label"
            label={t("settings.number_card.columns.label")}
            required
          >
            <Input
              value={data?.label}
              onValueChange={(val) => setData("label", val)}
            />
          </FormInput>
          <FormInput name="icon" label={t("settings.number_card.columns.icon")}>
            <IconPicker
              value={data?.icon}
              onValueChange={(val) => setData("icon", val)}
            />
          </FormInput>
          <FormInput
            name="description"
            label={t("settings.number_card.columns.description")}
            className="md:col-span-2"
          >
            <TiptapEditor
              value={richTextValue(data?.description)}
              onValueChange={(json, html) =>
                setData("description", { json, html })
              }
            />
          </FormInput>
          <FormInput
            name="source_type"
            label={t("settings.number_card.columns.source_type")}
            required
          >
            <Select
              value={sourceType}
              onValueChange={(val) => setData("source_type", val)}
              optionTrans="settings.number_card.source_types"
              options={["document_type", "custom"]}
            />
          </FormInput>

          {sourceType === "document_type" && (
            <>
              <FormInput
                name="model"
                label={t("settings.number_card.columns.model")}
                required
              >
                <PermissionLinkModel
                  value={data.model}
                  onValueChange={(val) => setData("model", val)}
                />
              </FormInput>
              <FormInput
                name="function"
                label={t("settings.number_card.columns.function")}
                required
              >
                <Select
                  value={data?.function}
                  onValueChange={(val) => setData("function", val)}
                  optionTrans="settings.number_card.functions"
                  options={["count", "sum", "average", "minimum", "maximum"]}
                />
              </FormInput>
              {data.function && data.function !== "count" && (
                <FormInput
                  name="aggregate_function_based_on"
                  label={t(
                    "settings.number_card.columns.aggregate_function_based_on",
                  )}
                  disabled={!modelClass}
                  required
                >
                  <Select
                    value={data?.aggregate_function_based_on}
                    onValueChange={(val) =>
                      setData("aggregate_function_based_on", val)
                    }
                    options={numberColumns}
                  />
                </FormInput>
              )}
              {modelClass && (
                <FormInput
                  name="filters"
                  label={t("settings.number_card.columns.filters")}
                  className="md:col-span-2"
                >
                  <FilterTable2
                    columns={columns}
                    model={modelClass}
                    initialFilters={data?.filters}
                    onApply={(tree) => setData("filters", tree)}
                  />
                </FormInput>
              )}
            </>
          )}

          {sourceType === "custom" && (
            <FormInput name="method" label="Custom Source">
              <Input
                value={data?.method}
                onValueChange={(val) => setData("method", val)}
              />
            </FormInput>
          )}

          <FormInput
            name="color"
            label={t("settings.number_card.columns.color")}
          >
            <ColorInput
              value={data?.color}
              onValueChange={(val) => setData("color", val)}
            />
          </FormInput>
          <FormInput
            name="currency"
            label={t("settings.number_card.columns.currency")}
          >
            <Input
              value={data?.currency}
              onValueChange={(val) => setData("currency", val)}
            />
          </FormInput>

          <FormCheckbox
            label={t("settings.number_card.columns.show_full_number")}
            description={t(
              "settings.number_card.descriptions.show_full_number",
            )}
            checked={data?.show_full_number ?? false}
            onCheckedChange={(val) => setData("show_full_number", val)}
          />
          <FormCheckbox
            label={t("settings.number_card.columns.show_percentage_stats")}
            description={t(
              "settings.number_card.descriptions.show_percentage_stats",
            )}
            checked={data?.show_percentage_stats ?? true}
            onCheckedChange={(val) => setData("show_percentage_stats", val)}
          />
          {data?.show_percentage_stats && (
            <FormInput
              name="stats_time_interval"
              className="col-start-2"
              label={t("settings.number_card.columns.stats_time_interval")}
              required
            >
              <Select
                value={data?.stats_time_interval}
                onValueChange={(val) => setData("stats_time_interval", val)}
                optionTrans="settings.number_card.stats_time_intervals"
                options={["daily", "weekly", "monthly", "yearly"]}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>

      <FormPageContent value="detail" title={t("settings.number_card.sharing")}>
        <FormCheckbox
          label={t("settings.number_card.columns.is_shared_all")}
          description={t("settings.number_card.descriptions.is_shared_all")}
          checked={data?.is_shared_all ?? false}
          onCheckedChange={(val) => setData("is_shared_all", val)}
        />
        {!data?.is_shared_all && (
          <FormTable
            name="NumberCardAssignables"
            label="Bagikan ke Role/User"
            className="mt-2"
            columns={nestedColumns}
            value={data?.assignables ?? []}
            onValueChange={(val) => setData("assignables", val)}
          />
        )}
      </FormPageContent>
    </>
  );
}
