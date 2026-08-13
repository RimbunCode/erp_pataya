import { Button } from "@/Components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/Components/ui/radio-group";
import AssetCategoryLinkModel from "../Categories/AssetCategoryLinkModel";
import AssetLocationLinkModel from "../Locations/AssetLocationLinkModel";
import FormTable from "@/Components/FormTable";
import NumberInput from "@/Components/NumberInput";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo, useState } from "react";

function SplitRowForm({ getColumn }) {
  return (
    <div className="flex flex-col gap-y-4">
      {getColumn("asset_category")}
      {getColumn("asset_location")}
      {getColumn("quantity")}
    </div>
  );
}

export default function CompleteDataDialog({ asset, open, onOpenChange }) {
  const { t } = useLaravelReactI18n();
  const [mode, setMode] = useState("single");
  const [category, setCategory] = useState(null);
  const [location, setLocation] = useState(null);
  const [defaultCategory, setDefaultCategory] = useState(null);
  const [defaultLocation, setDefaultLocation] = useState(null);
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const canSplit = (asset.asset_quantity ?? 1) > 1;

  const splitColumns = useMemo(
    () => [
      {
        name: "asset_category",
        titleTrans: "asset.asset.columns.asset_category_id",
        required: true,
        cell({ dataRow, setData, attributes }) {
          return (
            <AssetCategoryLinkModel
              value={dataRow.asset_category}
              onValueChange={(val) => setData("asset_category", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "asset_location",
        titleTrans: "asset.asset.columns.asset_location_id",
        required: true,
        cell({ dataRow, setData, attributes }) {
          return (
            <AssetLocationLinkModel
              value={dataRow.asset_location}
              onValueChange={(val) => setData("asset_location", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "asset.asset.split_rows_quantity",
        required: true,
        cell({ dataRow, setData, attributes }) {
          return (
            <NumberInput
              value={dataRow.quantity ?? ""}
              onValueChange={(val) => setData("quantity", val)}
              min={0.0001}
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );

  const rowsTotal = rows.reduce(
    (sum, row) => sum + (parseFloat(row.quantity) || 0),
    0,
  );
  const quantityMatches =
    Math.abs(rowsTotal - (asset.asset_quantity ?? 0)) < 0.0001;

  const canSubmit =
    mode === "single"
      ? !!category?.id && !!location?.id
      : rows.length > 0 &&
        quantityMatches &&
        rows.every((r) => r.asset_category?.id && r.asset_location?.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Kirim object relasi mentah (bukan extract .id manual) — konsisten pola
    // Form.jsx (Spec 1): FE selalu kirim object LinkModel utuh, backend
    // (CompleteAssetDataRequest::prepareForValidation) yang transform ke *_id.
    const payload =
      mode === "single"
        ? { mode: "single", asset_category: category, asset_location: location }
        : {
            mode: "split",
            rows: rows.map((row) => ({
              asset_category: row.asset_category,
              asset_location: row.asset_location,
              quantity: row.quantity,
            })),
          };

    router.put(route("assets.completeData", asset.id), payload, {
      onFinish: () => {
        setSubmitting(false);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("asset.asset.complete_data_title")}</DialogTitle>
          <DialogDescription>
            {t("asset.asset.complete_data_description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {canSplit && (
            <RadioGroup
              value={mode}
              onValueChange={setMode}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="single" id="mode-single" />
                <Label htmlFor="mode-single">
                  {t("asset.asset.split_mode_single")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="split" id="mode-split" />
                <Label htmlFor="mode-split">
                  {t("asset.asset.split_mode_split")}
                </Label>
              </div>
            </RadioGroup>
          )}

          {mode === "single" && (
            <>
              <div className="space-y-2">
                <Label>{t("asset.asset.columns.asset_category_id")}</Label>
                <AssetCategoryLinkModel
                  value={category}
                  onValueChange={setCategory}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("asset.asset.columns.asset_location_id")}</Label>
                <AssetLocationLinkModel
                  value={location}
                  onValueChange={setLocation}
                />
              </div>
            </>
          )}

          {mode === "split" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("asset.asset.default_category")}</Label>
                  <AssetCategoryLinkModel
                    value={defaultCategory}
                    onValueChange={(val) => {
                      setDefaultCategory(val);
                      if (val) {
                        setRows((prev) =>
                          prev.map((row) => ({
                            ...row,
                            asset_category: row.asset_category ?? val,
                          })),
                        );
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("asset.asset.default_category_hint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("asset.asset.default_location")}</Label>
                  <AssetLocationLinkModel
                    value={defaultLocation}
                    onValueChange={(val) => {
                      setDefaultLocation(val);
                      if (val) {
                        setRows((prev) =>
                          prev.map((row) => ({
                            ...row,
                            asset_location: row.asset_location ?? val,
                          })),
                        );
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("asset.asset.default_location_hint")}
                  </p>
                </div>
              </div>

              <FormTable
                name="AssetSplitRows"
                form={<SplitRowForm />}
                columns={splitColumns}
                value={rows}
                onValueChange={setRows}
                ignoreDisabled
                mapItem={({ item }) => ({
                  asset_category: item.asset_category ?? defaultCategory,
                  asset_location: item.asset_location ?? defaultLocation,
                  quantity: item.quantity,
                })}
              />

              <p
                className={
                  quantityMatches
                    ? "text-xs text-muted-foreground"
                    : "text-xs text-destructive"
                }
              >
                {t("asset.asset.split_rows_total_hint", {
                  expected: asset.asset_quantity,
                })}{" "}
                ({rowsTotal}/{asset.asset_quantity})
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("core.form.cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? t("core.form.saving") : t("core.form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
