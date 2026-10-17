function sourceItems(sources) {
  return sources.flatMap((source) => {
    if (!Array.isArray(source.items)) {
      return [source];
    }
    return source.items.map((item) => ({
      ...item,
      purchase_request_id: source.id,
      purchase_request_code: source.code,
      purchase_request: {
        id: source.id,
        code: source.code,
        external_note: source.external_note,
      },
    }));
  });
}

function supplierId(supplier) {
  return supplier != null && typeof supplier === "object"
    ? supplier.id
    : supplier;
}

function sameSupplier(first, second) {
  return first != null && second != null && String(first) === String(second);
}

function allocationFor(state, id) {
  const allocation = state.allocationsById[id];
  if (!allocation) {
    throw new RangeError("Allocation not found");
  }
  return allocation;
}

function quantityValue(quantity) {
  if (quantity === null || quantity === "" || typeof quantity === "boolean") {
    throw new RangeError("Quantity must be a finite nonnegative number");
  }
  const value = Number(quantity);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("Quantity must be a finite nonnegative number");
  }
  return value;
}

function clearConfirmation(state) {
  return { ...state, confirmationRequired: false, pendingChange: null };
}

export function createInitialState(sources) {
  const state = {
    sourcesById: {},
    allocationsById: {},
    draftsById: {},
    draftOrder: [],
    activeDraftId: null,
    nextAllocationId: 1,
    nextDraftId: 1,
    confirmationRequired: false,
    pendingChange: null,
  };
  for (const source of sourceItems(sources)) {
    if (
      !(Number(source.unordered_quantity) > 0) ||
      state.sourcesById[source.id]
    ) {
      continue;
    }
    state.sourcesById[source.id] = structuredClone(source);
    const id = `allocation-${state.nextAllocationId++}`;
    state.allocationsById[id] = {
      id,
      purchase_request_item_id: source.id,
      quantity: Number(source.unordered_quantity),
      unit: structuredClone(source.unit),
      supplier_id: null,
      draft_id: null,
      data: structuredClone(source),
    };
  }
  return state;
}

export function setAllocationQuantity(state, id, quantity) {
  const allocation = allocationFor(state, id);
  return {
    ...clearConfirmation(state),
    allocationsById: {
      ...state.allocationsById,
      [id]: { ...allocation, quantity: quantityValue(quantity) },
    },
  };
}

export function setAllocationUnit(state, id, unit) {
  const allocation = allocationFor(state, id);
  if (
    unit !== null &&
    (!unit?.id || !(Number(unit.conversion_factor ?? 1) > 0))
  ) {
    throw new RangeError(
      "Allocation unit must have a positive conversion factor",
    );
  }
  const source = state.sourcesById[allocation.purchase_request_item_id];
  if (
    unit?.item_id &&
    source.item?.item_id &&
    String(unit.item_id) !== String(source.item.item_id)
  ) {
    throw new RangeError("Allocation unit must belong to the source item");
  }
  return {
    ...clearConfirmation(state),
    allocationsById: {
      ...state.allocationsById,
      [id]: { ...allocation, unit: structuredClone(unit) },
    },
  };
}

export function addAllocation(
  state,
  sourceItemId,
  { quantity = 0, supplier = null, draftId = null } = {},
) {
  const source = state.sourcesById[sourceItemId];
  const target = draftId === null ? null : state.draftsById[draftId];
  const selectedSupplierId = supplierId(supplier);
  if (!source || (draftId !== null && !target)) {
    throw new RangeError("Source item and target draft must exist");
  }
  if (
    target &&
    selectedSupplierId != null &&
    !sameSupplier(target.supplier_id, selectedSupplierId)
  ) {
    throw new RangeError("Supplier must match the target draft");
  }
  const nextQuantity = quantityValue(quantity);
  let sequence = state.nextAllocationId;
  while (state.allocationsById[`allocation-${sequence}`]) {
    sequence++;
  }
  const id = `allocation-${sequence}`;
  return reconcileDrafts({
    ...clearConfirmation(state),
    nextAllocationId: sequence + 1,
    allocationsById: {
      ...state.allocationsById,
      [id]: {
        id,
        purchase_request_item_id: sourceItemId,
        quantity: nextQuantity,
        unit: structuredClone(source.unit),
        supplier_id: target ? target.supplier_id : selectedSupplierId,
        draft_id: draftId,
        data: structuredClone(source),
      },
    },
  });
}

export function removeAllocation(state, id, { confirmed = false } = {}) {
  allocationFor(state, id);
  const allocationsById = { ...state.allocationsById };
  delete allocationsById[id];
  const next = reconcileDrafts(
    { ...clearConfirmation(state), allocationsById },
    { confirmed },
  );
  if (next.confirmationRequired) {
    return {
      ...state,
      confirmationRequired: true,
      pendingChange: {
        ...next.pendingChange,
        type: "removeAllocation",
        allocationId: id,
      },
    };
  }
  return next;
}

export function splitDraft(state, draftId, allocationIds) {
  const draft = state.draftsById[draftId];
  const currentIds = Object.values(state.allocationsById)
    .filter((allocation) => allocation.draft_id === draftId)
    .map((allocation) => allocation.id);
  if (
    !draft ||
    !Array.isArray(allocationIds) ||
    allocationIds.length === 0 ||
    allocationIds.length >= currentIds.length ||
    new Set(allocationIds).size !== allocationIds.length ||
    allocationIds.some((id) => !currentIds.includes(id))
  ) {
    throw new RangeError(
      "Select a nonempty proper subset of allocations in the source draft",
    );
  }
  let sequence = state.nextDraftId;
  while (state.draftsById[`draft-${sequence}`]) {
    sequence++;
  }
  const id = `draft-${sequence}`;
  const selectedIds = new Set(allocationIds);
  return {
    ...clearConfirmation(state),
    nextDraftId: sequence + 1,
    draftsById: {
      ...state.draftsById,
      [id]: { ...structuredClone(draft), id },
    },
    draftOrder: [...state.draftOrder, id],
    activeDraftId: id,
    allocationsById: Object.fromEntries(
      Object.values(state.allocationsById).map((allocation) => [
        allocation.id,
        selectedIds.has(allocation.id)
          ? { ...allocation, draft_id: id }
          : allocation,
      ]),
    ),
  };
}

export function splitAllocation(state, id, splitQuantity) {
  const allocation = allocationFor(state, id);
  const quantity = quantityValue(splitQuantity);
  if (quantity <= 0 || quantity >= allocation.quantity) {
    throw new RangeError(
      "Split quantity must be positive and less than the original quantity",
    );
  }
  let sequence = state.nextAllocationId;
  while (state.allocationsById[`allocation-${sequence}`]) {
    sequence++;
  }
  const splitId = `allocation-${sequence}`;
  return {
    ...clearConfirmation(state),
    nextAllocationId: sequence + 1,
    allocationsById: {
      ...state.allocationsById,
      [id]: { ...allocation, quantity: allocation.quantity - quantity },
      [splitId]: { ...structuredClone(allocation), id: splitId, quantity },
    },
  };
}

export function moveAllocation(state, id, draftId) {
  const allocation = allocationFor(state, id);
  const draft = state.draftsById[draftId];
  if (!draft) {
    throw new RangeError("Target draft not found");
  }
  return reconcileDrafts(
    {
      ...clearConfirmation(state),
      allocationsById: {
        ...state.allocationsById,
        [id]: {
          ...allocation,
          draft_id: draftId,
          supplier_id: draft.supplier_id,
        },
      },
    },
    { confirmed: true },
  );
}

export function changeDraftSupplier(
  state,
  draftId,
  supplier,
  { confirmed = false } = {},
) {
  const draft = state.draftsById[draftId];
  const nextSupplierId = supplierId(supplier);
  if (!draft || nextSupplierId == null) {
    throw new RangeError("Draft and supplier are required");
  }
  if (sameSupplier(draft.supplier_id, nextSupplierId)) {
    return state;
  }
  if (!confirmed) {
    return {
      ...state,
      confirmationRequired: true,
      pendingChange: {
        type: "changeDraftSupplier",
        draftId,
        supplier,
        allocationIds: Object.values(state.allocationsById)
          .filter((allocation) => allocation.draft_id === draftId)
          .map((allocation) => allocation.id),
      },
    };
  }
  return {
    ...clearConfirmation(state),
    draftsById: {
      ...state.draftsById,
      [draftId]: {
        ...draft,
        supplier_id: nextSupplierId,
        data: { ...draft.data, supplier },
      },
    },
    allocationsById: Object.fromEntries(
      Object.values(state.allocationsById).map((allocation) => [
        allocation.id,
        allocation.draft_id === draftId
          ? { ...allocation, supplier_id: nextSupplierId }
          : allocation,
      ]),
    ),
  };
}

export function reconcileDrafts(state, { confirmed = false } = {}) {
  const allocationsById = { ...state.allocationsById };
  const draftsById = { ...state.draftsById };
  let draftOrder = state.draftOrder.filter((id) => draftsById[id]);
  let nextDraftId = state.nextDraftId;
  const affectedDraftIds = new Set();

  for (const allocation of Object.values(allocationsById)) {
    const current = draftsById[allocation.draft_id];
    if (current && sameSupplier(current.supplier_id, allocation.supplier_id)) {
      continue;
    }
    if (
      current &&
      Object.entries(current.data ?? {}).some(
        ([key, value]) => key !== "supplier" && value != null && value !== "",
      )
    ) {
      affectedDraftIds.add(current.id);
    }
    if (allocation.supplier_id == null) {
      allocationsById[allocation.id] = { ...allocation, draft_id: null };
      continue;
    }
    let targetId = draftOrder.find((id) =>
      sameSupplier(draftsById[id].supplier_id, allocation.supplier_id),
    );
    if (!targetId) {
      while (draftsById[`draft-${nextDraftId}`]) {
        nextDraftId++;
      }
      targetId = `draft-${nextDraftId++}`;
      draftsById[targetId] = {
        id: targetId,
        supplier_id: allocation.supplier_id,
        data: { supplier: { id: allocation.supplier_id } },
      };
      draftOrder.push(targetId);
    }
    allocationsById[allocation.id] = { ...allocation, draft_id: targetId };
  }

  const usedDraftIds = new Set(
    Object.values(allocationsById).map((allocation) => allocation.draft_id),
  );
  const removedDraftIds = draftOrder.filter((id) => !usedDraftIds.has(id));
  for (const id of removedDraftIds) {
    const draftData = draftsById[id].data ?? {};
    if (
      Object.entries(draftData).some(
        ([key, value]) => key !== "supplier" && value != null && value !== "",
      )
    ) {
      affectedDraftIds.add(id);
    }
  }
  if (affectedDraftIds.size && !confirmed) {
    return {
      ...state,
      confirmationRequired: true,
      pendingChange: {
        type: "reconcileDrafts",
        affectedDraftIds: [...affectedDraftIds],
        removedDraftIds,
      },
    };
  }
  for (const id of removedDraftIds) {
    delete draftsById[id];
  }
  draftOrder = draftOrder.filter((id) => usedDraftIds.has(id));
  return {
    ...clearConfirmation(state),
    allocationsById,
    draftsById,
    draftOrder,
    nextDraftId,
    activeDraftId: draftOrder.includes(state.activeDraftId)
      ? state.activeDraftId
      : (draftOrder[0] ?? null),
  };
}

export function getQuantityWarnings(state, sources) {
  const totals = {};
  for (const allocation of Object.values(state.allocationsById)) {
    const sourceId = allocation.purchase_request_item_id;
    const source = state.sourcesById[sourceId];
    const sourceFactor = Number(
      source?.conversion_factor ?? source?.unit?.conversion_factor ?? 1,
    );
    const allocationFactor = Number(
      allocation.unit?.conversion_factor ?? sourceFactor,
    );
    totals[sourceId] =
      (totals[sourceId] ?? 0) +
      (Number(allocation.quantity) * allocationFactor) / sourceFactor;
  }
  const currentSources = sources
    ? sourceItems(sources)
    : Object.values(state.sourcesById);
  const warnings = [];
  const seen = new Set();
  for (const source of currentSources) {
    if (!state.sourcesById[source.id] || seen.has(source.id)) {
      continue;
    }
    seen.add(source.id);
    const allocated = totals[source.id] ?? 0;
    const required = Number(source.unordered_quantity);
    const difference = allocated - required;
    const tolerance =
      Number.EPSILON * Math.max(1, Math.abs(allocated), Math.abs(required)) * 8;
    if (Math.abs(difference) <= tolerance) {
      continue;
    }
    warnings.push({
      purchase_request_item_id: source.id,
      allocated_quantity: allocated,
      unordered_quantity: required,
      difference,
      direction: difference > 0 ? "over" : "under",
    });
  }
  return warnings;
}

export function formatWarningQuantity(value) {
  return Number(Number(value).toFixed(4));
}
