import "@/../css/print.css";

import { Edit2Icon, PrinterIcon } from "lucide-react";
import { Kbd, KbdGroup } from "@/Components/ui/kbd";
import {
  LaravelReactI18nProvider,
  useLaravelReactI18n,
} from "laravel-react-i18n";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import AppLayout from "@/Layouts/AppLayout";
import { Button } from "@/Components/ui/button";
import CurrencyInput from "@/Components/CurrencyInput";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import Link from "@/Components/Link";
import LinkModel from "@/Components/LinkModel";
import PrintPreview from "./Components/PrintPreview";
import Select from "@/Components/Select";
import { getFonts } from "@/lib/utils";
import { useForm } from "@inertiajs/react";

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
function Print({ data: _data, printTemplate }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data: template, setData: setTemplate } = useForm(printTemplate);
  const frame = useRef();
  const [fonts, setFonts] = useState([]);
  useEffect(() => {
    const fn = async () => {
      const fonts = await getFonts();
      setFonts(fonts);
    };
    fn();
  }, []);
  const onKeyDown = useCallback(
    (e) => {
      e.stopPropagation();
      if (e.ctrlKey && e.key == "p") {
        e.preventDefault();
        frame.current.contentWindow.print();
      }
    },
    [frame],
  );
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown]);
  return (
    <AppLayout className="print:p-0">
      <div className="flex items-center border-b justify-between py-2 mb-4 bg-background">
        <h3 className="text-lg font-bold">{t("core.form.print_preview")}</h3>
        <div className="flex items-center gap-x-4">
          <Button variant="outline" asChild>
            <Link href={route("printTemplates.editor", template.id)}>
              <Edit2Icon />
              {t("core.form.edit_template")}
            </Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                className="p-2! size-fit h-8"
                onClick={() => frame.current.contentWindow.print()}
              >
                <PrinterIcon />
                {t("core.form.print")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2">
                Print Document
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <span>+</span>
                  <Kbd>P</Kbd>
                </KbdGroup>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="h-full flex lg:flex-row flex-col gap-y-4 overflow-hidden">
        {/* Sidebar */}
        <div className="lg:border-r lg:mr-4 lg:px-4 lg:h-full static top-0 overflow-y-auto overflow-x-hidden lg:max-w-2xs">
          <div className="grid gap-4 h-auto w-full grid-cols-1">
            <div className="grid col-span-full grid-cols-subgrid gap-y-4 border-b py-4">
              <FormInput label={t("core.printTemplate.columns.languange")}>
                <Select
                  value={template?.default_languange ?? ""}
                  onValueChange={(e) => setTemplate("default_languange", e)}
                  options={["en", "id"]}
                  optionTrans="core.printTemplate.columns.default_languange.options"
                />
              </FormInput>
              <FormInput label={t("core.printTemplate.columns.letter_head")}>
                <LinkModel
                  model="App\Models\Core\PrintTemplate"
                  value={template?.letter_head ?? ""}
                  onValueChange={(e) => setTemplate("letter_head", e)}
                  disabledAddButton={true}
                  defaultValue={{
                    is_default: true,
                  }}
                  filters={{
                    is_letter_head: true,
                  }}
                />
              </FormInput>
            </div>
            <FormInput label={t("core.printTemplate.columns.paper")} required>
              <Select
                defaultValue="A4"
                value={template?.paper ?? ""}
                onValueChange={(paper) => {
                  setTemplate((prev) => {
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
                value={template?.orientation ?? ""}
                onValueChange={(val) => {
                  setTemplate((prev) => ({
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
                value={template?.font_family ?? ""}
                onValueChange={(e) => setTemplate("font_family", e)}
                options={fonts}
              />
            </FormInput>
            <FormInput required label={t("core.printTemplate.columns.unit")}>
              <Select
                defaultValue="cm"
                value={template?.unit ?? ""}
                options={Object.values(units)}
                onValueChange={(unit) => {
                  setTemplate((prev) => {
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
                value={template?.page_number ?? ""}
                onValueChange={(e) => setTemplate("page_number", e)}
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
            {template?.page_number && template?.page_number != "hide" && (
              <FormInput
                required
                label={t("core.printTemplate.columns.page_number_format")}
              >
                <Input
                  value={template?.page_number_format || ":page / :total"}
                  onValueChange={(e) => setTemplate("page_number_format", e)}
                />
              </FormInput>
            )}
            <div className="grid col-span-full grid-cols-subgrid gap-y-4 border-y pt-8 pb-4">
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.width")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.width ?? ""}
                  onValueChange={(val) => {
                    setTemplate((prev) => {
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
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.height")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.height ?? ""}
                  onValueChange={(val) => {
                    setTemplate((prev) => {
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
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.margin_top")}
                className="col-start-1"
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_top ?? ""}
                  onValueChange={(e) => setTemplate("margin_top", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.margin_bottom")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_bottom ?? ""}
                  onValueChange={(e) => setTemplate("margin_bottom", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.margin_left")}
                className="col-start-1"
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_left ?? ""}
                  onValueChange={(e) => setTemplate("margin_left", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.margin_right")}
              >
                <CurrencyInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_right ?? ""}
                  onValueChange={(e) => setTemplate("margin_right", e)}
                  options={["potrait", "landscape"]}
                />
              </FormInput>
            </div>
            <div>
              <FormCheckbox
                checked={template.show_absolute_values}
                onCheckedChange={(val) =>
                  setTemplate("show_absolute_values", val)
                }
                label={t("core.printTemplate.columns.show_absolute_values")}
              />
              <p className="text-foreground/75 mt-3">
                {t(
                  "core.printTemplate.columns.show_absolute_values.description",
                )}
              </p>
            </div>
          </div>
        </div>
        {/* Preview */}
        <div className="h-full overflow-auto w-full flex-shrink-1">
          <div className="bg-muted p-8 h-fit! w-fit! rounded-lg mx-auto">
            <LaravelReactI18nProvider
              locale={template.default_languange}
              fallbackLocale={"en"}
              files={import.meta.glob("/lang/*.json")}
            >
              <PrintPreview ref={frame} template={template} />
            </LaravelReactI18nProvider>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default Print;
