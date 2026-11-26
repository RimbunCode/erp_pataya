import { Fragment } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import InputError from "@/Components/InputError";
import AccountLinkModel from "@/Pages/Finances/Accounts/AccountLinkModel";
import CategoryLinkModel from "@/Pages/Inventory/Categories/CategoryLinkModel";
import { clearedItemConditions, emptyRow } from "./ruleEditor";

// Radix Select tidak menerima nilai string kosong pada item; "semua" (kondisi null) memakai sentinel ini.
const ANY = "__any__";
const ACCOUNT_FILTERS = { is_group: false };
const VARIANTS = ["normal", "return"];

/**
 * Select dengan pilihan "Semua" (null) di awal.
 * @param {object} props
 * @param {string} props.field nama kolom (data-testid pembungkus)
 * @param {string|null} props.value
 * @param {{value: string, label: string}[]} props.options
 * @param {string} props.ariaLabel
 * @param {boolean} [props.disabled]
 * @param {(value: string|null) => void} props.onChange
 * @returns {import("react").JSX.Element}
 */
function NullableSelect({
  field,
  value,
  options,
  ariaLabel,
  disabled = false,
  onChange,
}) {
  const { t } = useLaravelReactI18n();

  return (
    <div data-testid={`rule-${field}`}>
      <Select
        value={value ?? ANY}
        disabled={disabled}
        onValueChange={(next) => onChange(next === ANY ? null : next)}
      >
        <SelectTrigger aria-label={ariaLabel} className="min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>
            {t("finances.postingProfile.form.any")}
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Editor aturan akun bersyarat (Requirement 12, Task 12.2): grid jenis dokumen / varian / peran / kondisi barang /
 * akun / prioritas. Kondisi barang hanya aktif untuk peran peka-barang (Requirement 12.5). Komponen terkendali:
 * pemilik state (Form) menyimpan baris dan mengirimnya saat simpan.
 * @param {object} props
 * @param {object[]} props.rows baris editor (lihat `ruleEditor.js`)
 * @param {(rows: object[]) => void} props.onChange
 * @param {{value: string, label: string, line_sensitive: boolean}[]} props.roles
 * @param {string[]} props.documentTypes
 * @param {string[]} props.itemTypes
 * @param {Record<string, {field: string, message: string}[]>} [props.clientErrors] galat validasi klien per kunci baris
 * @param {Record<string, string>} [props.serverErrors] `form.errors` Inertia (kunci `rules.{i}.{field}`)
 * @returns {import("react").JSX.Element}
 */
export default function RulesEditor({
  rows,
  onChange,
  roles,
  documentTypes,
  itemTypes,
  clientErrors = {},
  serverErrors = {},
}) {
  const { t } = useLaravelReactI18n();

  const update = (key, patch) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key) => onChange(rows.filter((row) => row.key !== key));

  const pickRole = (row, role) => {
    const lineSensitive =
      roles.find((candidate) => candidate.value === role)?.line_sensitive ??
      false;
    // Kondisi barang hanya sah untuk peran peka-barang: berganti ke peran lain mengosongkannya, bukan membiarkan
    // kombinasi yang pasti ditolak.
    update(row.key, {
      role,
      ...(lineSensitive ? {} : clearedItemConditions()),
    });
  };

  const pickCategory = (row, category) => {
    // Pertahanan yang sama dengan pemilih akun Form: LinkModel memanggil onValueChange(null) sendiri bila nilai awal
    // tidak lolos validasi `thisModel`; nilai itu tidak boleh menghapus kategori yang sudah tersimpan.
    if (category === null && row.category && !row.category.thisModel) {
      return;
    }
    update(row.key, {
      category: category ?? null,
      item_category_id: category?.id ?? null,
    });
  };

  const pickAccount = (row, account) => {
    if (account === null && row.account && !row.account.thisModel) {
      return;
    }
    update(row.key, { account: account ?? null });
  };

  const documentOptions = documentTypes.map((type) => ({
    value: type,
    label: t(`finances.postingParityLog.columns.document_type.options.${type}`),
  }));
  const variantOptions = VARIANTS.map((variant) => ({
    value: variant,
    label: t(`finances.postingProfile.columns.variant.options.${variant}`),
  }));
  const itemTypeOptions = itemTypes.map((type) => ({
    value: type,
    label: t(`inventory.category.types.${type}`),
  }));
  const stockOptions = [
    { value: "true", label: t("finances.postingProfile.form.yes") },
    { value: "false", label: t("finances.postingProfile.form.no") },
  ];

  const columns = [
    "document_type",
    "variant",
    "role",
    "item_type",
    "is_stock_item",
    "item_category",
    "account",
    "priority",
  ];

  const messagesFor = (row, index) => [
    ...(clientErrors[row.key] ?? []).map((error) =>
      t(`finances.postingProfile.rules_editor.errors.${error.message}`),
    ),
    ...Object.entries(serverErrors)
      .filter(([key]) => key.startsWith(`rules.${index}.`))
      .map(([, message]) => message),
  ];

  return (
    <section className="grid gap-2" data-testid="rules-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">
          {t("finances.postingProfile.rules")}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, emptyRow()])}
        >
          <Plus aria-hidden="true" />
          {t("finances.postingProfile.rules_editor.add")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("finances.postingProfile.rules_editor.description")}
      </p>
      <InputError message={serverErrors.rules} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="rules-empty">
          {t("finances.postingProfile.form.rules_empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2">
                    {t(`finances.postingProfile.columns.${column}`)}
                  </th>
                ))}
                <th className="px-3 py-2">
                  <span className="sr-only">
                    {t("finances.postingProfile.rules_editor.remove")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const role = roles.find(
                  (candidate) => candidate.value === row.role,
                );
                const itemEditable = role?.line_sensitive ?? false;
                const messages = messagesFor(row, index);

                return (
                  <Fragment key={row.key}>
                    <tr
                      className="border-t align-top"
                      data-testid="rule-editor-row"
                    >
                      <td className="px-3 py-2">
                        <NullableSelect
                          field="document_type"
                          value={row.document_type}
                          options={documentOptions}
                          ariaLabel={t(
                            "finances.postingProfile.columns.document_type",
                          )}
                          onChange={(next) =>
                            update(row.key, { document_type: next })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NullableSelect
                          field="variant"
                          value={row.variant}
                          options={variantOptions}
                          ariaLabel={t(
                            "finances.postingProfile.columns.variant",
                          )}
                          onChange={(next) =>
                            update(row.key, { variant: next })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div data-testid="rule-role">
                          <Select
                            value={row.role}
                            onValueChange={(next) => pickRole(row, next)}
                          >
                            <SelectTrigger
                              aria-label={t(
                                "finances.postingProfile.columns.role",
                              )}
                              className="min-w-40"
                            >
                              <SelectValue
                                placeholder={t(
                                  "finances.postingProfile.rules_editor.role_placeholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {row.role === "discount" && (
                          <p
                            className="mt-1 max-w-56 text-xs text-muted-foreground"
                            data-testid="rule-discount-hint"
                          >
                            {t(
                              "finances.postingProfile.rules_editor.discount_hint",
                            )}
                          </p>
                        )}
                        {role && !itemEditable && (
                          <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                            {t(
                              "finances.postingProfile.rules_editor.not_line_sensitive_hint",
                            )}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <NullableSelect
                          field="item_type"
                          value={row.item_type}
                          options={itemTypeOptions}
                          disabled={!itemEditable}
                          ariaLabel={t(
                            "finances.postingProfile.columns.item_type",
                          )}
                          onChange={(next) =>
                            update(row.key, { item_type: next })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <NullableSelect
                          field="is_stock_item"
                          value={
                            row.is_stock_item === null ||
                            row.is_stock_item === undefined
                              ? null
                              : String(row.is_stock_item)
                          }
                          options={stockOptions}
                          disabled={!itemEditable}
                          ariaLabel={t(
                            "finances.postingProfile.columns.is_stock_item",
                          )}
                          onChange={(next) =>
                            update(row.key, {
                              is_stock_item:
                                next === null ? null : next === "true",
                            })
                          }
                        />
                      </td>
                      <td className="min-w-48 px-3 py-2">
                        <div data-testid="rule-category">
                          <CategoryLinkModel
                            value={row.category}
                            disabled={!itemEditable}
                            placeholder={t(
                              "finances.postingProfile.rules_editor.category_placeholder",
                            )}
                            onValueChange={(next) => pickCategory(row, next)}
                          />
                        </div>
                      </td>
                      <td className="min-w-56 px-3 py-2">
                        <div data-testid="rule-account">
                          <AccountLinkModel
                            value={row.account}
                            filters={ACCOUNT_FILTERS}
                            placeholder={t(
                              "finances.postingProfile.form.account_placeholder",
                            )}
                            onValueChange={(next) => pickAccount(row, next)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="w-24"
                          aria-label={t(
                            "finances.postingProfile.columns.priority",
                          )}
                          value={row.priority}
                          onChange={(event) =>
                            update(row.key, { priority: event.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t(
                            "finances.postingProfile.rules_editor.remove",
                          )}
                          onClick={() => remove(row.key)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                    {messages.length > 0 && (
                      <tr className="bg-destructive/5">
                        <td colSpan={columns.length + 1} className="px-3 py-2">
                          {messages.map((message) => (
                            <div
                              key={message}
                              role="alert"
                              data-testid="rule-error"
                              className="text-sm text-destructive"
                            >
                              {message}
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
