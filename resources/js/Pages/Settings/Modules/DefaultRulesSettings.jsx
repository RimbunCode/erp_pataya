import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { router, useHttp } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import FormTable from "@/Components/FormTable";
import Select from "@/Components/Select";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import CategoryLinkModel from "@/Pages/Inventory/Categories/CategoryLinkModel";
import ItemLinkModel from "@/Pages/Inventory/Items/ItemLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";

const EMPTY_ARRAY = [];

const stockCondition = (value) =>
  value == null || value === "" ? null : [true, 1, "1", "true"].includes(value);

const normalizeRules = (rules, valueKey) =>
  (Array.isArray(rules) ? rules : []).map((rule) => ({
    ...rule,
    __row_key: rule.id ?? null,
    document_type: rule.document_type ?? "",
    item_type: rule.item_type ?? "",
    is_stock_item:
      rule.is_stock_item == null
        ? ""
        : [true, 1, "1", "true"].includes(rule.is_stock_item)
          ? "true"
          : "false",
    item_category_id: rule.item_category_id ?? "",
    item_category: rule.item_category ?? null,
    tax: rule.tax ?? null,
    warehouse: rule.warehouse ?? null,
    [valueKey]:
      rule[valueKey] ??
      rule[valueKey === "tax_id" ? "tax" : "warehouse"]?.id ??
      "",
    priority: rule.priority ?? 0,
  }));

const serializeRules = (rules, valueKey) =>
  rules.map(({ id, __row_key, item_category, tax, warehouse, ...rule }) => ({
    ...(id ? { id } : {}),
    document_type: rule.document_type || null,
    item_type: rule.item_type || null,
    is_stock_item: stockCondition(rule.is_stock_item),
    item_category_id: rule.item_category_id || item_category?.id || null,
    [valueKey]:
      rule[valueKey] ||
      (valueKey === "tax_id" ? tax?.id : warehouse?.id) ||
      null,
    priority: Number(rule.priority) || 0,
  }));

const draftSnapshot = (taxRules, warehouseRules) =>
  JSON.stringify(
    [[taxRules, "tax_id"], [warehouseRules, "warehouse_id"]].map(
      ([rules, valueKey]) =>
        serializeRules(rules, valueKey).map((rule, index) => ({
          ...rule,
          priority: String(rules[index].priority ?? 0),
        })),
    ),
  );

const conditionKey = (rule) =>
  JSON.stringify([
    rule.document_type || null,
    rule.item_type || null,
    stockCondition(rule.is_stock_item),
    rule.item_category_id || null,
  ]);

export const duplicateRuleItem = (item) => {
  const rule = { ...item };
  delete rule.id;
  delete rule.__row_key;
  return rule;
};

function RuleTable({
  kind,
  rules,
  setRules,
  options,
  categories,
  documentTypes,
  disabled,
  t,
  referenceUnavailable,
}) {
  const valueKey = kind === "tax" ? "tax_id" : "warehouse_id";
  const defaultValueRow = useMemo(() => ({ priority: 0 }), []);
  const columns = useMemo(() => {
    const column = (name, cell, width = 1) => ({
      name,
      title: t(`rules.columns.${name}`),
      show: true,
      width,
      cell,
    });
    const isUnavailableValue = (value) =>
      value && !options.some((option) => String(option.id) === String(value));

    return [
      column(
        "document_type",
        ({ data, dataRow, setData, attributes }) => (
          <Select
            id={`default-rule-${kind}-document-type-${dataRow?.__row_key ?? "new"}`}
            aria-label={t("rules.columns.document_type")}
            value={data ?? undefined}
            onValueChange={(value) => setData("document_type", value ?? "")}
            placeholder={t("rules.any")}
            options={[
              ...(data && !documentTypes.some((type) => type.value === data)
                ? [
                    {
                      value: data,
                      label: `${t("rules.unavailable_value")} (${data})`,
                    },
                  ]
                : []),
              ...documentTypes.map((type) => ({
                value: type.value,
                label: t(`rules.document_types.${type.value}`),
              })),
            ]}
            {...attributes}
          />
        ),
        1.3,
      ),
      column("item_type", ({ data, setData, attributes }) => (
        <Input
          aria-label={t("rules.columns.item_type")}
          className={attributes.className}
          value={data ?? ""}
          disabled={attributes.readOnly}
          name={attributes.name}
          required={attributes.required}
          ref={attributes.ref}
          onKeyDown={attributes.onKeyDown}
          onChange={(event) => setData("item_type", event.target.value)}
        />
      )),
      column(
        "is_stock_item",
        ({ data, dataRow, setData, attributes }) => (
          <Select
            id={`default-rule-${kind}-stock-status-${dataRow?.__row_key ?? "new"}`}
            aria-label={t("rules.columns.is_stock_item")}
            value={data ?? undefined}
            onValueChange={(value) => setData("is_stock_item", value ?? "")}
            placeholder={t("rules.any")}
            options={[
              { value: "true", label: t("rules.stock") },
              { value: "false", label: t("rules.non_stock") },
            ]}
            {...attributes}
          />
        ),
        1.1,
      ),
      column(
        "item_category_id",
        ({ dataRow, setData, attributes }) => {
          const data = dataRow.item_category_id;
          const categoryUnavailable =
            data &&
            Array.isArray(categories) &&
            !categories.some(
              (category) => String(category.id) === String(data),
            );

          return (
            <div>
              <CategoryLinkModel
                value={dataRow.item_category ?? null}
                placeholder={t("rules.any")}
                onValueChange={(category) =>
                  setData({
                    item_category: category ?? null,
                    item_category_id: category?.id ?? "",
                  })
                }
                {...attributes}
              />
              {categoryUnavailable && (
                <p className="mt-1 text-xs text-amber-700" role="alert">
                  {referenceUnavailable}
                </p>
              )}
            </div>
          );
        },
        1.3,
      ),
      column(
        valueKey,
        ({ dataRow, setData, attributes }) => {
          const data = dataRow[valueKey];
          const reference = kind === "tax" ? dataRow.tax : dataRow.warehouse;
          const unavailable = isUnavailableValue(data);
          const LinkModelComponent =
            kind === "tax" ? TaxLinkModel : WarehouseLinkModel;

          return (
            <div>
              <LinkModelComponent
                value={reference ?? null}
                placeholder={t(
                  kind === "tax" ? "rules.no_tax" : "rules.choose_value",
                )}
                includeGlobalBranch={kind === "warehouse"}
                onValueChange={(value) =>
                  setData({
                    [kind === "tax" ? "tax" : "warehouse"]: value ?? null,
                    [valueKey]: value?.id ?? "",
                  })
                }
                {...attributes}
              />
              {unavailable && (
                <p className="mt-1 text-xs text-amber-700" role="alert">
                  {referenceUnavailable}
                </p>
              )}
            </div>
          );
        },
        1.3,
      ),
      column("priority", ({ data, setData, attributes }) => (
        <Input
          aria-label={t("rules.columns.priority")}
          type="number"
          className={attributes.className}
          min="0"
          step="1"
          value={data ?? 0}
          disabled={attributes.readOnly}
          name={attributes.name}
          required={attributes.required}
          ref={attributes.ref}
          onKeyDown={attributes.onKeyDown}
          onChange={(event) => setData("priority", event.target.value)}
        />
      )),
    ];
  }, [
    categories,
    documentTypes,
    kind,
    options,
    referenceUnavailable,
    t,
    valueKey,
  ]);

  return (
    <FormTable
      name={`Default${kind === "tax" ? "Tax" : "Warehouse"}Rules`}
      label={t(`rules.${kind}.title`)}
      className="min-w-0"
      columns={columns}
      value={rules}
      onValueChange={setRules}
      defaultValueRow={defaultValueRow}
      disabled={disabled}
      keyItem="__row_key"
      onDuplicateRow={duplicateRuleItem}
    />
  );
}

export default function DefaultRulesSettings({
  moduleKey,
  defaultTaxRules = null,
  defaultWarehouseRules = null,
  defaultRulesVersion,
  activeTaxes = null,
  activeWarehouses = null,
  categories = null,
  canWrite = true,
  registerSaveHandler,
}) {
  const { t: translate } = useLaravelReactI18n();
  const t = useCallback(
    (key, replacements) =>
      translate(`${moduleKey}.setting.${key}`, replacements),
    [moduleKey, translate],
  );
  const [taxRules, setTaxRules] = useState(() =>
    normalizeRules(defaultTaxRules, "tax_id"),
  );
  const [warehouseRules, setWarehouseRules] = useState(() =>
    normalizeRules(defaultWarehouseRules, "warehouse_id"),
  );
  const [savedDraft, setSavedDraft] = useState(() =>
    draftSnapshot(taxRules, warehouseRules),
  );
  const [baseRulesVersion, setBaseRulesVersion] = useState(defaultRulesVersion);
  const isDirty = draftSnapshot(taxRules, warehouseRules) !== savedDraft;

  useEffect(() => {
    if (isDirty || defaultRulesVersion === baseRulesVersion) return;

    const nextTaxRules = normalizeRules(defaultTaxRules, "tax_id");
    const nextWarehouseRules = normalizeRules(defaultWarehouseRules, "warehouse_id");
    setTaxRules(nextTaxRules);
    setWarehouseRules(nextWarehouseRules);
    setSavedDraft(draftSnapshot(nextTaxRules, nextWarehouseRules));
    setBaseRulesVersion(defaultRulesVersion);
  }, [defaultTaxRules, defaultWarehouseRules, defaultRulesVersion, baseRulesVersion, isDirty]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [documentType, setDocumentType] = useState("");
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const previewRequestVersion = useRef(0);
  const previewRequest = useHttp({ document_type: "", items: [] });
  const previewContext = useRef({ itemId: null, documentType: "" });
  previewContext.current = {
    itemId: selectedItem?.id ?? null,
    documentType: documentType.trim(),
  };
  const errorMessage = useMemo(
    () => Object.values(previewRequest.errors ?? {})[0] ?? "",
    [previewRequest.errors],
  );
  const referenceUnavailable = t("rules.reference_unavailable");
  const documentTypeOptions = useMemo(
    () =>
      (moduleKey === "purchase"
        ? ["purchase_order", "purchase_receipt", "purchase_invoice"]
        : ["sales_order", "delivery_note", "sales_invoice", "quotation"]
      ).map((value) => ({ value })),
    [moduleKey],
  );
  const warehouseDocumentTypeOptions = useMemo(
    () =>
      documentTypeOptions.filter(({ value }) =>
        ["purchase_order", "purchase_receipt", "sales_order", "delivery_note"].includes(value),
      ),
    [documentTypeOptions],
  );

  const validate = useCallback(() => {
    const collections = [
      ["tax", taxRules],
      ["warehouse", warehouseRules],
    ];

    for (const [kind, rules] of collections) {
      const seen = new Set();
      for (const rule of rules) {
        if (
          kind === "warehouse" &&
          rule.document_type &&
          !warehouseDocumentTypeOptions.some(
            ({ value }) => value === rule.document_type,
          )
        ) {
          return t("rules.validation.warehouse_document_type");
        }
        if (
          ![rule.document_type, rule.item_type, rule.item_category_id].some(
            Boolean,
          ) &&
          stockCondition(rule.is_stock_item) === null
        ) {
          return t(`rules.validation.condition_required_${kind}`);
        }
        const key = conditionKey(rule);
        if (seen.has(key)) return t("rules.validation.duplicate");
        seen.add(key);
        if (
          !Number.isInteger(Number(rule.priority)) ||
          Number(rule.priority) < 0
        ) {
          return t("rules.validation.priority");
        }
        if (kind === "warehouse" && !rule.warehouse_id) {
          return t("rules.validation.warehouse_value_required");
        }
      }
    }

    if (
      warehouseRules.some(
        (rule) => stockCondition(rule.is_stock_item) === false,
      )
    ) {
      return t("rules.validation.warehouse_non_stock");
    }

    return "";
  }, [taxRules, warehouseRules, warehouseDocumentTypeOptions, t]);

  const prepareSavePayload = useCallback(() => {
    const validationMessage = validate();
    setSaveError(validationMessage);
    if (validationMessage) return false;

    return {
      tax_rules: serializeRules(taxRules, "tax_id"),
      warehouse_rules: serializeRules(warehouseRules, "warehouse_id"),
      ...(baseRulesVersion ? { rules_version: baseRulesVersion } : {}),
    };
  }, [taxRules, warehouseRules, validate, baseRulesVersion]);

  const saveCallbacks = useMemo(
    () => ({
      onStart: () => setSaving(true),
      onSuccess: (page) => {
        if (page?.props?.defaultRulesVersion) {
          setBaseRulesVersion(page.props.defaultRulesVersion);
        }
        const savedTaxRules = normalizeRules(page?.props?.defaultTaxRules, "tax_id");
        const savedWarehouseRules = normalizeRules(
          page?.props?.defaultWarehouseRules,
          "warehouse_id",
        );
        setTaxRules(savedTaxRules);
        setWarehouseRules(savedWarehouseRules);
        setSavedDraft(draftSnapshot(savedTaxRules, savedWarehouseRules));
        setSaveError("");
      },
      onError: (requestErrors) =>
        setSaveError(
          Object.values(requestErrors ?? {})[0] ?? t("rules.save_failed"),
        ),
      onNetworkError: () => setSaveError(t("rules.save_failed")),
      onHttpException: () => setSaveError(t("rules.save_failed")),
      onFinish: () => setSaving(false),
    }),
    [t],
  );

  const saveRules = useCallback(() => {
    const payload = prepareSavePayload();
    if (payload === false) return Promise.resolve(false);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (success) => {
        if (settled) return;
        settled = true;
        resolve(success);
      };
      router.put(`/settings/modules/${moduleKey}/default-rules`, payload, {
        preserveScroll: true,
        onStart: saveCallbacks.onStart,
        onSuccess: (page) => {
          saveCallbacks.onSuccess(page);
          finish(true);
        },
        onError: (errors) => {
          saveCallbacks.onError(errors);
          finish(false);
        },
        onCancel: () => finish(false),
        onNetworkError: () => {
          saveCallbacks.onNetworkError();
          finish(false);
        },
        onHttpException: () => {
          saveCallbacks.onHttpException();
          finish(false);
        },
        onFinish: () => {
          saveCallbacks.onFinish();
          finish(false);
        },
      });
    });
  }, [moduleKey, prepareSavePayload, saveCallbacks]);

  useEffect(() => {
    registerSaveHandler?.(prepareSavePayload, saveCallbacks, isDirty);
  }, [registerSaveHandler, prepareSavePayload, saveCallbacks, isDirty]);

  useEffect(() => () => registerSaveHandler?.(null), [registerSaveHandler]);

  const preview = async () => {
    const requestVersion = ++previewRequestVersion.current;
    const requestedItemId = selectedItem?.id ?? null;
    const requestedDocumentType = documentType.trim();
    setPreviewResult(null);
    setPreviewError("");
    if (!requestedItemId || !requestedDocumentType) {
      setPreviewError(t("rules.preview_required"));
      return;
    }

    previewRequest.setData({
      document_type: requestedDocumentType,
      items: [{ item_id: requestedItemId }],
    });
    try {
      const result = await previewRequest.post("/defaults/resolve");
      if (
        requestVersion !== previewRequestVersion.current ||
        String(previewContext.current.itemId) !== String(requestedItemId) ||
        previewContext.current.documentType !== requestedDocumentType
      ) {
        return;
      }
      setPreviewResult(
        result?.items?.[requestedItemId] ??
          result?.data?.[requestedItemId] ??
          result?.[requestedItemId] ??
          null,
      );
      if (!result) setPreviewError(t("rules.preview_failed"));
    } catch {
      if (requestVersion === previewRequestVersion.current) {
        setPreviewError(t("rules.preview_failed"));
      }
    }
  };

  useEffect(() => {
    previewRequestVersion.current += 1;
    setPreviewResult(null);
    setPreviewError("");
  }, [selectedItem?.id, documentType]);

  return (
    <div className="grid gap-6" data-testid="default-rules-settings">
      <p className="text-sm text-muted-foreground">{t("rules.description")}</p>
      <RuleTable
        kind="tax"
        rules={taxRules}
        setRules={setTaxRules}
        options={Array.isArray(activeTaxes) ? activeTaxes : EMPTY_ARRAY}
        categories={Array.isArray(categories) ? categories : null}
        documentTypes={documentTypeOptions}
        disabled={!canWrite || saving}
        t={t}
        referenceUnavailable={referenceUnavailable}
      />
      <RuleTable
        kind="warehouse"
        rules={warehouseRules}
        setRules={setWarehouseRules}
        options={
          Array.isArray(activeWarehouses) ? activeWarehouses : EMPTY_ARRAY
        }
        categories={Array.isArray(categories) ? categories : null}
        documentTypes={warehouseDocumentTypeOptions}
        disabled={!canWrite || saving}
        t={t}
        referenceUnavailable={referenceUnavailable}
      />
      {(canWrite && !registerSaveHandler) || saveError || errorMessage ? (
        <div className="flex flex-wrap items-center gap-3">
          {canWrite && !registerSaveHandler && (
            <Button type="button" onClick={saveRules} disabled={saving}>
              {saving ? t("rules.saving") : t("rules.save")}
            </Button>
          )}
          {(saveError || errorMessage) && (
            <p role="alert">{saveError || errorMessage}</p>
          )}
        </div>
      ) : null}
      <section
        className="grid max-w-2xl gap-3 border-t pt-5"
        aria-labelledby="default-rules-preview-title"
      >
        <h3 id="default-rules-preview-title" className="font-semibold">
          {t("rules.preview_title")}
        </h3>
        <label className="grid gap-1 text-sm">
          {t("rules.preview_document_type")}
          <Select
            id={`default-rule-preview-document-type`}
            aria-label={t("rules.preview_document_type")}
            className="h-8 w-full"
            value={documentType || undefined}
            disabled={saving}
            onValueChange={(value) => setDocumentType(value ?? "")}
            placeholder={t("rules.choose_document_type")}
            options={documentTypeOptions.map((type) => ({
              value: type.value,
              label: t(`rules.document_types.${type.value}`),
            }))}
          />
        </label>
        <div className="grid gap-1 text-sm">
          <span>{t("rules.preview_item")}</span>
          <ItemLinkModel
            value={selectedItem}
            onValueChange={setSelectedItem}
            disabled={saving}
          />
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={preview}
            disabled={saving || previewRequest.processing}
          >
            {previewRequest.processing
              ? t("rules.previewing")
              : t("rules.preview")}
          </Button>
        </div>
        {previewError && <p role="alert">{previewError}</p>}
        {previewResult && (
          <output className="rounded-md bg-muted p-3" aria-live="polite">
            <span>
              {t("rules.preview_tax")}:{" "}
              {previewResult.tax_ids?.length
                ? previewResult.tax_ids
                    .map(
                      (id) =>
                        activeTaxes?.find(
                          (tax) => String(tax.id) === String(id),
                        )?.name ?? id,
                    )
                    .join(", ")
                : t("rules.no_tax")}
            </span>
            <span className="ml-4">
              {t("rules.preview_warehouse")}:{" "}
              {activeWarehouses?.find(
                (warehouse) =>
                  String(warehouse.id) === String(previewResult.warehouse_id),
              )?.name ??
                previewResult.warehouse_id ??
                t("rules.no_warehouse")}
            </span>
          </output>
        )}
      </section>
    </div>
  );
}
