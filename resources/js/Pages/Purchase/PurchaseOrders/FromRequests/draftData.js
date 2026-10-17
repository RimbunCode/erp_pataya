const editableLineFields = [
  "description",
  "required_date",
  "target_warehouse",
  "tax",
  "tax_rate",
  "rate",
];

export function buildDraftData(state, draftId, defaultDate) {
  const draft = state.draftsById[draftId];
  if (!draft) {
    throw new RangeError("Draft not found");
  }

  const data = draft.data ?? {};
  const date = data.date ?? defaultDate;
  const requiredDate = data.required_date ?? date;
  const items = Object.values(state.allocationsById)
    .filter((allocation) => allocation.draft_id === draftId)
    .map((allocation) => {
      const source = state.sourcesById[allocation.purchase_request_item_id];
      const line = allocation.data ?? {};
      return {
        id: allocation.id,
        source_item_id: source.id,
        purchase_request_id: source.purchase_request_id,
        purchase_request_code: source.purchase_request_code,
        item: source.item,
        unit: Object.hasOwn(allocation, "unit") ? allocation.unit : source.unit,
        quantity: allocation.quantity,
        description: line.description ?? source.description ?? "",
        required_date:
          line.required_date && new Date(line.required_date) >= new Date(date)
            ? line.required_date
            : requiredDate,
        target_warehouse:
          line.target_warehouse ?? data.target_warehouse ?? null,
        tax: line.tax ?? null,
        tax_rate: line.tax_rate ?? line.tax?.rate ?? 0,
        rate: line.rate ?? 0,
      };
    });

  return {
    ...data,
    date,
    required_date: requiredDate,
    supplier: data.supplier ?? { id: draft.supplier_id },
    items,
  };
}

export function applyDraftData(state, draftId, nextData) {
  const draft = state.draftsById[draftId];
  if (!draft) {
    throw new RangeError("Draft not found");
  }

  const { items = [], ...header } = nextData;
  const rowsById = new Map(items.map((item) => [item.id, item]));
  const allocationsById = { ...state.allocationsById };

  for (const allocation of Object.values(state.allocationsById)) {
    if (allocation.draft_id !== draftId) {
      continue;
    }
    const row = rowsById.get(allocation.id);
    if (!row) {
      continue;
    }
    const line = { ...allocation.data };
    for (const field of editableLineFields) {
      if (Object.hasOwn(row, field)) {
        line[field] = row[field];
      }
    }
    const quantity =
      row.quantity === null || row.quantity === ""
        ? row.quantity
        : Number(row.quantity);
    allocationsById[allocation.id] = {
      ...allocation,
      unit: Object.hasOwn(row, "unit") ? row.unit : allocation.unit,
      quantity:
        quantity === null || quantity === "" || Number.isFinite(quantity)
          ? quantity
          : allocation.quantity,
      data: line,
    };
  }

  return {
    ...state,
    draftsById: {
      ...state.draftsById,
      [draftId]: {
        ...draft,
        data: {
          ...header,
          supplier: draft.data?.supplier ?? { id: draft.supplier_id },
        },
      },
    },
    allocationsById,
  };
}
