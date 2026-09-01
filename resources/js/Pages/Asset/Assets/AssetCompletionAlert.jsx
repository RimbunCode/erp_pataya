import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useState } from "react";
import CompleteDataDialog from "./CompleteDataDialog";

/**
 * Menampilkan status Asset auto-created dari dokumen Purchase.
 * Props: assets = array of { id, asset_name, code, asset_quantity, asset_category_id, asset_location_id }
 * @param root0
 * @param root0.assets
 * @param root0.sourceDocumentType
 * @param root0.sourceDocumentId
 */
export default function AssetCompletionAlert({
  assets,
  sourceDocumentType,
  sourceDocumentId,
}) {
  const { t } = useLaravelReactI18n();
  const [openAssetId, setOpenAssetId] = useState(null);

  if (!assets || assets.length === 0) {
    return null;
  }

  const incomplete = assets.filter(
    (a) => !a.asset_category_id || !a.asset_location_id,
  );
  const complete = assets.filter(
    (a) => a.asset_category_id && a.asset_location_id,
  );

  return (
    <div className="space-y-2 mb-4">
      {incomplete.length > 0 && (
        <Alert
          variant="destructive"
          className="border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {t("asset.asset.incomplete_assets_title", {
              count: incomplete.length,
            })}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {incomplete.map((asset) => (
                <li key={asset.id} className="flex items-center gap-2">
                  <span>
                    {asset.asset_name} ({asset.code})
                  </span>
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
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {complete.length > 0 && (
        <Alert className="border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>
            {t("asset.asset.complete_assets_title", { count: complete.length })}
          </AlertTitle>
        </Alert>
      )}
    </div>
  );
}
