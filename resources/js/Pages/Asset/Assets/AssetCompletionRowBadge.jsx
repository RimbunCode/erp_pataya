import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import CompleteDataDialog from "./CompleteDataDialog";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useState } from "react";

/**
 * Badge "Perlu Dilengkapi" + tombol buka CompleteDataDialog, ditempel pada
 * baris item PurchaseReceipt/PurchaseInvoice yang sourceItemId-nya cocok
 * dengan Asset auto-created (Requirement 6.1: indikator per baris item).
 * @param root0
 * @param root0.fixedAssets
 * @param root0.sourceItemId
 * @param root0.sourceItemIdKey
 * @param root0.sourceDocumentType
 * @param root0.sourceDocumentId
 */
export default function AssetCompletionRowBadge({
  fixedAssets,
  sourceItemId,
  sourceItemIdKey,
  sourceDocumentType,
  sourceDocumentId,
}) {
  const { t } = useLaravelReactI18n();
  const [openAssetId, setOpenAssetId] = useState(null);

  const asset = (fixedAssets ?? []).find(
    (a) => a[sourceItemIdKey] === sourceItemId,
  );

  if (!asset || (asset.asset_category_id && asset.asset_location_id)) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <Badge variant="outline" className="text-xs">
        {t("asset.asset.needs_completion")}
      </Badge>
      <Button
        size="sm"
        variant="link"
        className="h-auto p-0 text-xs"
        onClick={() => setOpenAssetId(asset.id)}
      >
        {t("asset.asset.complete_now")}
      </Button>
      {openAssetId === asset.id && (
        <CompleteDataDialog
          asset={asset}
          open={true}
          onOpenChange={(open) => {
            if (!open) setOpenAssetId(null);
          }}
          sourceDocumentType={sourceDocumentType}
          sourceDocumentId={sourceDocumentId}
        />
      )}
    </span>
  );
}
