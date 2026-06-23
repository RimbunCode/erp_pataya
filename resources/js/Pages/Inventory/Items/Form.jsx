import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import { Mention, MentionsInput } from "@/Components/Mention";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WhenVisible, usePage } from "@inertiajs/react";

import AttributeLinkModel from "../Attributes/AttributeLinkModel";
import { Checkbox } from "@/Components/ui/checkbox";
import NumberInput from "@/Components/NumberInput";
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

const VariantsSummary = memo(function VariantsSummary({
  variants,
  itemCode,
  route,
  t,
}) {
  if (!variants || variants.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-[2fr_auto_auto_auto] gap-x-6 *:px-4 border rounded-md">
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
          {variant.code ? (
            <Link
              className="hover:underline"
              href={route("itemVariants.show", {
                itemVariant: variant.id,
              })}
            >
              {variant.code || itemCode}
            </Link>
          ) : (
            <span className="flex items-center justify-start">{itemCode}</span>
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
          <span className="px-2 text-center">{variant.total_stock}</span>
        </div>
      ))}
    </div>
  );
});

export default memo(function Form() {
  const { dataBefore = {}, data, setData, disabled } = useFormPage();
  const { item, variants } = usePage().props;
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const setFormData = setData;
  const currentUomsRef = useRef(data.uoms ?? []);
  const defaultUnitRef = useRef(data?.default_unit ?? null);
  const unitGroupCacheRef = useRef(new Map());
  const latestGetUnitsRequestRef = useRef(0);
  const [formatVariantSelected, setFormatVariantSelected] = useState([]);
  const listFormatVariant = useMemo(() => {
    return [
      { id: "item", display: "Item Code" },
      ...(data?.attributes?.map((x) => ({
        id: x.attribute?.id,
        display: x.attribute?.name,
      })) ?? []),
    ].filter(
      (x) =>
        !formatVariantSelected.some(
          (y) => y.display.replace(/^\{(.*?)\}$/g, "$1") == x.display,
        ),
    );
  }, [data?.attributes, formatVariantSelected]);
  useEffect(() => {
    currentUomsRef.current = data.uoms ?? [];
  }, [data.uoms]);
  useEffect(() => {
    defaultUnitRef.current = data?.default_unit ?? null;
  }, [data?.default_unit]);

  const normalizeUnitGroup = useCallback((group) => {
    if (!group || group === "Others") {
      return null;
    }

    return group;
  }, []);
  const mapUnitToUom = useCallback((unit, options = {}) => {
    if (!unit) {
      return null;
    }

    const {
      readOnly = false,
      isManual = false,
      generatedByDefaultUnit = false,
    } = options;
    const isCustom =
      unit.conversion_factor === null || unit.conversion_factor === undefined;

    return {
      ...unit,
      readOnly,
      isCustom,
      isManual,
      generatedByDefaultUnit,
    };
  }, []);
  const mapUnitAsCustom = useCallback(
    (unit) => {
      return mapUnitToUom(unit, { readOnly: false, isManual: true });
    },
    [mapUnitToUom],
  );
  const mapUnitsToUoms = useCallback(
    (units = []) => {
      return units.map((unit) => mapUnitToUom(unit, { readOnly: true }));
    },
    [mapUnitToUom],
  );
  const normalizeUomForCompare = useCallback(
    (unit) => ({
      id: unit?.id ?? null,
      group: normalizeUnitGroup(unit?.group),
      conversion_factor: unit?.conversion_factor ?? null,
      code: unit?.code ?? null,
      name: unit?.name ?? null,
      readOnly: !!unit?.readOnly,
      isCustom: !!unit?.isCustom,
      isManual: !!unit?.isManual,
      generatedByDefaultUnit: !!unit?.generatedByDefaultUnit,
    }),
    [normalizeUnitGroup],
  );
  const areUomsEqual = useCallback(
    (left = [], right = []) => {
      if (left.length !== right.length) {
        return false;
      }

      for (let index = 0; index < left.length; index++) {
        const leftUom = normalizeUomForCompare(left[index]);
        const rightUom = normalizeUomForCompare(right[index]);
        if (
          leftUom.id !== rightUom.id ||
          leftUom.group !== rightUom.group ||
          leftUom.conversion_factor !== rightUom.conversion_factor ||
          leftUom.code !== rightUom.code ||
          leftUom.name !== rightUom.name ||
          leftUom.readOnly !== rightUom.readOnly ||
          leftUom.isCustom !== rightUom.isCustom ||
          leftUom.isManual !== rightUom.isManual ||
          leftUom.generatedByDefaultUnit !== rightUom.generatedByDefaultUnit
        ) {
          return false;
        }
      }

      return true;
    },
    [normalizeUomForCompare],
  );
  const setUomsSafely = useCallback(
    (nextUoms = []) => {
      const currentUoms = currentUomsRef.current ?? [];
      if (areUomsEqual(currentUoms, nextUoms)) {
        return;
      }
      setFormData("uoms", nextUoms);
    },
    [areUomsEqual, setFormData],
  );
  const getPrimaryNonOthersGroup = useCallback(
    (uoms = []) => {
      return (
        (uoms ?? [])
          .map((unit) => normalizeUnitGroup(unit?.group))
          .find(Boolean) ?? null
      );
    },
    [normalizeUnitGroup],
  );
  const enforceSingleNonOthersGroup = useCallback(
    (uoms = []) => {
      const primaryGroup = getPrimaryNonOthersGroup(uoms);
      if (!primaryGroup) {
        return uoms;
      }

      return (uoms ?? []).filter((unit) => {
        const unitGroup = normalizeUnitGroup(unit?.group);
        return !unitGroup || unitGroup === primaryGroup;
      });
    },
    [getPrimaryNonOthersGroup, normalizeUnitGroup],
  );
  const ensureDefaultGlobalUom = useCallback(
    (uoms = []) => {
      const defaultUnit = defaultUnitRef.current;
      const defaultGroup = normalizeUnitGroup(defaultUnit?.group);

      if (!defaultUnit || defaultGroup) {
        return uoms;
      }

      const existingDefaultGlobalUnit = (uoms ?? []).find(
        (unit) => unit?.id === defaultUnit.id,
      );
      const defaultGlobalUnit = existingDefaultGlobalUnit ?? {
        ...mapUnitToUom(defaultUnit, {
          readOnly: true,
          generatedByDefaultUnit: true,
        }),
        readOnly: true,
      };
      if (!defaultGlobalUnit) {
        return uoms;
      }

      const filteredUoms = (uoms ?? []).filter(
        (unit) => unit?.id !== defaultGlobalUnit.id,
      );

      return [defaultGlobalUnit, ...filteredUoms];
    },
    [mapUnitToUom, normalizeUnitGroup],
  );
  const markSelectedUnitAsCustom = useCallback(
    (uoms = [], selectedUnit = null) => {
      if (!selectedUnit?.id) {
        return uoms;
      }

      return (uoms ?? []).map((unit) => {
        if (unit?.id !== selectedUnit.id) {
          return unit;
        }

        return {
          ...unit,
          ...mapUnitAsCustom(selectedUnit),
        };
      });
    },
    [mapUnitAsCustom],
  );
  const setSingleUom = useCallback(
    (unit, options = {}) => {
      const { generatedByDefaultUnit = false } = options;
      if (!unit) {
        setFormData("uoms", []);
        return;
      }
      const nextUoms = ensureDefaultGlobalUom([
        {
          ...mapUnitAsCustom(unit),
          ...(generatedByDefaultUnit
            ? { readOnly: true, generatedByDefaultUnit: true }
            : {}),
        },
      ]).filter(Boolean);
      setUomsSafely(nextUoms);
    },
    [ensureDefaultGlobalUom, mapUnitAsCustom, setUomsSafely],
  );
  const mapFetchedUnitsToFormUoms = useCallback(
    (units = [], selectedUnit = null, options = {}) => {
      const { generatedByDefaultUnit = false } = options;
      let nextUoms = mapUnitsToUoms(units);
      nextUoms = markSelectedUnitAsCustom(nextUoms, selectedUnit);
      if (generatedByDefaultUnit) {
        nextUoms = nextUoms.map((unit) => ({
          ...unit,
          readOnly: true,
          isCustom:
            unit.conversion_factor === null ||
            unit.conversion_factor === undefined,
          generatedByDefaultUnit: true,
          isManual: false,
        }));
      }

      return ensureDefaultGlobalUom(nextUoms);
    },
    [ensureDefaultGlobalUom, mapUnitsToUoms, markSelectedUnitAsCustom],
  );
  const getUnits = useCallback(
    (group, selectedUnit = null, options = {}) => {
      const { generatedByDefaultUnit = false } = options;
      const normalizedGroup = normalizeUnitGroup(group);
      if (!normalizedGroup) {
        setSingleUom(selectedUnit, { generatedByDefaultUnit });
        return;
      }

      const cachedUnits = unitGroupCacheRef.current.get(normalizedGroup);
      if (cachedUnits) {
        setUomsSafely(
          mapFetchedUnitsToFormUoms(cachedUnits, selectedUnit, {
            generatedByDefaultUnit,
          }),
        );
        return;
      }

      const requestId = latestGetUnitsRequestRef.current + 1;
      latestGetUnitsRequestRef.current = requestId;
      axios
        .post(route("model"), {
          model: "App\\Models\\Inventory\\Unit",
          filters: {
            group: normalizedGroup,
          },
          fields: ["group", "conversion_factor"],
        })
        .then((res) => {
          if (latestGetUnitsRequestRef.current !== requestId) {
            return;
          }

          const units = res?.data?.data ?? [];
          unitGroupCacheRef.current.set(normalizedGroup, units);
          setUomsSafely(
            mapFetchedUnitsToFormUoms(units, selectedUnit, {
              generatedByDefaultUnit,
            }),
          );
        })
        .catch((err) => {
          console.log(err);
        });
    },
    [
      mapFetchedUnitsToFormUoms,
      normalizeUnitGroup,
      route,
      setSingleUom,
      setUomsSafely,
    ],
  );
  const primaryNonOthersGroup = useMemo(() => {
    return getPrimaryNonOthersGroup(data.uoms ?? []);
  }, [data.uoms, getPrimaryNonOthersGroup]);
  const activeNonOthersGroup = useMemo(() => {
    return (
      primaryNonOthersGroup ?? normalizeUnitGroup(data?.default_unit?.group)
    );
  }, [data.default_unit?.group, normalizeUnitGroup, primaryNonOthersGroup]);
  const hasDefaultUnitInUoms = useMemo(() => {
    const defaultUnitId = data?.default_unit?.id;
    if (!defaultUnitId) {
      return false;
    }

    return (data.uoms ?? []).some((unit) => unit?.id === defaultUnitId);
  }, [data?.default_unit?.id, data.uoms]);
  useDidMountEffect(() => {
    const defaultUnit = data?.default_unit;
    if (!defaultUnit) {
      return;
    }

    const defaultGroup = normalizeUnitGroup(defaultUnit.group);
    if (!defaultGroup) {
      if (hasDefaultUnitInUoms) {
        return;
      }

      const currentUoms = currentUomsRef.current ?? [];
      const preservedUoms = currentUoms.filter(
        (unit) => !unit?.generatedByDefaultUnit,
      );
      const nextUoms = ensureDefaultGlobalUom(preservedUoms);
      setUomsSafely(nextUoms);
      return;
    }

    if (!primaryNonOthersGroup || primaryNonOthersGroup !== defaultGroup) {
      getUnits(defaultGroup, null, { generatedByDefaultUnit: true });
    }
  }, [
    data.default_unit?.id,
    data.default_unit?.group,
    ensureDefaultGlobalUom,
    getUnits,
    hasDefaultUnitInUoms,
    normalizeUnitGroup,
    primaryNonOthersGroup,
    setUomsSafely,
  ]);
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
              readOnly={
                attributes.disabled ||
                !(dataRow?.isCustom ?? true) ||
                dataRow?.generatedByDefaultUnit
              }
              filters={{
                ...(activeNonOthersGroup
                  ? {
                      or: {
                        "group[0]": activeNonOthersGroup,
                        "group[2]": "Others",
                        "group[1]": null,
                      },
                    }
                  : {}),
              }}
              defaultValueForm={{
                group: activeNonOthersGroup ?? data?.default_unit?.group,
              }}
              onValueChange={(value) => {
                if (!value) return;
                setData(mapUnitAsCustom(value));
                const selectedGroup = normalizeUnitGroup(value.group);
                if (!selectedGroup) {
                  return;
                }
                getUnits(selectedGroup, value);
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
            <NumberInput
              {...attributes}
              disabled={!dataRow?.code}
              readOnly={attributes.disabled || !dataRow?.isCustom}
              value={data ?? null}
              onValueChange={(value) => {
                setData("conversion_factor", value);
              }}
            />
          );
        },
      },
    ],
    [
      activeNonOthersGroup,
      data?.default_unit?.group,
      getUnits,
      mapUnitAsCustom,
    ],
  );
  const handleItemUomsChange = useCallback(
    (val) => {
      const nextUoms = val ?? [];
      const previousUoms = currentUomsRef.current ?? [];
      const deletedGeneratedUnits = previousUoms.filter(
        (prevUnit) =>
          prevUnit?.generatedByDefaultUnit &&
          prevUnit?.id &&
          !nextUoms.some((nextUnit) => nextUnit?.id === prevUnit.id),
      );
      const restoredUoms =
        deletedGeneratedUnits.length > 0
          ? [
              ...deletedGeneratedUnits,
              ...nextUoms.filter(
                (nextUnit) =>
                  !deletedGeneratedUnits.some(
                    (deletedUnit) => deletedUnit.id === nextUnit?.id,
                  ),
              ),
            ]
          : nextUoms;

      const groupedUoms = enforceSingleNonOthersGroup(restoredUoms);
      const deletedCustomGroups = new Set(
        previousUoms
          .filter(
            (prevUnit) =>
              prevUnit?.isManual &&
              prevUnit?.id &&
              !groupedUoms.some((nextUnit) => nextUnit?.id === prevUnit.id),
          )
          .map((prevUnit) => normalizeUnitGroup(prevUnit?.group))
          .filter(Boolean),
      );

      const filteredUoms =
        deletedCustomGroups.size === 0
          ? groupedUoms
          : groupedUoms.filter((unit) => {
              const unitGroup = normalizeUnitGroup(unit?.group);
              return (
                unit?.generatedByDefaultUnit ||
                !unitGroup ||
                !deletedCustomGroups.has(unitGroup)
              );
            });

      setUomsSafely(ensureDefaultGlobalUom(filteredUoms));
    },
    [
      enforceSingleNonOthersGroup,
      ensureDefaultGlobalUom,
      normalizeUnitGroup,
      setUomsSafely,
    ],
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
        unique: true,
        cell({ dataRow, attributes, setData }) {
          return (
            <AttributeLinkModel
              onValueChange={(val) => {
                setData("attribute", val);
              }}
              placeholder={t("inventory.item.columns.attribute.placeholder")}
              value={dataRow.attribute}
              fields={["values"]}
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
  const handleAttributesChange = useCallback(
    (val) => {
      setData("attributes", val);
    },
    [setData],
  );
  const handleBarcodesChange = useCallback(
    (val) => {
      setData("barcodes", val);
    },
    [setData],
  );
  return (
    <>
      <FormDetail dataBefore={dataBefore} data={data} setData={setData} />
      <FormPageContent
        title={t("inventory.item.menu.variants")}
        value="variants"
        show={data.category?.type != "service"}
      >
        <FormTable
          name="ItemVariants"
          disabled={disabled}
          // readOnly={disabled}
          columns={variantColumns}
          value={data.attributes ?? []}
          onValueChange={handleAttributesChange}
        />
        {data?.attributes && data?.attributes?.length > 0 && (
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
                markup="@[__display__](__id__)"
                trigger={/(\{([^{]*))$/}
                data={listFormatVariant}
                displayTransform={(_x, display) => "{" + display + "}"}
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
          show={data.category?.type != "service"}
        >
          <WhenVisible
            data={["variants"]}
            fallback={() => (
              <div className="text-base! font-normal text-foreground flex gap-x-4">
                <LoadingIcon className="size-4" />
                <span>{t("core.form.loading")} ...</span>
              </div>
            )}
          >
            <VariantsSummary
              variants={variants}
              itemCode={item?.code}
              route={route}
              t={t}
            />
          </WhenVisible>
        </FormPageContent>
      )}
      <FormBarcodes
        disabled={disabled}
        item={item}
        uoms={data.uoms ?? []}
        barcodes={data.barcodes ?? []}
        onBarcodesChange={handleBarcodesChange}
      />
      {item &&
        !(item.attributes && item.attributes.length > 0) &&
        !disabled && <FormStockLevels />}
      <FormPageContent title={t("inventory.item.menu.uom")} value="detail">
        <FormPageContentTitle>
          {t("inventory.item.menu.uom")}
        </FormPageContentTitle>
        <FormTable
          name="ItemUoms"
          // disabled={disabled}
          // readOnly={!data.default_unit}
          columns={uomColumns}
          value={data.uoms ?? []}
          onValueChange={handleItemUomsChange}
        />
      </FormPageContent>
    </>
  );
});
