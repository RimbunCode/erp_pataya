import {
  FormPageContent,
  FormPageContentDescription,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ArrowLeftRightIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import QueryString from "qs";
import Select from "@/Components/Select";
import axios from "axios";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import useCanUpdate from "@/Hooks/useCanUpdate";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData, dataBefore } = useFormPage();
  const { t } = useLaravelReactI18n();
  // Select "group" dibungkus <div relative> (posisi Loader2Icon) sehingga
  // BUKAN child langsung FormInput — cloneElement FormInput tak bisa
  // menembus wrapper itu utk inject readOnly. Resolve canUpdate manual
  // di sini, oper eksplisit ke Select (bukan andalkan auto-inject).
  const canUpdateGroup = useCanUpdate("group");
  const route = window.route;
  const [units, setUnits] = useState([]);
  const [unitSelected, setUnitSelected] = useState({ from: null, to: data });
  const [groups, setGroups] = useState([]);
  const [searchGroup, setSearchGroup] = useState("");
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const latestGroupRequestId = useRef(0);
  const unitOptions = useMemo(() => {
    const options = units.map((unit) => ({
      value: String(unit.id),
      label: convertTemplateLink(unit) || `${unit.name} (${unit.code})`,
      unit,
    }));
    if (
      data?.id &&
      !options.some((option) => option.value === String(data.id))
    ) {
      options.push({
        value: String(data.id),
        label: convertTemplateLink(data) || `${data.name} (${data.code})`,
        unit: data,
      });
    }
    return options;
  }, [units, data]);
  const findUnitByOptionValue = useCallback(
    (value) => {
      if (!value) {
        return null;
      }
      return unitOptions.find((option) => option.value == value)?.unit ?? null;
    },
    [unitOptions],
  );

  const loadGroups = useCallback(
    (search) => {
      const requestId = ++latestGroupRequestId.current;
      setLoadingGroups(true);
      axios
        .get(route("units.groups", search ?? ""))
        .then((res) => {
          if (requestId !== latestGroupRequestId.current) {
            return;
          }
          setGroups(res.data);
        })
        .catch((err) => {
          console.log(err);
          if (requestId === latestGroupRequestId.current) {
            toast.error(t("core.form.errors.something_went_wrong"));
          }
        })
        .finally(() => {
          if (requestId === latestGroupRequestId.current) {
            setLoadingGroups(false);
          }
        });
    },
    [t],
  );
  const loadUnits = useCallback((group) => {
    axios
      .get(
        `${route("units.index")}?${QueryString.stringify({ group, except: data.id })}`,
      )
      .then((res) => {
        setUnits(res.data);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  const swapPlayground = useCallback(() => {
    setUnitSelected((prev) => ({
      from: prev.to,
      to: prev.from,
    }));
    const fromTemp = fromValue;
    const toTemp = toValue;
    setToValue(fromTemp);
    setFromValue(toTemp);
  }, [fromValue, toValue]);

  useEffect(() => {
    if (!fromValue) {
      setToValue("");
      return;
    }

    const fromUnit =
      unitSelected.from && unitSelected.from?.id === data.id
        ? data
        : unitSelected.from;
    const toUnit =
      unitSelected.to && unitSelected.to?.id === data.id
        ? data
        : unitSelected.to;

    const result =
      Number(fromValue) *
      (fromUnit?.conversion_factor / toUnit?.conversion_factor);
    setToValue(Number.isNaN(result) ? "" : result);
  }, [fromValue, data.conversion_factor, unitSelected]);

  useEffect(() => {
    setUnitSelected((prev) => {
      if (unitSelected.from && unitSelected.from?.id === data.id)
        return {
          ...prev,
          to: null,
        };
      if (unitSelected.to && unitSelected.to?.id === data.id)
        return {
          ...prev,
          from: null,
        };
    });
  }, [units]);

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      loadGroups(searchGroup);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [loadGroups, searchGroup]);

  useEffect(() => {
    loadUnits(data.group);
  }, [data.group]);

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("inventory.unit.columns.group")}
            name="group"
          >
            <div className="relative flex items-center">
              <Select
                readOnly={!canUpdateGroup}
                disabled={!canUpdateGroup}
                options={groups}
                value={data.group ?? ""}
                onValueChange={(val) =>
                  setData((prev) => ({
                    ...prev,
                    group: val,
                    customable:
                      val === "Others" ? true : (prev.customable ?? false),
                  }))
                }
                onSearchChange={(val) => setSearchGroup(val)}
                placeholder={t("inventory.unit.columns.group.placeholder")}
              />
              {loadingGroups && (
                <div className="absolute right-8 pointer-events-none text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                </div>
              )}
            </div>
          </FormInput>
          <FormInput
            name="code"
            required={true}
            label={t("inventory.unit.columns.code")}
          >
            <Input
              value={data.code}
              onChange={(e) => setData("code", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="name"
            required={true}
            label={t("inventory.unit.columns.name")}
          >
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            disabled={data.group === "Others"}
            checked={data.customable ?? false}
            valueBefore={dataBefore?.customable}
            onCheckedChange={(val) => {
              setData("customable", val);
            }}
            label={t("inventory.unit.columns.customable")}
          />
          {!data.customable && (
            <FormInput
              name="conversion_factor"
              required={true}
              label={t("inventory.unit.columns.conversion_factor")}
              name="conversion_factor"
            >
              <Input
                pattern="^\d*(\.\d+)?$"
                value={data.conversion_factor}
                onChange={(e) => setData("conversion_factor", e.target.value)}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>
      {!data.customable && units.length > 0 && (
        <FormPageContent title={t("inventory.unit.playground")} value="detail">
          <FormPageContentDescription>
            {t("inventory.unit.playground.description")}
          </FormPageContentDescription>
          <div className="grid gap-x-3 gap-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-3">
              <FormInput
                ignoreDisabled={true}
                label={t("inventory.unit.columns.units.from")}
              >
                <Select
                  options={unitOptions}
                  value={String(unitSelected.from?.id ?? "")}
                  // disabled={
                  //   unitSelected.from && unitSelected.from?.id === data?.id
                  // }
                  onValueChange={(value) => {
                    setUnitSelected((prev) => ({
                      ...prev,
                      from: findUnitByOptionValue(value),
                    }));
                  }}
                  placeholder={t("inventory.unit.playground.unit.placeholder")}
                />
              </FormInput>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end size-8!"
                onClick={swapPlayground}
              >
                <ArrowLeftRightIcon className="size-8" />
              </Button>
              <FormInput
                ignoreDisabled={true}
                label={t("inventory.unit.columns.units.to")}
              >
                <Select
                  options={unitOptions}
                  value={String(unitSelected.to?.id ?? "")}
                  // disabled={unitSelected.to && unitSelected.to?.id === data?.id}
                  onValueChange={(value) => {
                    setUnitSelected((prev) => ({
                      ...prev,
                      to: findUnitByOptionValue(value),
                    }));
                  }}
                  placeholder={t("inventory.unit.playground.unit.placeholder")}
                />
              </FormInput>
              <Input
                disabled={
                  unitSelected.from === null || unitSelected.to === null
                }
                value={fromValue}
                onChange={(e) => {
                  setFromValue(e.target.value);
                }}
              />
              <Input
                disabled={
                  unitSelected.from === null || unitSelected.to === null
                }
                className="col-start-3"
                readOnly={true}
                value={toValue}
              />
            </div>
          </div>
        </FormPageContent>
      )}
    </>
  );
}
