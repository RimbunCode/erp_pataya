import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useEffect, useState } from "react";
import { generateRandom, getFonts } from "@/lib/utils";

import CurrencyInput from "@/Components/CurrencyInput";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import LinkModel from "@/Components/LinkModel";
import PermissionLinkModel from "../PermissionLinkModel";
import Select from "@/Components/Select";
import { useLaravelReactI18n } from "laravel-react-i18n";

const paperSize = {
  A4: {
    width: 210,
    height: 297,
  },
  A5: {
    width: 148,
    height: 210,
  },
  Letter: {
    width: 215.9,
    height: 279.4,
  },
  Legal: {
    width: 215.9,
    height: 355.6,
  },
  Tabloid: {
    width: 279.4,
    height: 431.8,
  },
  // Umum dipakai di Indonesia sebagai 210 x 330 mm
  F4: {
    width: 210,
    height: 330,
  },
};

const units = {
  in: {
    value: "in",
    label: "Inch",
    conversion_factor: 25.4,
  },
  cm: {
    value: "cm",
    label: "Centimeter",
    conversion_factor: 10,
  },
  mm: {
    value: "mm",
    label: "Millimeter",
    conversion_factor: 1,
  },
};

export default function Form() {
  const [fonts, setFonts] = useState([]);
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  useEffect(() => {
    const fn = async () => {
      const fonts = await getFonts();
      setFonts(fonts);
    };
    fn();
  }, []);

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormCheckbox
            checked={data.is_letter_head}
            onCheckedChange={(val) => setData("is_letter_head", val)}
            label={t("core.printTemplate.columns.is_letter_head")}
          />
          {!data.is_letter_head && (
            <FormInput
              required={true}
              label={t("core.printTemplate.columns.model")}
            >
              <PermissionLinkModel
                required={true}
                placeholder={t("core.printTemplate.columns.model.placeholder")}
                value={data.permission}
                onValueChange={(val) =>
                  setData((prev) => ({
                    ...prev,
                    permission: val,
                    model: val?.model,
                    name: val
                      ? `${val.name}_${generateRandom(5).toLowerCase()}`
                      : "",
                  }))
                }
                filters={{
                  is_submitable: true,
                }}
              />
            </FormInput>
          )}
          <FormInput
            required={true}
            label={t("core.printTemplate.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onValueChange={(e) => setData("name", e)}
            />
          </FormInput>
          {!data.is_letter_head && (
            <>
              <FormInput
                label={t("core.printTemplate.columns.default_languange")}
              >
                <Select
                  value={data?.default_languange ?? ""}
                  onValueChange={(e) => setData("default_languange", e)}
                  options={["en", "id"]}
                  optionTrans="core.printTemplate.columns.default_languange.options"
                />
              </FormInput>
              <FormInput label={t("core.printTemplate.columns.letter_head")}>
                <LinkModel
                  model="App\Models\Core\PrintTemplate"
                  value={data?.letter_head ?? ""}
                  onValueChange={(e) => setData("letter_head", e)}
                  disabledAddButton={true}
                  defaultValue={{
                    is_default: true,
                  }}
                  filters={{
                    id: {
                      not: data?.id,
                    },
                    is_letter_head: true,
                  }}
                />
              </FormInput>
            </>
          )}
          <FormCheckbox
            checked={data.is_default}
            onCheckedChange={(val) => setData("is_default", val)}
            label={t("core.printTemplate.columns.is_default")}
          />
        </div>
      </FormPageContent>
      {!data.is_letter_head && (
        <FormPageContent
          title={t("core.printTemplate.style_settings")}
          value="detail"
        >
          <div className="grid grid-cols-2 gap-4">
            <FormInput label={t("core.printTemplate.columns.paper")} required>
              <Select
                defaultValue="A4"
                value={data?.paper ?? ""}
                onValueChange={(paper) => {
                  setData((prev) => {
                    const conversion_factor =
                      units[prev.unit]?.conversion_factor ?? 1;
                    const widthOri =
                      paperSize[paper]?.width / conversion_factor;
                    const heightOri =
                      paperSize[paper]?.height / conversion_factor;

                    const width = paper != "custom" ? widthOri : prev?.width;
                    const height = paper != "custom" ? heightOri : prev?.height;
                    return {
                      ...prev,
                      paper: paper,
                      width: prev.orientation == "portrait" ? width : height,
                      height: prev.orientation == "portrait" ? height : width,
                    };
                  });
                }}
                options={[
                  {
                    value: "A4",
                    label: "A4",
                  },
                  {
                    value: "A5",
                    label: "A5",
                  },
                  {
                    value: "Letter",
                    label: "Letter",
                  },
                  {
                    value: "Legal",
                    label: "Legal",
                  },
                  {
                    value: "Tabloid",
                    label: "Tabloid",
                  },
                  {
                    value: "F4",
                    label: "F4",
                  },
                  {
                    value: "custom",
                    label: t("core.printTemplate.columns.paper.options.custom"),
                  },
                ]}
              />
            </FormInput>
            <FormInput
              required
              label={t("core.printTemplate.columns.orientation")}
            >
              <Select
                defaultValue="portrait"
                value={data?.orientation ?? ""}
                onValueChange={(val) => {
                  setData((prev) => ({
                    ...prev,
                    orientation: val,
                    width: val == "portrait" ? prev.width : prev.height,
                    height: val == "portrait" ? prev.height : prev.width,
                  }));
                }}
                options={["portrait", "landscape"]}
                optionTrans="core.printTemplate.columns.orientation.options"
              />
            </FormInput>
            <FormInput
              required
              label={t("core.printTemplate.columns.font_family")}
            >
              <Select
                defaultValue="Times New Roman"
                value={data?.font_family ?? ""}
                onValueChange={(e) => setData("font_family", e)}
                options={fonts}
              />
            </FormInput>
            <FormInput required label={t("core.printTemplate.columns.unit")}>
              <Select
                defaultValue="cm"
                value={data?.unit ?? ""}
                options={Object.values(units)}
                onValueChange={(unit) => {
                  setData((prev) => {
                    const last_conversion_factor =
                      units[prev.unit ?? ""]?.conversion_factor ??
                      prev.last_conversion_factor;
                    const conversion_factor =
                      units[unit ?? ""]?.conversion_factor ?? null;
                    const width =
                      prev.paper == "custom"
                        ? prev.width *
                          (last_conversion_factor / conversion_factor)
                        : ((paperSize[prev?.paper]?.width / conversion_factor) *
                            100) /
                          100;
                    const height =
                      prev.paper == "custom"
                        ? prev.height *
                          (last_conversion_factor / conversion_factor)
                        : ((paperSize[prev?.paper]?.height /
                            conversion_factor) *
                            100) /
                          100;

                    const margin_top =
                      prev.margin_top *
                      (last_conversion_factor / conversion_factor);
                    const margin_bottom =
                      prev.margin_bottom *
                      (last_conversion_factor / conversion_factor);
                    const margin_left =
                      prev.margin_left *
                      (last_conversion_factor / conversion_factor);
                    const margin_right =
                      prev.margin_right *
                      (last_conversion_factor / conversion_factor);

                    return {
                      ...prev,
                      unit,
                      last_conversion_factor: conversion_factor,
                      width: width ?? prev?.width,
                      height: height ?? prev?.height,
                      margin_top,
                      margin_bottom,
                      margin_left,
                      margin_right,
                    };
                  });
                }}
              />
            </FormInput>

            <FormInput
              required
              label={t("core.printTemplate.columns.page_number")}
            >
              <Select
                defaultValue="bottom_right"
                value={data?.page_number ?? ""}
                onValueChange={(e) => setData("page_number", e)}
                options={[
                  "hide",
                  "top_left",
                  "top_center",
                  "top_right",
                  "bottom_left",
                  "bottom_center",
                  "bottom_right",
                ]}
                optionTrans="core.printTemplate.columns.page_number.options"
              />
            </FormInput>
            {data?.page_number && data?.page_number != "hide" && (
              <FormInput
                required
                label={t("core.printTemplate.columns.page_number_format")}
              >
                <Input
                  value={data?.page_number_format || ":page / :total"}
                  onValueChange={(e) => setData("page_number_format", e)}
                />
              </FormInput>
            )}
            <div className="grid col-span-full grid-cols-subgrid gap-y-4 border-y pt-8 pb-4">
              <FormInput
                disabled={!data.unit}
                required
                label={t("core.printTemplate.columns.width")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={data?.width ?? ""}
                  onValueChange={(val) => {
                    setData((prev) => {
                      return {
                        ...prev,
                        width: val,
                        paper:
                          val != paperSize[prev.paper]?.width
                            ? "custom"
                            : prev.paper,
                        orientation:
                          val > prev.height ? "landscape" : "potrait",
                      };
                    });
                  }}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!data.unit}
                required
                label={t("core.printTemplate.columns.height")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={data?.height ?? ""}
                  onValueChange={(val) => {
                    setData((prev) => {
                      return {
                        ...prev,
                        height: val,
                        paper:
                          val != paperSize[prev.paper]?.height
                            ? "custom"
                            : prev.paper,
                        orientation:
                          val >= prev.width ? "portrait" : "landscape",
                      };
                    });
                  }}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
            </div>
            <div className="grid col-span-full grid-cols-subgrid gap-y-4 border-b py-4">
              <FormInput
                disabled={!data.unit}
                required
                label={t("core.printTemplate.columns.margin_top")}
                className="col-start-1"
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={data?.margin_top ?? ""}
                  onValueChange={(e) => setData("margin_top", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!data.unit}
                required
                label={t("core.printTemplate.columns.margin_bottom")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={data?.margin_bottom ?? ""}
                  onValueChange={(e) => setData("margin_bottom", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!data.unit}
                required
                label={t("core.printTemplate.columns.margin_left")}
                className="col-start-1"
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={data?.margin_left ?? ""}
                  onValueChange={(e) => setData("margin_left", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!data.unit}
                required
                label={t("core.printTemplate.columns.margin_right")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={data?.margin_right ?? ""}
                  onValueChange={(e) => setData("margin_right", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
            </div>
            <div>
              <FormCheckbox
                checked={data.show_absolute_values}
                onCheckedChange={(val) => setData("show_absolute_values", val)}
                label={t("core.printTemplate.columns.show_absolute_values")}
              />
              <p className="text-foreground/75 mt-3">
                {t(
                  "core.printTemplate.columns.show_absolute_values.description",
                )}
              </p>
            </div>
          </div>
        </FormPageContent>
      )}
    </>
  );
}
