import { calculateArray } from "@/lib/utils";
import { allocateDiscount } from "@/lib/discountAllocation";

export function calculatePurchaseOrderAmounts(data) {
  const rawLines = (data.items ?? [])
    .filter((item) => item?.item)
    .map((item) => ({
      basic_amount: (item.quantity ?? 0) * (item.rate ?? 0),
      tax_rate: item.tax?.rate ?? 0,
    }));
  const rawNetAmount = calculateArray(rawLines, "basic_amount", "+");
  const rawTaxAmount = rawLines.reduce(
    (sum, line) => sum + (line.basic_amount * line.tax_rate) / 100,
    0,
  );
  const allocatedLines = allocateDiscount(
    rawLines,
    data.discount_on,
    data.discount_rate ?? 0,
    data.discount_amount ?? 0,
    data.latestDiscountKey ?? "discount_rate",
  );
  const net_amount = calculateArray(allocatedLines, "basic_amount", "+");
  const tax_amount = calculateArray(allocatedLines, "tax_amount", "+");
  return {
    rawNetAmount,
    rawTaxAmount,
    net_amount,
    tax_amount,
    amount: net_amount + tax_amount,
  };
}
