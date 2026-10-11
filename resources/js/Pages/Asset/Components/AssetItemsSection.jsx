import {
  FormPageContent,
  FormPageContentDescription,
} from "@/Pages/Core/FormPage";

import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Section collapsible khusus transaksi aset di form SO, Sales Invoice, dan
 * Delivery Note (spec asset-items-section). Ditaruh tepat di atas section Items;
 * isinya FormTable Asset Items dari form pemanggil.
 *
 * `defaultOpen` di FormPageContent hanya dipakai sebagai state awal
 * (useState(defaultOpen)), jadi pemanggil mengirim `hasRows` dari `defaultData`
 * (kondisi awal dokumen), BUKAN dari state form yang berubah tiap ketikan --
 * pola yang sama dengan section catatan eksternal di DeliveryNotes/Form.jsx.
 * @param {object} props
 * @param {boolean} [props.hasRows] dokumen sudah punya baris aset saat dimuat
 * @param {React.ReactNode} props.children
 * @returns {React.JSX.Element}
 */
export default function AssetItemsSection({ hasRows = false, children }) {
  const { t } = useLaravelReactI18n();

  return (
    <FormPageContent
      value="detail"
      title={t("asset.assetItems.title")}
      collapsible
      defaultOpen={!!hasRows}
    >
      <FormPageContentDescription>
        {t("asset.assetItems.description")}
      </FormPageContentDescription>
      {children}
    </FormPageContent>
  );
}
