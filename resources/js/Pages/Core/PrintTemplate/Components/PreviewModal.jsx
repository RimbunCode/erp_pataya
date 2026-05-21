import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Handlebars from "handlebars";
import { Eye, FileDown, Printer } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { initHandlebar } from "@/lib/initHandlebar";

const BOOTSTRAP_CSS_CDN =
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

/**
 * CSS overrides to hide editor-only styles on the static HTML wrapper
 * in print preview mode (Requirements: 24.1, 24.2).
 */
const PRINT_PREVIEW_OVERRIDES = `
.gjs-static-html-wrapper {
  border: none !important;
  border-radius: 0 !important;
  padding: 0 !important;
}
.gjs-static-html-wrapper::before {
  content: none !important;
  display: none !important;
}
`;

function normalizePreviewWarnings(warnings) {
  if (!Array.isArray(warnings)) {
    return [];
  }

  return warnings.filter(
    (warning) => typeof warning === "string" && warning.trim(),
  );
}

function isEmptyExampleData(value) {
  if (value == null) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
}

function buildPrintableDocument({ title, html, css }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title || "Preview Template"}</title>
    <link rel="stylesheet" href="${BOOTSTRAP_CSS_CDN}" />
    <style>${PRINT_PREVIEW_OVERRIDES}\n${css || ""}</style>
  </head>
  <body>
    ${html || ""}
  </body>
</html>`;
}

function extractProblematicToken(errorMessage = "") {
  if (typeof errorMessage !== "string" || !errorMessage.trim()) {
    return "";
  }

  const tokenMatch = errorMessage.match(/\{\{[^}]+\}\}/);
  if (tokenMatch?.[0]) {
    return tokenMatch[0];
  }

  const lineMatch = errorMessage.match(/line\s+(\d+)/i);
  if (lineMatch?.[1]) {
    return `baris ${lineMatch[1]}`;
  }

  return "";
}

function resolveTemplateUnitCode(printTemplate) {
  const rawUnit =
    typeof printTemplate?.unit === "string"
      ? printTemplate.unit
      : printTemplate?.unit?.code;

  if (typeof rawUnit !== "string" || !rawUnit.trim()) {
    return "mm";
  }

  return rawUnit.trim();
}

function parseNumericValue(value, fallbackValue) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function unitToMillimeter(value, unitCode) {
  if (unitCode === "cm") {
    return value * 10;
  }

  if (unitCode === "in") {
    return value * 25.4;
  }

  return value;
}

function PreviewModal({
  open,
  onOpenChange,
  printTemplate,
  template,
  dataTableColumns = [],
  preferences = {},
  docInfo = {},
}) {
  const { t } = useLaravelReactI18n();
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [previewHTML, setPreviewHTML] = useState("");
  const [previewCSS, setPreviewCSS] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [missingDataMessage, setMissingDataMessage] = useState("");
  const [relationRowSummary, setRelationRowSummary] = useState([]);
  const [isGeneratingExampleData, setIsGeneratingExampleData] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const unitCode = useMemo(
    () => resolveTemplateUnitCode(printTemplate),
    [printTemplate],
  );

  const isLetterHead = Boolean(printTemplate?.is_letter_head);
  const paperWidthValue = useMemo(
    () => (isLetterHead ? 210 : parseNumericValue(printTemplate?.width, 210)),
    [isLetterHead, printTemplate?.width],
  );
  const paperHeightValue = useMemo(
    () => parseNumericValue(printTemplate?.height, 297),
    [printTemplate?.height],
  );
  const pageWidth = useMemo(
    () => `${paperWidthValue}${unitCode}`,
    [paperWidthValue, unitCode],
  );
  const pageMinHeight = useMemo(
    () => (isLetterHead ? "auto" : `${paperHeightValue}${unitCode}`),
    [isLetterHead, paperHeightValue, unitCode],
  );
  const previewScale = useMemo(() => {
    const paperWidthInMillimeter = unitToMillimeter(paperWidthValue, unitCode);
    const paperWidthInPixel = paperWidthInMillimeter * 3.779527559;
    const maxWidth = Math.max(320, viewportWidth - 120);

    if (!paperWidthInPixel || !Number.isFinite(paperWidthInPixel)) {
      return 1;
    }

    return Math.min(1, maxWidth / paperWidthInPixel);
  }, [paperWidthValue, unitCode, viewportWidth]);

  const openPrintWindow = useCallback(
    ({ autoPrint = false } = {}) => {
      if (typeof window === "undefined") {
        return;
      }

      const previewWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!previewWindow) {
        setRenderError(
          "Popup diblokir browser. Izinkan popup untuk print/export.",
        );
        return;
      }

      const documentTitle = printTemplate?.name
        ? `Preview - ${printTemplate.name}`
        : "Preview Template";

      const documentHTML = buildPrintableDocument({
        title: documentTitle,
        html: previewHTML,
        css: previewCSS,
      });

      previewWindow.document.open();
      previewWindow.document.write(documentHTML);
      previewWindow.document.close();

      if (autoPrint) {
        previewWindow.onload = () => {
          previewWindow.focus();
          previewWindow.print();
        };
      }
    },
    [previewCSS, previewHTML, printTemplate?.name],
  );

  const handlePrint = useCallback(() => {
    openPrintWindow({ autoPrint: true });
  }, [openPrintWindow]);

  const handleExportPDF = useCallback(() => {
    // Browser print dialog supports "Save as PDF".
    openPrintWindow({ autoPrint: true });
  }, [openPrintWindow]);

  const handleGenerateExampleData = useCallback(async () => {
    if (!printTemplate?.id || isGeneratingExampleData) {
      return;
    }

    setIsGeneratingExampleData(true);
    setRenderError("");

    try {
      await axios.post(
        window.route("printTemplates.generate-example-data", {
          printTemplates: printTemplate.id,
        }),
      );

      setMissingDataMessage("");
      setWarnings((current) => [
        ...current.filter(
          (warning) => !/no example data|tidak ada data contoh/i.test(warning),
        ),
        "Example data berhasil dibuat. Preview dimuat ulang.",
      ]);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        "Gagal membuat example data otomatis. Jalankan seeder lalu coba lagi.";
      setRenderError(message);
    } finally {
      setIsGeneratingExampleData(false);
    }
  }, [isGeneratingExampleData, printTemplate?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!printTemplate?.id) {
      setRenderError("Template tidak valid untuk preview.");
      setPreviewHTML("");
      setPreviewCSS("");
      setWarnings([]);
      setMissingDataMessage("");
      setRelationRowSummary([]);
      return;
    }

    const sourceTemplate = template || {};
    const requestPayload = {
      template: {
        html: sourceTemplate.html || "",
        css: sourceTemplate.css || "",
      },
    };

    let cancelled = false;

    const runPreview = async () => {
      setLoading(true);
      setRenderError("");
      setWarnings([]);
      setMissingDataMessage("");
      setRelationRowSummary([]);

      try {
        const response = await axios.post(
          window.route("printTemplates.preview", {
            printTemplates: printTemplate.id,
          }),
          requestPayload,
        );

        if (cancelled) {
          return;
        }

        const responseData = response?.data || {};
        const responseHTML =
          typeof responseData.html === "string" ? responseData.html : "";
        const responseCSS =
          typeof responseData.css === "string" ? responseData.css : "";
        const responseExampleData = responseData.exampleData || {};
        const normalizedExampleData =
          responseExampleData?.data &&
          typeof responseExampleData.data === "object"
            ? responseExampleData.data
            : responseExampleData;
        const responseWarnings = normalizePreviewWarnings(
          responseData.warnings,
        );
        const mergedColumns =
          responseData.dataTableColumns || dataTableColumns || [];

        initHandlebar(t);

        const compiledTemplate = Handlebars.compile(responseHTML, {
          noEscape: true,
        });

        const context = {
          ...normalizedExampleData,
          doc: normalizedExampleData || {},
          preferences: preferences || {},
          company: preferences || {},
          docInfo: docInfo || {},
          dataTableColumns: mergedColumns,
        };

        const renderedHTML = compiledTemplate(context);

        const hasNoExampleData = isEmptyExampleData(normalizedExampleData);
        const relationSummary =
          normalizedExampleData && typeof normalizedExampleData === "object"
            ? Object.entries(normalizedExampleData)
                .filter(([, value]) => Array.isArray(value))
                .map(([key, value]) => ({
                  relation: key,
                  rows: value.length,
                }))
            : [];
        const noDataWarning = responseWarnings.find((warning) =>
          /no example data|tidak ada data contoh/i.test(warning),
        );

        setPreviewHTML(renderedHTML);
        setPreviewCSS(responseCSS);
        setWarnings(responseWarnings);
        setRelationRowSummary(relationSummary);
        setMissingDataMessage(
          hasNoExampleData
            ? noDataWarning ||
                "Example data tidak tersedia untuk model ini. Preview bisa tidak merepresentasikan output akhir."
            : "",
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        const backendMessage = error?.response?.data?.message;
        const problematicToken = extractProblematicToken(
          backendMessage || error?.message || "",
        );
        setRenderError(
          problematicToken
            ? `${backendMessage || error?.message} (token/posisi bermasalah: ${problematicToken})`
            : backendMessage ||
                error?.message ||
                "Gagal merender preview template.",
        );
        setPreviewHTML("");
        setPreviewCSS("");
        setMissingDataMessage("");
        setRelationRowSummary([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    runPreview();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    printTemplate?.id,
    template,
    dataTableColumns,
    preferences,
    docInfo,
    t,
    refreshKey,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] h-[96vh] p-0" align="center">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-muted-foreground/20">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview Template
          </DialogTitle>
          <DialogDescription>
            Render hasil template menggunakan example data dari server.
          </DialogDescription>
        </DialogHeader>

        <div className="h-full overflow-auto bg-muted/30 p-5">
          {loading && (
            <div className="rounded-md border border-muted-foreground/20 bg-background p-4 text-sm text-muted-foreground">
              Memuat preview...
            </div>
          )}

          {!loading && renderError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {renderError}
            </div>
          )}

          {!loading && !renderError && warnings.length > 0 && (
            <div className="mb-4 rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Warnings Preview
              </p>
              <ul className="mt-1 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                {warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {!loading && !renderError && relationRowSummary.length > 0 && (
            <div className="mb-4 rounded-md border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Ringkasan Table Relation
              </p>
              <ul className="mt-1 space-y-1 text-xs text-emerald-700 dark:text-emerald-400">
                {relationRowSummary.map((item) => (
                  <li key={item.relation}>
                    • {item.relation}: {item.rows} baris data contoh
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && !renderError && missingDataMessage && (
            <div className="mb-4 rounded-md border border-blue-400/40 bg-blue-50 dark:bg-blue-950/20 p-3">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Data Contoh Tidak Tersedia
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">
                {missingDataMessage}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateExampleData}
                  disabled={isGeneratingExampleData}
                >
                  {isGeneratingExampleData
                    ? "Membuat Data..."
                    : "Generate Example Data"}
                </Button>
              </div>
            </div>
          )}

          {!loading && !renderError && (
            <div className="mx-auto w-full overflow-x-hidden">
              <div
                className="mx-auto origin-top border border-black/10 bg-white text-black shadow-sm"
                style={{
                  width: pageWidth,
                  minHeight: pageMinHeight,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top center",
                }}
              >
                <style>{`@import url('${BOOTSTRAP_CSS_CDN}');\n${PRINT_PREVIEW_OVERRIDES}\n${previewCSS || ""}`}</style>
                <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-muted-foreground/20 gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            disabled={loading || !previewHTML}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleExportPDF}
            disabled={loading || !previewHTML}
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PreviewModal;
