import React, { useEffect, useState } from "react";

import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Requirement 2 AC3/AC4 (spec asset-service-progress-workflow): breakdown
 * stok ready per gudang, hanya consumedItem is_stock_item=true. Komponen
 * BARU simple -- bukan reuse resources/js/Pages/Inventory/StockLedgers/
 * (daftar transaksi mentah, bukan ringkasan balance).
 */
export default function StockAvailabilityCard({ assetService }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [stocks, setStocks] = useState(null);

  useEffect(() => {
    fetch(route("assetServices.stockAvailability", assetService.id))
      .then((res) => res.json())
      .then(setStocks);
  }, [assetService.id]);

  if (stocks === null) {
    return (
      <p className="text-sm text-muted-foreground animate-pulse">
        {t("core.form.loading")}
      </p>
    );
  }

  if (stocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("asset.service.confirmWorkflow.no_stock_data")}
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="font-normal pb-2">
            {t("asset.service.columns.item")}
          </th>
          <th className="font-normal pb-2">
            {t("asset.service.confirmWorkflow.warehouse")}
          </th>
          <th className="font-normal pb-2 text-right">
            {t("asset.service.confirmWorkflow.ready_quantity")}
          </th>
        </tr>
      </thead>
      <tbody>
        {stocks.map((stock) => (
          <tr key={stock.id} className="border-t">
            <td className="py-1.5">{stock.item_variant?.item?.name}</td>
            <td className="py-1.5">{stock.warehouse?.name}</td>
            <td className="py-1.5 text-right">{stock.ready_quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
