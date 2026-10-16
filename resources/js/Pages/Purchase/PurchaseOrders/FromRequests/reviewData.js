import { buildDraftData } from "./draftData";

export function buildSubmissionDrafts(state, defaultDate) {
  return state.draftOrder.map((draftId) => {
    const { items, ...header } = buildDraftData(state, draftId, defaultDate);
    return {
      ...header,
      id: draftId,
      items: items.map((item) => ({
        id: item.id,
        source_item_id: item.source_item_id,
        item: item.item,
        unit: item.unit,
        quantity: item.quantity,
        rate: item.rate,
        description: item.description,
        required_date: item.required_date,
        target_warehouse: item.target_warehouse,
        tax: item.tax,
        tax_rate: item.tax_rate,
      })),
    };
  });
}

export function validateSubmissionDrafts(drafts) {
  const errors = {};
  if (!drafts.length) {
    errors.drafts = "At least one PO draft is required.";
  }
  drafts.forEach((draft, draftIndex) => {
    const prefix = `drafts.${draftIndex}.`;
    if (!draft.supplier?.id)
      errors[`${prefix}supplier`] = "Supplier is required.";
    const date = new Date(draft.date);
    const requiredDate = new Date(draft.required_date);
    if (Number.isNaN(date.getTime()))
      errors[`${prefix}date`] = "PO date is required.";
    if (Number.isNaN(requiredDate.getTime()) || requiredDate < date) {
      errors[`${prefix}required_date`] =
        "Required date must be on or after the PO date.";
    }
    if (!draft.items?.length)
      errors[`${prefix}items`] = "At least one item is required.";
    if (draft.discount_on) {
      if (
        !Number.isFinite(Number(draft.discount_rate)) ||
        draft.discount_rate === null ||
        Number(draft.discount_rate) < 0 ||
        Number(draft.discount_rate) > 100
      ) {
        errors[`${prefix}discount_rate`] =
          "Discount rate must be between 0 and 100.";
      }
      if (
        !Number.isFinite(Number(draft.discount_amount)) ||
        draft.discount_amount === null ||
        Number(draft.discount_amount) < 0
      ) {
        errors[`${prefix}discount_amount`] =
          "Discount amount must be zero or greater.";
      }
    }
    draft.payment_schedules?.forEach((schedule, scheduleIndex) => {
      const schedulePrefix = `${prefix}payment_schedules.${scheduleIndex}.`;
      if (!schedule.id)
        errors[`${schedulePrefix}id`] = "Payment schedule ID is required.";
      if (Number.isNaN(new Date(schedule.due_date).getTime()))
        errors[`${schedulePrefix}due_date`] = "Payment due date is required.";
      if (
        !Number.isFinite(Number(schedule.invoice_portion)) ||
        schedule.invoice_portion === null
      )
        errors[`${schedulePrefix}invoice_portion`] =
          "Invoice portion is required.";
      if (
        schedule.discount_type &&
        (schedule.discount === null ||
          !Number.isFinite(Number(schedule.discount)))
      )
        errors[`${schedulePrefix}discount`] = "Payment discount is required.";
      if (
        schedule.discount != null &&
        Number.isNaN(new Date(schedule.discount_date).getTime())
      )
        errors[`${schedulePrefix}discount_date`] =
          "Payment discount date is required.";
    });
    draft.items?.forEach((item, itemIndex) => {
      const itemPrefix = `${prefix}items.${itemIndex}.`;
      if (!item.source_item_id || !item.item?.id || !item.unit?.id) {
        errors[`${itemPrefix}source_item_id`] = "Source item is missing.";
      }
      if (!(Number(item.quantity) >= 1)) {
        errors[`${itemPrefix}quantity`] = "Quantity must be at least 1.";
      }
      if (!Number.isFinite(Number(item.rate)) || Number(item.rate) < 0) {
        errors[`${itemPrefix}rate`] = "Rate must be zero or greater.";
      }
      if (!item.target_warehouse?.id) {
        errors[`${itemPrefix}target_warehouse`] =
          "Target warehouse is required.";
      }
      const itemDate = new Date(item.required_date);
      if (Number.isNaN(itemDate.getTime()) || itemDate < date) {
        errors[`${itemPrefix}required_date`] =
          "Item date must be on or after the PO date.";
      }
    });
  });
  return errors;
}
