import {
  FormPageContent,
  FormPageContentDescription,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect, useState } from "react";

import { ArrowLeftRightIcon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import Combobox from "@/Components/Combobox";
import { CommandItem } from "@/Components/ui/command";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import QueryString from "qs";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const [units, setUnits] = useState([]);
  const [unitSelected, setUnitSelected] = useState({ from: null, to: data });
  const [groups, setGroups] = useState([]);
  const [searchGroup, setSearchGroup] = useState();
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");

  const loadGroups = useCallback((search) => {
    axios
      .get(route("units.groups", search ?? ""))
      .then((res) => {
        setGroups(res.data);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);
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
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [searchGroup]);

  useEffect(() => {
    loadUnits(data.group);
  }, [data.group]);

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput required={true} label={t("inventory.unit.columns.group")}>
            <Combobox
              search={searchGroup}
              onSearchChange={(val) => {
                if (data.group) return;
                setSearchGroup(val);
              }}
              options={groups}
              value={data.group}
              placeholder={t("inventory.unit.columns.group.placeholder")}
              templateTrigger={(group) => {
                return <span>{group}</span>;
              }}
              templateItem={(group) => {
                return (
                  <CommandItem
                    key={group}
                    onSelect={() => setData("group", group)}
                    value={group}
                    keywords={[group]}
                  >
                    {group}
                  </CommandItem>
                );
              }}
            />
          </FormInput>
          <FormInput required={true} label={t("inventory.unit.columns.code")}>
            <Input
              value={data.code}
              onChange={(e) => setData("code", e.target.value)}
            />
          </FormInput>
          <FormInput required={true} label={t("inventory.unit.columns.name")}>
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.customable ?? false}
            onCheckedChange={(val) => {
              setData("customable", val);
            }}
            label={t("inventory.unit.columns.customable")}
          />
          {!data.customable && (
            <FormInput
              required={true}
              label={t("inventory.unit.columns.conversion_factor")}
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
                <Combobox
                  options={units}
                  value={
                    unitSelected.from && unitSelected.from?.id === data?.id
                      ? data
                      : unitSelected.from
                  }
                  disabled={
                    unitSelected.from && unitSelected.from?.id === data?.id
                  }
                  placeholder={t("inventory.unit.playground.unit.placeholder")}
                  templateTrigger={(unit) => {
                    return (
                      <span>
                        {unit.name} ({unit.code})
                      </span>
                    );
                  }}
                  templateItem={(unit) => {
                    return (
                      <CommandItem
                        key={unit.id}
                        onSelect={() =>
                          setUnitSelected((prev) => ({ ...prev, from: unit }))
                        }
                        value={`${unit.code} ${unit.name}`}
                        keywords={[unit.code, unit.name]}
                      >
                        {unit.name} ({unit.code})
                      </CommandItem>
                    );
                  }}
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
                <Combobox
                  options={units}
                  value={
                    unitSelected.to && unitSelected.to?.id === data?.id
                      ? data
                      : unitSelected.to
                  }
                  disabled={unitSelected.to && unitSelected.to?.id === data?.id}
                  placeholder={t("inventory.unit.playground.unit.placeholder")}
                  templateTrigger={(unit) => {
                    return (
                      <span>
                        {unit.name} ({unit.code})
                      </span>
                    );
                  }}
                  templateItem={(unit) => {
                    return (
                      <CommandItem
                        key={unit.id}
                        onSelect={() =>
                          setUnitSelected((prev) => ({ ...prev, to: unit }))
                        }
                        value={`${unit.code} ${unit.name}`}
                        keywords={[unit.code, unit.name]}
                      >
                        {unit.name} ({unit.code})
                      </CommandItem>
                    );
                  }}
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
