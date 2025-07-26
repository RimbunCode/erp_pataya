import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import { Mention, MentionsInput } from "@/Components/Mention";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { WhenVisible, usePage } from "@inertiajs/react";

import AttributeLinkModel from "../Attributes/AttributeLinkModel";
import { Checkbox } from "@/Components/ui/checkbox";
import CurrencyInput from "@/Components/CurrencyInput";
import FormBarcodes from "./FormBarcodes";
import FormDetail from "./FormDetail";
import FormInput from "@/Components/FormInput";
import FormStockLevels from "./FormStockLevels";
import FormTable from "@/Components/FormTable";
import Link from "@/Components/Link";
import LoadingIcon from "@/Components/LoadingIcon";
import MultiSelect from "@/Components/MultiSelect";
import UnitLinkModel from "../Units/UnitLinkModel";
import axios from "axios";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function Form() {
  const { data, setData } = useFormPage();
  const { item, variants } = usePage().props;
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const [formatVariantSelected, setFormatVariantSelected] = useState([]);
  const [listFormatVariant, setListFormatVariant] = useState([]);

  useEffect(() => {
    const list = [
      { id: "item", display: "Item Code" },
      ...(data?.variants?.map((x) => ({
        id: x.attribute?.id,
        display: x.attribute?.name,
      })) ?? []),
    ].filter(
      (x) =>
        !formatVariantSelected.some(
          (y) => y.display.replace(/^\{(.*?)\}$/g, "$1") == x.display,
        ),
    );
    setListFormatVariant(list);
  }, [data.variants, formatVariantSelected]);

  const getUnits = useCallback((group) => {
    axios
      .post(route("model"), {
        model: "App\\Models\\Inventory\\Unit",
        filters: {
          group: group,
        },
      })
      .then((res) => {
        setData(
          "uom",
          res.data.map((x) => ({
            ...x,
            readOnly: x.conversion_factor,
            isCustom: !x.conversion_factor,
          })),
        );
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);
  useDidMountEffect(() => {
    if (data.default_unit) {
      if (data.uom?.at(0)?.group == data.default_unit.group) return;
      getUnits(data.default_unit.group);
    } else {
      setData("uom", []);
    }
  }, [data.default_unit]);
  /**
   * @typedef {import('@/Components/FormTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const uomColumns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "inventory.unit.unit",
        required: true,
        cell({ dataRow, setData, attributes }) {
          return (
            <UnitLinkModel
              value={dataRow}
              {...attributes}
              filters={{
                group: data?.default_unit?.group,
                ...(dataRow.readOnly ? {} : { conversion_factor: null }),
              }}
              onValueChange={(value) => {
                // if (!value) return;
                setData(value);
              }}
            />
          );
        },
      },
      {
        name: "conversion_factor",
        titleTrans: "inventory.unit.columns.conversion_factor",
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <CurrencyInput
              {...attributes}
              disabled={!dataRow?.code}
              readOnly={dataRow.readOnly && !dataRow.isCustom}
              value={data}
              onValueChange={(value) => {
                setData("conversion_factor", value);
              }}
            />
          );
        },
      },
    ],
    [data.default_unit?.group],
  );
  /**
   * @type {ColumnProps[]}
   */
  const variantColumns = useMemo(
    () => [
      {
        name: "attribute",
        titleTrans: "inventory.item.columns.attribute",
        required: true,
        cell({ dataRow, attributes, setData }) {
          return (
            <AttributeLinkModel
              onValueChange={(val) => {
                setData("attribute", val);
              }}
              placeholder={t("inventory.item.columns.attribute.placeholder")}
              value={dataRow.attribute}
              {...attributes}
            />
          );
        },
      },
      {
        name: "values",
        titleTrans: "inventory.item.columns.attribute_values",
        required: true,
        cell({ dataRow, attributes, setData }) {
          return (
            <MultiSelect
              value={dataRow.values}
              onValueChange={(val) => {
                setData("values", val);
              }}
              options={dataRow.attribute?.values?.map((x) => {
                return { label: x.value, value: x.value };
              })}
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );
  return (
    <>
      <FormDetail data={data} setData={setData} />
      <FormPageContent
        title={t("inventory.item.menu.variants")}
        value="variants"
      >
        <FormTable
          columns={variantColumns}
          value={data.variants ?? []}
          onValueChange={(val) => {
            setData("variants", val);
          }}
        />
        {data?.variants && data?.variants?.length > 0 && (
          <FormInput
            className="max-w-sm mt-4"
            label={t("inventory.item.columns.format_variant")}
            required
            // description={}
          >
            <MentionsInput
              singleLine
              value={data?.format_variant ?? ""}
              onChange={(_, value, __, mentions) => {
                setFormatVariantSelected(mentions);
                setData("format_variant", value);
              }}
              className="mentions"
              placeholder={t(
                "inventory.item.columns.format_variant.placeholder",
              )}
              a11ySuggestionsListLabel={"Suggested mentions"}
              allowSuggestionsAboveCursor
              autoComplete="off"
            >
              <Mention
                trigger={/(\{([^{]*))$/}
                data={listFormatVariant}
                displayTransform={(x, display) => "{" + display + "}"}
              />
            </MentionsInput>
          </FormInput>
        )}
      </FormPageContent>

      {variants && variants.length > 0 && (
        <FormPageContent
          title={t("inventory.item.menu.variants")}
          value="variants"
          collapsible
        >
          <FormPageContentTitle>
            {t("inventory.item.menu.variants")}
          </FormPageContentTitle>
          <WhenVisible
            data={["variants"]}
            fallback={() => (
              <div className="!text-base font-normal text-foreground flex gap-x-4">
                <LoadingIcon className="size-4" />
                <span>{t("core.form.loading")} ...</span>
              </div>
            )}
          >
            <div className="grid grid-cols-[2fr_auto_auto_auto] gap-x-6 [&>*]:px-4 border rounded-md">
              <div className="grid py-1 border-b rounded-t-md bg-muted border-muted-foreground/25 grid-cols-subgrid col-span-full">
                <span className="flex items-center justify-start font-bold text-center">
                  {t("inventory.item.columns.sku")}
                </span>
                <span className="flex items-center justify-start font-bold text-center">
                  {t("inventory.item.columns.allow_alternative_item")}
                </span>
                <span className="flex items-center justify-start font-bold text-center">
                  {t("inventory.item.columns.is_disabled.parse.false")}
                </span>
                <span className="flex items-center justify-start font-bold text-center">
                  {t("inventory.item.columns.total_stock")}
                </span>
              </div>
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className="grid py-2 border-b last:rounded-b-md border-muted-foreground/25 grid-cols-subgrid col-span-full"
                >
                  {variant.sku ? (
                    <Link
                      className="hover:underline"
                      href={route("variants.show", {
                        variant: variant.id,
                      })}
                    >
                      {variant.sku || item.code}
                    </Link>
                  ) : (
                    <span className="flex items-center justify-start">
                      {item.code}
                    </span>
                  )}
                  <div className="flex justify-center">
                    <Checkbox
                      id="allow_alternative_item"
                      checked={
                        variant.allow_alternative_item == null
                          ? "indeterminate"
                          : variant.allow_alternative_item === true
                      }
                      disabled
                    />
                  </div>
                  <div className="flex justify-center">
                    <Checkbox
                      id="allow_alternative_item"
                      checked={
                        variant.disabled == null
                          ? "indeterminate"
                          : variant.disabled === false
                      }
                      disabled
                    />
                  </div>
                  <span className="px-2 text-center">
                    {variant.total_stock}
                  </span>
                </div>
              ))}
            </div>
          </WhenVisible>
        </FormPageContent>
      )}
      <FormBarcodes />
      {item && !(item.variants && item.variants.length > 0) && (
        <FormStockLevels />
      )}
      <FormPageContent title={t("inventory.item.menu.uom")} value="detail">
        <FormPageContentTitle>
          {t("inventory.item.menu.uom")}
        </FormPageContentTitle>
        <FormTable
          readOnly={!data.default_unit}
          columns={uomColumns}
          value={data.uom ?? []}
          onValueChange={useCallback((val) => setData("uom", val), [])}
        />
      </FormPageContent>
    </>
  );
});
