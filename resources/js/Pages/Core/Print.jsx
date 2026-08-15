import "@/../css/print.css";

import { DEFAULT_PRINT_FONTS, getFonts } from "@/lib/utils";
import { Download, Edit2Icon, Loader2Icon, PrinterIcon } from "lucide-react";
import { Kbd, KbdGroup } from "@/Components/ui/kbd";
import {
  LaravelReactI18nProvider,
  useLaravelReactI18n,
} from "laravel-react-i18n";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import AppLayout from "@/Layouts/AppLayout";
import { Head } from "@inertiajs/react";
import { Button } from "@/Components/ui/button";
import NumberInput from "@/Components/NumberInput";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import Link from "@/Components/Link";
import LinkModel from "@/Components/LinkModel";
import PrintPreview from "./Components/PrintPreview";
import Select from "@/Components/Select";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import { useForm, usePage } from "@inertiajs/react";

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
function Print({ data: _data, printTemplate, lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const initialTemplate = useMemo(() => {
    const normalizedOrientation =
      printTemplate?.orientation === "landscape" ? "landscape" : "portrait";
    const unit = printTemplate?.unit ?? "cm";
    const paper = printTemplate?.paper ?? "A4";
    const paperMetric = paperSize[paper] ?? paperSize.A4;
    const conversionFactor = units[unit]?.conversion_factor ?? 1;
    const portraitWidth = paperMetric.width / conversionFactor;
    const portraitHeight = paperMetric.height / conversionFactor;

    return {
      ...printTemplate,
      paper,
      unit,
      orientation: normalizedOrientation,
      default_language: printTemplate?.default_language || lang || "en",
      page_number: printTemplate?.page_number ?? "bottom_right",
      font_family: printTemplate?.font_family ?? "Times New Roman",
      width:
        printTemplate?.width ??
        (normalizedOrientation === "portrait" ? portraitWidth : portraitHeight),
      height:
        printTemplate?.height ??
        (normalizedOrientation === "portrait" ? portraitHeight : portraitWidth),
      last_conversion_factor:
        printTemplate?.last_conversion_factor ?? conversionFactor,
    };
  }, [printTemplate, lang]);

  const { data: template, setData: setTemplate } = useForm(initialTemplate);
  const frame = useRef();
  const [fonts, setFonts] = useState([...DEFAULT_PRINT_FONTS]);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const { doc } = usePage().props;

  const handleDownloadPdf = useCallback(async () => {
    if (!frame.current?.contentDocument || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      const html = frame.current.contentDocument.documentElement.outerHTML;
      const pdfRouteName = route()
        .current()
        .replace(/\.print$/, ".print.pdf");

      const response = await window.axios.post(
        route(pdfRouteName, { printTemplate: template.id }),
        { html },
        { responseType: "blob" },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc?.code ?? doc?.id ?? "document"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("core.form.download_pdf_failed"));
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [doc, template.id, isDownloadingPdf, t]);

  const fontOptions = useMemo(() => {
    const options = [template?.font_family, ...fonts].filter(
      (font) => typeof font === "string" && font.trim(),
    );
    const map = new Map();
    options.forEach((font) => {
      const normalized = font.trim();
      const key = normalized.toLowerCase();
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    });
    return Array.from(map.values());
  }, [template?.font_family, fonts]);

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
      <Head
        title={
          doc?.code
            ? `${t("core.form.print_preview")} - ${doc.code}`
            : t("core.form.print_preview")
        }
      />
      <div className="flex items-center border-b justify-between py-2 mb-4 bg-background">
        <h3 className="text-lg font-bold">{t("core.form.print_preview")}</h3>
        <div className="flex items-center gap-x-4">
          <Button variant="outline" asChild>
            <Link href={route("printTemplates.editor", template.id)}>
              <Edit2Icon />
              {t("core.form.edit_template")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="p-2! size-fit h-8"
            disabled={isDownloadingPdf}
            onClick={handleDownloadPdf}
          >
            {isDownloadingPdf ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <Download />
            )}
            {isDownloadingPdf
              ? t("core.form.generating_pdf")
              : t("core.form.download_pdf")}
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
                  value={template?.default_language ?? ""}
                  onValueChange={(e) => setTemplate("default_language", e)}
                  options={["en", "id"]}
                  optionTrans="core.printTemplate.columns.default_language.options"
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
                value={template?.font_family ?? ""}
                onValueChange={(e) => setTemplate("font_family", e)}
                options={fontOptions}
              />
            </FormInput>
            <FormInput required label={t("core.printTemplate.columns.unit")}>
              <Select
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
                <NumberInput
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
                          val > prev.height ? "landscape" : "portrait",
                      };
                    });
                  }}
                  options={["portrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.height")}
              >
                <NumberInput
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
                  options={["portrait", "landscape"]}
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
                <NumberInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_top ?? ""}
                  onValueChange={(e) => setTemplate("margin_top", e)}
                  options={["portrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.margin_bottom")}
              >
                <NumberInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_bottom ?? ""}
                  onValueChange={(e) => setTemplate("margin_bottom", e)}
                  options={["portrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.margin_left")}
                className="col-start-1"
              >
                <NumberInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_left ?? ""}
                  onValueChange={(e) => setTemplate("margin_left", e)}
                  options={["portrait", "landscape"]}
                />
              </FormInput>
              <FormInput
                disabled={!template.unit}
                required
                label={t("core.printTemplate.columns.margin_right")}
              >
                <NumberInput
                  decimalScale={2}
                  className="text-left"
                  value={template?.margin_right ?? ""}
                  onValueChange={(e) => setTemplate("margin_right", e)}
                  options={["portrait", "landscape"]}
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
        <div className="h-full overflow-auto w-full shrink">
          <div className="bg-muted p-8 h-fit! w-fit! rounded-lg mx-auto">
            <LaravelReactI18nProvider
              locale={template.default_language}
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
