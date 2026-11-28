import { generateRandom } from "@/lib/utils";
import { useFormPage } from "@/Pages/Core/FormPage";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

const SOURCE_ROW_KEYS = [
  "referenceable_id",
  "purchase_order_item",
  "purchase_order_item_id",
  "purchase_receipt_item",
  "purchase_receipt_item_id",
  "sales_order_item",
  "sales_order_item_id",
  "return_against_item_id",
];

const RESOLUTION_TIMEOUT_MS = 10000;

export const EMPTY_DEFAULTS = Object.freeze({});

/**
 * Galat pajak satu baris item: `items.{i}.taxes` (pajak majemuk: duplikat, lebih dari satu PPN, lebih dari batas,
 * wajib tapi kosong), `items.{i}.taxes.{j}` / `.id` (pajak tanpa versi aturan), atau bentuk satu pajak lama
 * (`items.{i}.tax`, `items.{i}.tax.id`).
 * @param {object|undefined} errors galat validasi server (kunci bertitik)
 * @param {number} index indeks baris
 * @returns {string|null}
 */
export function taxRowError(errors, index) {
  const prefix = `items.${index}.`;
  const direct =
    errors?.[`${prefix}taxes`] ??
    errors?.[`${prefix}tax.id`] ??
    errors?.[`${prefix}tax`];
  if (direct) return direct;
  const nested = Object.keys(errors ?? {}).find((key) =>
    key.startsWith(`${prefix}taxes.`),
  );

  return nested ? errors[nested] : null;
}

/**
 * Daftar pajak default: `taxes` bila terisi, selain itu `tax` tunggal (default saat ini 0/1 pajak).
 * @param {{tax?: object|null, taxes?: object[]}|null|undefined} source
 * @returns {object[]}
 */
export function defaultTaxesOf(source) {
  if (Array.isArray(source?.taxes) && source.taxes.length > 0) {
    return source.taxes;
  }

  return source?.tax ? [source.tax] : [];
}

function lineTaxesOf(line) {
  return defaultTaxesOf(line);
}

function sameTaxList(first, second) {
  return (
    first.length === second.length &&
    first.every((tax, index) => sameRecord(tax, second[index]))
  );
}

/**
 * Tambalan data baris untuk daftar pajak (mode pajak majemuk): `taxes` = daftar, `tax` = Pajak Utama (elemen
 * pertama, cermin), `tax_rate` ikut Pajak Utama bila `withRate`.
 * @param {object[]} taxes
 * @param {boolean} [withRate]
 * @returns {{taxes: object[], tax: object|null, tax_rate?: number}}
 */
export function taxPatch(taxes, withRate = true) {
  const list = taxes ?? [];

  return {
    taxes: list,
    tax: list[0] ?? null,
    ...(withRate ? { tax_rate: list[0]?.rate ?? 0 } : {}),
  };
}

export function documentItemId(item) {
  return item?.item?.id ?? item?.item_id ?? item?.id ?? null;
}

export function applyToNewLine(
  line,
  item,
  defaults,
  {
    warehouseField,
    skipTaxDefault = false,
    skipWarehouseDefault = false,
    isFieldEdited = () => false,
    multiTax = false,
  } = {},
) {
  if (SOURCE_ROW_KEYS.some((key) => line?.[key]) || line?.referenceable?.id) {
    return line;
  }

  const nextLine = { ...line };
  if (multiTax) {
    // Pajak majemuk (form invoice): default berupa daftar, baris dianggap sudah berpajak bila punya >= 1 pajak.
    const defaultTaxes = defaultTaxesOf(defaults);
    if (
      !skipTaxDefault &&
      !isFieldEdited(line?.id, "tax") &&
      lineTaxesOf(nextLine).length === 0 &&
      defaultTaxes.length > 0
    ) {
      Object.assign(nextLine, taxPatch(defaultTaxes));
    }
  } else if (
    !skipTaxDefault &&
    !isFieldEdited(line?.id, "tax") &&
    !nextLine.tax &&
    defaults?.tax
  ) {
    nextLine.tax = defaults.tax;
    nextLine.tax_rate = defaults.tax.rate ?? 0;
  }
  if (
    warehouseField &&
    !skipWarehouseDefault &&
    !isFieldEdited(line?.id, warehouseField) &&
    item?.is_stock_item &&
    !nextLine[warehouseField] &&
    defaults?.warehouse
  ) {
    nextLine[warehouseField] = defaults.warehouse;
  }

  return nextLine;
}

function sameRecord(first, second) {
  return (
    first?.id != null &&
    second?.id != null &&
    String(first.id) === String(second.id)
  );
}

export function applyResolvedToNewLine(
  line,
  item,
  resolvedDefaults,
  moduleDefaults,
  { warehouseField, isFieldEdited = () => false, multiTax = false } = {},
) {
  if (SOURCE_ROW_KEYS.some((key) => line?.[key]) || line?.referenceable?.id) {
    return line;
  }
  const requestedItemId = documentItemId(item);
  const currentItemId = documentItemId(line?.item);
  if (
    requestedItemId != null &&
    String(requestedItemId) !== String(currentItemId ?? "")
  ) {
    return line;
  }

  const nextLine = { ...line };
  const rowId = line?.id;
  if (multiTax) {
    const current = lineTaxesOf(line);
    const canApplyTaxes =
      !isFieldEdited(rowId, "tax") &&
      (current.length === 0 ||
        sameTaxList(current, defaultTaxesOf(moduleDefaults)));

    if (canApplyTaxes) {
      Object.assign(nextLine, taxPatch(defaultTaxesOf(resolvedDefaults)));
    }
  } else {
    const canApplyTax =
      !isFieldEdited(rowId, "tax") &&
      (!line?.tax || sameRecord(line.tax, moduleDefaults?.tax));

    if (canApplyTax) {
      nextLine.tax = resolvedDefaults?.tax ?? null;
      nextLine.tax_rate = nextLine.tax?.rate ?? 0;
    }
  }

  const canApplyWarehouse =
    warehouseField &&
    item?.is_stock_item &&
    !isFieldEdited(rowId, warehouseField) &&
    (!line?.[warehouseField] ||
      sameRecord(line[warehouseField], moduleDefaults?.warehouse));

  if (canApplyWarehouse) {
    nextLine[warehouseField] = resolvedDefaults?.warehouse ?? null;
  }

  return nextLine;
}

export function paymentTemplateToSchedule(template, date) {
  return (template?.items ?? []).map((item) => {
    const dueDate = new Date(date);
    switch (item?.due_date_based_on) {
      case "days_after_invoice_date":
        dueDate.setDate(dueDate.getDate() + (item?.credit_period ?? 0));
        break;
      case "weeks_after_invoice_week":
        dueDate.setDate(dueDate.getDate() + (item?.credit_period ?? 0) * 7);
        break;
      case "months_after_invoice_month":
        dueDate.setMonth(dueDate.getMonth() + (item?.credit_period ?? 0));
        break;
    }

    return {
      id: generateRandom(5),
      due_date: dueDate,
      invoice_portion: item?.invoice_portion,
      discount_type: item?.discount_type,
      discount_date: item?.discount_type ? dueDate : undefined,
      discount: item?.discount,
      payment_method: item?.payment_method,
    };
  });
}

export function useDocumentDefaults(
  defaults,
  documentType,
  { items, setData, multiTax = false } = {},
) {
  const pendingResolutions = useRef(new Map());
  const activeBatches = useRef(new Set());
  const flushTimer = useRef(null);
  const editedFields = useRef(new Set());
  const lineResolutions = useRef(new Map());
  const taxOptionalRows = useRef(new Map());
  const currentItems = useRef(items);
  currentItems.current = items;
  const [resolutionVersion, setResolutionVersion] = useState(0);
  const { registerBeforeSubmit } = useFormPage() ?? {};

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      pendingResolutions.current.forEach((resolvers) =>
        resolvers.forEach((resolve) => resolve(defaults ?? {})),
      );
      pendingResolutions.current.clear();
      activeBatches.current.forEach((cancel) => cancel());
      lineResolutions.current.forEach((request) => request.resolveApplied?.());
      lineResolutions.current.clear();
    };
  }, []);

  const resolveForItem = useCallback(
    (itemId) => {
      if (!itemId || !documentType) {
        return Promise.resolve(defaults ?? {});
      }

      return new Promise((resolve) => {
        const requests = pendingResolutions.current;
        const itemRequests = requests.get(String(itemId)) ?? [];
        itemRequests.push(resolve);
        requests.set(String(itemId), itemRequests);

        if (flushTimer.current) return;
        flushTimer.current = setTimeout(async () => {
          flushTimer.current = null;
          const batch = pendingResolutions.current;
          pendingResolutions.current = new Map();
          const itemIds = [...batch.keys()];
          const controller = new AbortController();
          let settled = false;
          const finish = (results) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            activeBatches.current.delete(cancel);
            batch.forEach((resolvers, id) =>
              resolvers.forEach((resolveItem) =>
                resolveItem(results?.get(id) ?? defaults ?? {}),
              ),
            );
          };
          const cancel = () => {
            finish();
            controller.abort();
          };
          const timeout = setTimeout(cancel, RESOLUTION_TIMEOUT_MS);
          activeBatches.current.add(cancel);

          try {
            const response = await axios.post(
              "/defaults/resolve",
              {
                document_type: documentType,
                items: itemIds.map((id) => ({ item_id: id })),
              },
              { signal: controller.signal },
            );
            if (settled) return;
            const resolvedItems =
              response?.data?.items ??
              response?.data?.data?.items ??
              response?.data?.data ??
              response?.data ??
              {};
            const warehouseIds = [
              ...new Set(
                itemIds
                  .map((id) =>
                    resolvedItems[id]?.warehouse
                      ? null
                      : resolvedItems[id]?.warehouse_id,
                  )
                  .filter(Boolean)
                  .map(String),
              ),
            ];
            const fetchRecords = async (model, ids) => {
              if (!ids.length) return new Map();
              try {
                const modelResponse = await axios.post(
                  typeof window !== "undefined" &&
                    typeof window.route === "function"
                    ? window.route("model")
                    : "/model",
                  { model, filters: { id: { in: ids } } },
                  { signal: controller.signal },
                );
                const records = modelResponse?.data?.data ?? [];
                return new Map(
                  records.map((record) => [String(record.id), record]),
                );
              } catch {
                return new Map();
              }
            };
            const warehouseRecords = await fetchRecords(
              "App\\Models\\Inventory\\Warehouse",
              warehouseIds,
            );
            if (settled) return;

            const results = new Map();
            itemIds.forEach((id) => {
              const result = resolvedItems[id];
              if (!result) {
                return;
              }
              const warehouseId = result.warehouse_id ?? null;
              const resolvedDefaults = {
                tax: result.taxes?.[0] ?? null,
                taxes: result.taxes ?? [],
                taxOptional: !!result.tax_optional,
                warehouse:
                  warehouseId == null
                    ? null
                    : (result.warehouse ??
                      (String(defaults?.warehouse?.id) === String(warehouseId)
                        ? defaults.warehouse
                        : (warehouseRecords.get(String(warehouseId)) ??
                          defaults?.warehouse ??
                          null))),
              };

              results.set(id, resolvedDefaults);
            });
            finish(results);
          } catch {
            finish();
          }
        }, 0);
      });
    },
    [defaults, documentType],
  );

  const applyLineDefaults = useCallback(
    (line, item, options) =>
      applyToNewLine(line, item, defaults, {
        multiTax,
        ...options,
        isFieldEdited: (rowId, field) =>
          editedFields.current.has(`${rowId}:${field}`),
      }),
    [defaults, multiTax],
  );
  const markFieldEdited = useCallback((rowId, field) => {
    if (rowId != null && field) {
      editedFields.current.add(`${rowId}:${field}`);
    }
  }, []);
  const isFieldEdited = useCallback(
    (rowId, field) => editedFields.current.has(`${rowId}:${field}`),
    [],
  );
  const resolveForNewLine = useCallback(
    (rowId, item, { warehouseField, onResolved } = {}) => {
      if (rowId == null) return;
      const rowKey = String(rowId);
      lineResolutions.current.get(rowKey)?.resolveApplied?.();
      taxOptionalRows.current.delete(rowKey);
      const lineBeforeSelection = items?.find(
        (line) => String(line.id) === rowKey,
      );
      const request = {
        item,
        warehouseField,
        lineBeforeSelection,
        hasBeenPresent: !!lineBeforeSelection,
        sawRequestedItem: false,
        resolved: false,
        applied: false,
      };
      request.completion = new Promise((resolve) => {
        request.resolveApplied = () => {
          clearTimeout(request.propagationTimer);
          resolve();
        };
      });
      lineResolutions.current.set(rowKey, request);
      request.propagationTimer = setTimeout(() => {
        if (
          lineResolutions.current.get(rowKey) === request &&
          !(currentItems.current ?? []).some(
            (line) => String(line.id) === rowKey,
          )
        ) {
          request.resolveApplied();
          lineResolutions.current.delete(rowKey);
        }
      }, RESOLUTION_TIMEOUT_MS);
      const itemId = documentItemId(item);
      if (!documentType || !itemId) {
        request.applied = true;
        request.resolveApplied();
        return;
      }
      return resolveForItem(itemId).then((resolvedDefaults) => {
        if (lineResolutions.current.get(rowKey) !== request) {
          request.resolveApplied();
          return;
        }
        request.resolvedDefaults = resolvedDefaults;
        request.resolved = true;
        if (typeof resolvedDefaults?.taxOptional === "boolean") {
          taxOptionalRows.current.set(rowKey, resolvedDefaults.taxOptional);
        }
        onResolved?.();
        setResolutionVersion((version) => version + 1);
      });
    },
    [documentType, items, resolveForItem],
  );

  useEffect(() => {
    if (!setData) return;
    const rowsById = new Map(
      (items ?? []).map((line) => [String(line.id), line]),
    );
    const ready = new Map();
    lineResolutions.current.forEach((request, rowKey) => {
      const line = rowsById.get(rowKey);
      const itemMatches =
        line &&
        String(documentItemId(line.item)) ===
          String(documentItemId(request.item));
      if (
        (!line && request.hasBeenPresent) ||
        (line &&
          line !== request.lineBeforeSelection &&
          (line.asset ||
            line.asset_id ||
            SOURCE_ROW_KEYS.some((key) => line[key]) ||
            line.referenceable?.id ||
            (request.sawRequestedItem && !itemMatches)))
      ) {
        request.resolveApplied();
        lineResolutions.current.delete(rowKey);
        return;
      }
      if (!line) return;
      request.hasBeenPresent = true;
      if (line !== request.lineBeforeSelection && itemMatches) {
        request.sawRequestedItem = true;
        if (request.resolved && !request.applied) ready.set(rowKey, request);
      }
    });
    if (!ready.size) return;
    setData((prev) => {
      const nextItems = (prev.items ?? []).map((line) => {
        const rowKey = String(line.id);
        const request = ready.get(rowKey);
        if (!request || lineResolutions.current.get(rowKey) !== request)
          return line;
        const nextLine = applyResolvedToNewLine(
          line,
          request.item,
          request.resolvedDefaults,
          defaults,
          {
            warehouseField: request.warehouseField,
            isFieldEdited,
            multiTax,
          },
        );
        request.applied = true;
        request.resolveApplied();
        return nextLine;
      });

      return { ...prev, items: nextItems };
    });
  }, [items, resolutionVersion, defaults, isFieldEdited, setData, multiTax]);

  // Berubah identitas setiap hasil resolusi masuk agar `itemColumns` ber-memo
  // ikut menghitung ulang penanda wajib pajak.
  const isTaxOptional = useCallback(
    (rowId) => taxOptionalRows.current.get(String(rowId)) === true,

    [resolutionVersion],
  );
  // Wajib hanya bila baris sudah di-resolve dan hasilnya `tax_optional: false`.
  // Baris yang tak pernah di-resolve (edit, dari dokumen sumber, Asset) atau
  // yang resolusinya gagal berstatus tidak diketahui: tidak boleh memblokir
  // submit di klien, server yang menegakkan.
  const isTaxRequired = useCallback(
    (rowId) => taxOptionalRows.current.get(String(rowId)) === false,

    [resolutionVersion],
  );

  const waitForPendingResolutions = useCallback(async () => {
    for (;;) {
      const activeRows = new Set(
        (currentItems.current ?? []).map((line) => String(line.id)),
      );
      const pending = [...lineResolutions.current.entries()]
        .filter(([, request]) => !request.applied)
        .map(([rowKey, request]) => {
          if (!activeRows.has(rowKey) && request.hasBeenPresent) {
            request.resolveApplied();
            lineResolutions.current.delete(rowKey);
            return null;
          }
          return request.completion;
        })
        .filter(Boolean);
      if (!pending.length) return;
      await Promise.all(pending);
    }
  }, []);

  useEffect(() => {
    if (!documentType || !registerBeforeSubmit) return;
    return registerBeforeSubmit(waitForPendingResolutions);
  }, [documentType, registerBeforeSubmit, waitForPendingResolutions]);
  const applyPaymentTerm = useCallback(
    (currentSchedules, date) =>
      currentSchedules?.length
        ? currentSchedules
        : paymentTemplateToSchedule(defaults?.payment_term_template, date),
    [defaults],
  );

  return {
    applyToNewLine: applyLineDefaults,
    applyPaymentTerm,
    resolveForItem,
    resolveForNewLine,
    waitForPendingResolutions,
    markFieldEdited,
    isFieldEdited,
    isTaxOptional,
    isTaxRequired,
  };
}
