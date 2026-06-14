import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import Handlebars from "handlebars";
import {
  AlertCircle,
  Eye,
  FileDown,
  Info,
  Printer,
  TableProperties,
  TriangleAlert,
} from "lucide-react";
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
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { getSafePrintFontFamily } from "@/lib/utils";
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
  const iframeRef = useRef(null);

  const unitCode = useMemo(
    () => resolveTemplateUnitCode(printTemplate),
    [printTemplate],
  );

  const paperWidth = useMemo(
    () => parseNumericValue(printTemplate?.width, 210),
    [printTemplate?.width],
  );
  const paperHeight = useMemo(
    () => parseNumericValue(printTemplate?.height, 297),
    [printTemplate?.height],
  );

  const openPrintWindow = useCallback(
    ({ autoPrint = false } = {}) => {
      if (typeof window === "undefined") {
        return;
      }

      const previewWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!previewWindow) {
        setRenderError(t("core.printTemplate.editor.popup_blocked"));
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
    [previewCSS, previewHTML, printTemplate?.name, t],
  );

  const handlePrint = useCallback(() => {
    openPrintWindow({ autoPrint: true });
  }, [openPrintWindow]);

  const handleExportPDF = useCallback(() => {
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
        window.route("printTemplates.generate-example-data", printTemplate.id),
      );

      setMissingDataMessage("");
      setWarnings((current) => [
        ...current.filter(
          (warning) => !/no example data|tidak ada data contoh/i.test(warning),
        ),
        t("core.printTemplate.editor.example_data_success"),
      ]);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        t("core.printTemplate.editor.example_data_error");
      setRenderError(message);
    } finally {
      setIsGeneratingExampleData(false);
    }
  }, [isGeneratingExampleData, printTemplate?.id, t]);

  // Stable refs for values used inside the fetch to avoid re-triggering
  // the effect when object references change on parent re-renders.
  const cancelledRef = useRef(false);
  const templateRef = useRef(template);
  const dataTableColumnsRef = useRef(dataTableColumns);
  const preferencesRef = useRef(preferences);
  const docInfoRef = useRef(docInfo);
  const tRef = useRef(t);

  useEffect(() => {
    templateRef.current = template;
  }, [template]);
  useEffect(() => {
    dataTableColumnsRef.current = dataTableColumns;
  }, [dataTableColumns]);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);
  useEffect(() => {
    docInfoRef.current = docInfo;
  }, [docInfo]);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!open) {
      cancelledRef.current = true;
      return;
    }

    cancelledRef.current = false;

    if (!printTemplate?.id) {
      const frameId = requestAnimationFrame(() => {
        if (cancelledRef.current) return;
        setRenderError(
          tRef.current("core.printTemplate.editor.template_invalid_preview"),
        );
        setPreviewHTML("");
        setPreviewCSS("");
        setWarnings([]);
        setMissingDataMessage("");
        setRelationRowSummary([]);
      });
      return () => {
        cancelAnimationFrame(frameId);
        cancelledRef.current = true;
      };
    }

    const sourceTemplate = templateRef.current || {};
    const requestPayload = {
      template: {
        html: sourceTemplate.html || "",
        css: sourceTemplate.css || "",
      },
    };

    // Defer fetch to next frame so Radix Presence animation completes
    // before we trigger state updates (prevents React 19 infinite loop).
    const frameId = requestAnimationFrame(() => {
      if (cancelledRef.current) return;
      runPreview();
    });

    async function runPreview() {
      if (cancelledRef.current) return;
      setLoading(true);
      setRenderError("");
      setWarnings([]);
      setMissingDataMessage("");
      setRelationRowSummary([]);

      try {
        const response = await axios.post(
          window.route("printTemplates.preview", printTemplate.id),
          requestPayload,
        );

        if (cancelledRef.current) return;

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
          responseData.dataTableColumns || dataTableColumnsRef.current || [];

        initHandlebar(tRef.current);

        const compiledTemplate = Handlebars.compile(responseHTML, {
          noEscape: true,
        });

        const context = {
          ...normalizedExampleData,
          doc: normalizedExampleData || {},
          preferences: preferencesRef.current || {},
          company: preferencesRef.current || {},
          docInfo: docInfoRef.current || {},
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
                tRef.current("core.printTemplate.editor.missing_data_message")
            : "",
        );
      } catch (error) {
        if (cancelledRef.current) return;

        const backendMessage = error?.response?.data?.message;
        const problematicToken = extractProblematicToken(
          backendMessage || error?.message || "",
        );
        setRenderError(
          problematicToken
            ? `${backendMessage || error?.message} (token: ${problematicToken})`
            : backendMessage ||
                error?.message ||
                tRef.current("core.printTemplate.editor.render_error_title"),
        );
        setPreviewHTML("");
        setPreviewCSS("");
        setMissingDataMessage("");
        setRelationRowSummary([]);
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
        }
      }
    }

    return () => {
      cancelAnimationFrame(frameId);
      cancelledRef.current = true;
    };
  }, [open, printTemplate?.id, refreshKey]);

  // Write rendered HTML into the iframe (mirrors PrintPreview approach)
  // with proper font-family, margins, and page dimensions.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !previewHTML) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
    doc.close();

    // Bootstrap CSS
    let bootstrapLink = doc.getElementById("bootstrap-css-link");
    if (!bootstrapLink) {
      bootstrapLink = doc.createElement("link");
      bootstrapLink.id = "bootstrap-css-link";
      bootstrapLink.rel = "stylesheet";
      bootstrapLink.href = BOOTSTRAP_CSS_CDN;
      doc.head.appendChild(bootstrapLink);
    }

    // Template styles + page layout (same as PrintPreview)
    const fontFamily = getSafePrintFontFamily(printTemplate?.font_family);
    const marginTop = printTemplate?.margin_top ?? 0;
    const marginRight = printTemplate?.margin_right ?? 0;
    const marginBottom = printTemplate?.margin_bottom ?? 0;
    const marginLeft = printTemplate?.margin_left ?? 0;

    const style = doc.createElement("style");
    style.id = "print-preview-style";
    style.innerHTML =
      PRINT_PREVIEW_OVERRIDES +
      (previewCSS || "") +
      `
      body {
        font-family: ${fontFamily};
        margin: ${marginTop}${unitCode} ${marginRight}${unitCode} ${marginBottom}${unitCode} ${marginLeft}${unitCode};
        background: #fff;
        color: #111827;
      }
      @media print {
        @page {
          size: ${paperWidth}${unitCode} ${paperHeight}${unitCode};
          margin: ${marginTop}${unitCode} ${marginRight}${unitCode} ${marginBottom}${unitCode} ${marginLeft}${unitCode};
        }
        body { margin: 0; }
      }
    `;
    doc.head.appendChild(style);

    doc.body.innerHTML = previewHTML;

    // Set iframe dimensions to match paper size
    iframe.style.width = `${paperWidth}${unitCode}`;
    iframe.style.minHeight = `${paperHeight}${unitCode}`;
  }, [
    previewHTML,
    previewCSS,
    printTemplate,
    unitCode,
    paperWidth,
    paperHeight,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] max-w-[min(96vw,1100px)] flex-col gap-0 overflow-hidden p-0"
        align="center"
      >
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="size-4 text-muted-foreground" />
            {t("core.printTemplate.editor.preview_template")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("core.printTemplate.editor.preview_description")}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                <p className="text-sm text-muted-foreground">
                  {t("core.printTemplate.editor.loading_preview")}
                </p>
              </div>
            </div>
          )}

          {!loading && renderError && (
            <Alert variant="destructive" appearance="light" size="sm">
              <AlertIcon>
                <AlertCircle />
              </AlertIcon>
              <AlertContent>
                <AlertTitle>
                  {t("core.printTemplate.editor.render_error_title")}
                </AlertTitle>
                <AlertDescription>{renderError}</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          {!loading && !renderError && (
            <div className="space-y-3">
              {warnings.length > 0 && (
                <Alert variant="warning" appearance="light" size="sm">
                  <AlertIcon>
                    <TriangleAlert />
                  </AlertIcon>
                  <AlertContent>
                    <AlertTitle>
                      {t("core.printTemplate.editor.warnings")}
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-inside list-disc space-y-0.5">
                        {warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              )}

              {relationRowSummary.length > 0 && (
                <Alert variant="success" appearance="light" size="sm">
                  <AlertIcon>
                    <TableProperties />
                  </AlertIcon>
                  <AlertContent>
                    <AlertTitle>
                      {t("core.printTemplate.editor.relation_summary_title")}
                    </AlertTitle>
                    <AlertDescription>
                      <ul className="list-inside list-disc space-y-0.5">
                        {relationRowSummary.map((item) => (
                          <li key={item.relation}>
                            {item.relation}: {item.rows}{" "}
                            {t(
                              "core.printTemplate.editor.relation_rows_suffix",
                            )}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              )}

              {missingDataMessage && (
                <Alert variant="info" appearance="light" size="sm">
                  <AlertIcon>
                    <Info />
                  </AlertIcon>
                  <AlertContent>
                    <AlertTitle>
                      {t("core.printTemplate.editor.missing_data_title")}
                    </AlertTitle>
                    <AlertDescription>
                      <p>{missingDataMessage}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handleGenerateExampleData}
                        disabled={isGeneratingExampleData}
                      >
                        {isGeneratingExampleData
                          ? t("core.printTemplate.editor.generating_data")
                          : t(
                              "core.printTemplate.editor.generate_example_data",
                            )}
                      </Button>
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              )}

              {/* Preview iframe — mirrors PrintPreview rendering */}
              <div className="flex justify-center">
                <div className="inline-block rounded border border-border bg-white shadow-sm">
                  <iframe
                    ref={iframeRef}
                    title={t("core.printTemplate.editor.preview_iframe_title")}
                    className="block border-0"
                    style={{
                      width: `${paperWidth}${unitCode}`,
                      minHeight: `${paperHeight}${unitCode}`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <DialogFooter className="shrink-0 gap-2 border-t px-5 py-3">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              {t("core.printTemplate.editor.close")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={loading || !previewHTML}
          >
            <Printer className="size-3.5" />
            {t("core.printTemplate.editor.print")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleExportPDF}
            disabled={loading || !previewHTML}
          >
            <FileDown className="size-3.5" />
            {t("core.printTemplate.editor.export_pdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PreviewModal;
