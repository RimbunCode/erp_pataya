import "grapesjs/dist/css/grapes.min.css";

import GjsEditor, { Canvas, WithEditor } from "@grapesjs/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useIsMobile } from "@/Hooks/use-mobile";
import AppLayout from "@/Layouts/AppLayout";
import Handlebars from "handlebars";
import { Head } from "@inertiajs/react";
import MobileEditor from "./MobileEditor";
import PreviewModal from "./Components/PreviewModal";
import Sidebar from "./Components/Sidebar";
import StaticHTMLComponent from "./Components/StaticHTMLComponent";
import TopBar from "./Components/TopBar";
import flattenMediaPlugin from "@/lib/flattenMediaPlugin";
import { generateRandom, getSafePrintFontFamily } from "@/lib/utils";
import gjsBlockBasic from "grapesjs-blocks-basic";
import gjsDocHeader from "@/lib/gjsDocHeader";
import gjsRelationsTable, {
  buildExampleDataTable,
} from "@/lib/gjsRelationsTable";
import gjsStaticHTML from "@/lib/gjsStaticHTML";
import gjsTable from "@/lib/gjsTable";
import grapesjs from "grapesjs";
import { initHandlebar } from "@/lib/initHandlebar";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { toast } from "sonner";
import { simplifyTokenDisplay } from "./Components/tokenConfigHelpers";
import {
  removeAllSelectedComponents,
  shouldClearSelectionOnCanvasClick,
} from "./utils/canvasSelectionUtils";
import { formatHandlebarTemplate } from "./utils/templateFormatUtils";

const SIDEBAR_DEFAULT_WIDTH = 320;
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 520;

function clampSidebarWidth(width) {
  const numericWidth = Number(width);
  if (!Number.isFinite(numericWidth)) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, numericWidth));
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
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallbackValue;
}

function validateHandlebarTemplate(template = "") {
  try {
    Handlebars.parse(template || "");
    return { valid: true, message: "" };
  } catch (error) {
    return {
      valid: false,
      message: error?.message || "Handlebar syntax error",
    };
  }
}

function buildVariableToken({
  variableType,
  parentType,
  variablePath,
  keyName,
}) {
  if (parentType === "preferences" || variableType === "preferences") {
    return `{{company.${keyName}}}`;
  }

  const normalizedPath = variablePath.startsWith("doc.")
    ? variablePath
    : `doc.${variablePath}`;

  if (variableType === "relation") {
    return `{{relation ${normalizedPath}}}`;
  }

  return `{{${normalizedPath}}}`;
}

function mountLetterheadPreview(editor, { html, css }) {
  const addPreview = () => {
    const frame = editor.Canvas.getFrameEl();
    if (!frame) {
      return;
    }

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc) {
      return;
    }

    const wrapperEl = editor.getWrapper().view?.el;
    if (!wrapperEl) {
      return;
    }

    if (!html && !css) {
      return;
    }

    const previousStyle = doc.getElementById("letterhead-preview-style");
    if (previousStyle) {
      previousStyle.remove();
    }

    const previousPreview = doc.getElementById("letterhead-preview");
    if (previousPreview) {
      previousPreview.remove();
    }

    const styleEl = doc.createElement("style");
    styleEl.id = "letterhead-preview-style";
    styleEl.innerHTML = css || "";
    doc.head.appendChild(styleEl);

    const box = doc.createElement("div");
    box.id = "letterhead-preview";
    box.style.position = "relative";
    box.style.pointerEvents = "none";
    box.style.zIndex = "1";
    box.style.userSelect = "none";
    box.setAttribute("contenteditable", "false");

    box.innerHTML = html || "";
    doc.body.insertBefore(box, wrapperEl);
  };

  editor.on("load", addPreview);
  addPreview();
}

function variableDropListener(editor, { t, exampleData, locale }) {
  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;
  const GRID_CLASS = "gjs-grid";
  const SUBGRID_CLASS = "gjs-subgrid";
  const GRID_RULE_STYLE = {
    display: "grid",
    "grid-template-columns": "max-content 1fr",
    "column-gap": "12px",
    "padding-top": "10px",
    "padding-bottom": "10px",
  };
  const SUBGRID_RULE_STYLE = {
    display: "grid",
    "grid-template-columns": "subgrid",
    gap: "8px",
    "grid-column": "1 / -1",
    padding: "0px",
  };
  const ensureVariableGridCssRules = () => {
    const cssComposer = editor?.Css;
    if (!cssComposer) {
      return;
    }

    cssComposer.setRule(`.${GRID_CLASS}`, GRID_RULE_STYLE, {
      addStyles: true,
    });
    cssComposer.setRule(`.${SUBGRID_CLASS}`, SUBGRID_RULE_STYLE, {
      addStyles: true,
    });
  };
  const getSimplifiedTokenDisplay = (token, variablePath = "") => {
    if (!token) {
      return variablePath ? `{{${variablePath.replace(/^doc\./, "")}}}` : "";
    }

    const formattedTokenMatch = token.match(
      /\{\{\s*format(?:Currency|Number)\s+doc\.([^\s}]+)/,
    );
    if (formattedTokenMatch?.[1]) {
      return `{{${formattedTokenMatch[1]}}}`;
    }

    return simplifyTokenDisplay(token);
  };
  editor.DomComponents.addType("gjsGrid", {
    model: {
      defaults: {
        droppable: true,
        tagName: "div",
        classes: [GRID_CLASS],
        attributes: {
          class: GRID_CLASS,
        },
        styles: `
          .${GRID_CLASS} {
            display: ${GRID_RULE_STYLE.display};
            grid-template-columns: ${GRID_RULE_STYLE["grid-template-columns"]};
            column-gap: ${GRID_RULE_STYLE["column-gap"]};
            padding-top: ${GRID_RULE_STYLE["padding-top"]};
            padding-bottom: ${GRID_RULE_STYLE["padding-bottom"]};
          }
        `,
      },
    },
  });
  editor.DomComponents.addType("gjsSubGrid", {
    model: {
      defaults: {
        droppable: false,
        draggable: true,
        selectable: true,
        layerable: true,
        tagName: "div",
        classes: [SUBGRID_CLASS],
        attributes: {
          class: SUBGRID_CLASS,
        },
        styles: `
          .${SUBGRID_CLASS} {
            display: ${SUBGRID_RULE_STYLE.display};
            grid-template-columns: ${SUBGRID_RULE_STYLE["grid-template-columns"]};
            gap: ${SUBGRID_RULE_STYLE.gap};
            grid-column: ${SUBGRID_RULE_STYLE["grid-column"]};
            padding: ${SUBGRID_RULE_STYLE.padding};
          }
        `,
      },
      toHTML() {
        const attrs = this.getAttributes() || {};
        const variablePath = attrs["data-variable"] || "";
        const variableType = attrs["data-variable-type"] || "data";

        const labelComponent = Array.from(
          this.find?.("[data-label-key]") || [],
        )[0];
        const tokenComponent = Array.from(this.find?.("[data-token]") || [])[0];

        const labelAttributes = labelComponent?.getAttributes?.() || {};
        const tokenAttributes = tokenComponent?.getAttributes?.() || {};

        const fallbackLabel = variablePath.split(".").pop() || variablePath;
        const labelKey = labelAttributes["data-label-key"] || fallbackLabel;
        const token =
          tokenAttributes["data-token"] ||
          buildVariableToken({
            variableType,
            parentType: variableType,
            variablePath,
            keyName: labelKey,
          });

        return `
<div class="${SUBGRID_CLASS}" data-variable="${variablePath}" data-variable-type="${variableType}">
  <p><span>{{trans "${labelKey}"}}</span></p>
  <p>: <span>${token}</span></p>
</div>
        `.trim();
      },
    },
  });

  const syncVariableComponentDisplay = (component) => {
    if (!component || component.getType?.() !== "gjsSubGrid") {
      return;
    }

    const attributes = component.getAttributes?.() || {};
    const variablePath = attributes["data-variable"] || "";
    const labelComponent = Array.from(
      component.find?.("[data-label-key]") || [],
    )[0];
    const tokenComponent = Array.from(
      component.find?.("[data-token]") || [],
    )[0];
    component.removeClass(SUBGRID_CLASS);
    component.addClass(SUBGRID_CLASS);

    if (String(labelComponent?.get("tagName") || "").toLowerCase() === "p") {
      const labelKey =
        labelComponent.getAttributes?.()?.["data-label-key"] || "";
      const translatedLabel = labelKey ? t(`fields.${labelKey}`) : "";
      const fallbackLabel =
        labelKey.split(".").pop() || labelKey || variablePath;
      const displayLabel =
        translatedLabel && translatedLabel !== `fields.${labelKey}`
          ? translatedLabel
          : fallbackLabel;

      labelComponent.set("draggable", false);
      labelComponent.components([
        {
          type: "text",
          tagName: "span",
          selectable: true,
          editable: false,
          draggable: false,
          attributes: {
            "data-label-key": labelKey,
            title: labelKey,
            contenteditable: "false",
          },
          content: displayLabel || fallbackLabel || "-",
        },
      ]);
    }

    if (!tokenComponent) {
      return;
    }

    const tokenValue = tokenComponent.getAttributes?.()?.["data-token"] || "";
    const simplifiedToken = getSimplifiedTokenDisplay(tokenValue, variablePath);

    if (String(tokenComponent.get("tagName") || "").toLowerCase() === "p") {
      tokenComponent.set("editable", true);
      tokenComponent.set("draggable", false);
      tokenComponent.components([
        {
          type: "textnode",
          content: ": ",
        },
        {
          type: "text",
          tagName: "span",
          selectable: true,
          editable: false,
          draggable: false,
          attributes: {
            "data-token": tokenValue,
            title: tokenValue,
            contenteditable: "false",
          },
          content: simplifiedToken,
        },
      ]);

      return;
    }

    tokenComponent.set("content", simplifiedToken);
  };

  const syncAllVariableComponents = () => {
    const wrapper = editor.getWrapper?.();
    if (!wrapper) {
      return;
    }

    const variableComponents = Array.from(
      wrapper.find?.("[data-variable]") || [],
    );
    variableComponents.forEach((component) =>
      syncVariableComponentDisplay(component),
    );
  };

  ensureVariableGridCssRules();
  editor.on("load", syncAllVariableComponents);
  editor.on("load", ensureVariableGridCssRules);
  editor.on("component:add", syncVariableComponentDisplay);
  editor.on("component:add", (component) => {
    if (!component) {
      return;
    }

    const componentType = component.getType?.();
    if (componentType === "gjsGrid" || componentType === "gjsSubGrid") {
      ensureVariableGridCssRules();
    }
  });
  // 1. Intersep data drop dari luar
  editor.on("canvas:dragdata", (dataTransfer, result) => {
    const customMimeJson = dataTransfer.getData("variable/json");
    const plainTextJson = dataTransfer.getData("text/plain");
    const json = customMimeJson || plainTextJson;
    if (!json) return;

    let payload;
    try {
      payload = JSON.parse(json);
    } catch (err) {
      console.error("Invalid variable/json payload", err);
      return;
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      (!payload.name && !payload.fullKey)
    ) {
      return;
    }

    if (payload.type === "relations") {
      const columns =
        payload.columns
          ?.filter((c) => c.show)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) || [];

      // Resolve example data for this relation from the exampleData prop
      const relationExampleData = exampleData
        ? Array.isArray(exampleData[payload.name])
          ? exampleData[payload.name]
          : exampleData[payload.name]
            ? [exampleData[payload.name]]
            : []
        : [];

      // Build canvas preview using example data (not Handlebar tokens)
      // Requirements: 3.1, 3.2, 3.4
      const tableComponents = buildExampleDataTable({
        columns,
        relationName: payload.name,
        exampleData: relationExampleData,
        t,
        genId,
        locale,
      });

      // 👉 Beritahu GrapesJS: konten yang harus dibuat saat drop
      // Canvas shows example data for visual preview
      // The toHTML() override on the component generates proper Handlebar tokens
      result.content = {
        type: "gjsRelationsTable",
        columnsConfig: columns, // Store columns config for toHTML() token generation
        attributes: {
          "data-relations": payload.name,
        },
        components: tableComponents,
      };
    } else {
      // Resolve example value for this variable from exampleData
      // Requirements: 1.1, 1.2, 1.5, 1.6 - Display example data in canvas with grid layout
      const varPath = payload.fullKey || payload.name;
      result.content = {
        type: "gjsSubGrid",
        classes: [SUBGRID_CLASS],
        attributes: {
          "data-variable": varPath,
          "data-variable-type": payload.parentType || payload.type || "data",
          class: SUBGRID_CLASS,
        },
        styles: `
          .${SUBGRID_CLASS} {
            display: ${SUBGRID_RULE_STYLE.display};
            grid-template-columns: ${SUBGRID_RULE_STYLE["grid-template-columns"]};
            gap: ${SUBGRID_RULE_STYLE.gap};
            grid-column: ${SUBGRID_RULE_STYLE["grid-column"]};
            padding: ${SUBGRID_RULE_STYLE.padding};
          }
        `,
        components: [
          {
            type: "text",
            tagName: "p",
            draggable: false,
            components: [
              [
                {
                  type: "text",
                  tagName: "span",
                  selectable: true,
                  editable: false,
                  draggable: false,
                  attributes: {
                    "data-label-key": payload.name,
                    title: payload.name,
                    contenteditable: "false",
                  },
                  content: payload.displayLabel || payload.name,
                },
              ],
            ],
          },
          {
            type: "text",
            tagName: "p",
            editable: true,
            draggable: false,
            components: [
              {
                type: "textnode",
                content: ": ",
              },
              {
                type: "text",
                tagName: "span",
                selectable: true,
                editable: false,
                draggable: false,
                attributes: {
                  "data-token":
                    payload.formattedToken ||
                    buildVariableToken({
                      variableType: payload.type,
                      parentType: payload.parentType,
                      variablePath: varPath,
                      keyName: payload.name,
                    }),
                  title:
                    payload.formattedToken ||
                    buildVariableToken({
                      variableType: payload.type,
                      parentType: payload.parentType,
                      variablePath: varPath,
                      keyName: payload.name,
                    }),
                  contenteditable: "false",
                },
                content: getSimplifiedTokenDisplay(
                  payload.formattedToken ||
                    buildVariableToken({
                      variableType: payload.type,
                      parentType: payload.parentType,
                      variablePath: varPath,
                      keyName: payload.name,
                    }),
                  varPath,
                ),
              },
            ],
          },
        ],
      };
    }
  });
  editor.on("canvas:drop", (_sorter, model) => {
    // model = komponen utama yang baru dibuat dari result.content
    // opts berisi info konteks

    // Di beberapa versi GrapesJS:
    // opts = { event, x, y, target, index, ... }

    // const { target } = opts || {};

    if (!model) return;
    if (model.getType() != "gjsSubGrid") {
      return;
    }
    const parent = model.parent();
    if (!parent) return;
    if (parent.getType() === "gjsSubGrid") {
      model.remove();
      toast.error(
        t("core.printTemplate.editor.invalid_drop_target") ||
          "Invalid drop target for variable component.",
      );
      return;
    }
    if (parent.getType() !== "gjsGrid") {
      const coll = parent.components();
      const oldIndex = coll.indexOf(model);
      const wrapper = coll.add(
        {
          type: "gjsGrid",
          classes: [GRID_CLASS],
          attributes: {
            class: GRID_CLASS,
          },

          styles: `
          .${GRID_CLASS} {
            display: ${GRID_RULE_STYLE.display};
            grid-template-columns: ${GRID_RULE_STYLE["grid-template-columns"]};
            column-gap: ${GRID_RULE_STYLE["column-gap"]};
            padding-top: ${GRID_RULE_STYLE["padding-top"]};
            padding-bottom: ${GRID_RULE_STYLE["padding-bottom"]};
          }
        `,
        },
        { at: oldIndex },
      );
      model.move(wrapper, { at: 0 });
    }

    editor.select(model);
  });
}

/**
 * Strip editor-only styles for .gjs-static-html-wrapper from exported CSS.
 * Removes the border/outline rule and the ::before pseudo-element rule
 * that are only meant for the canvas editing experience.
 * (Requirements: 24.3)
 * @param {string} css
 * @returns {string}
 */
function stripEditorOnlyWrapperStyles(css) {
  if (typeof css !== "string" || !css.trim()) {
    return css;
  }

  // Remove .gjs-static-html-wrapper rule block (border, border-radius, padding, min-height, position)
  let cleaned = css.replace(
    /\.gjs-static-html-wrapper\s*\{[^}]*border:\s*2px\s+dashed\s+#6366f1[^}]*\}/gi,
    "",
  );

  // Remove .gjs-static-html-wrapper::before rule block
  cleaned = cleaned.replace(
    /\.gjs-static-html-wrapper::before\s*\{[^}]*\}/gi,
    "",
  );

  return cleaned;
}

function getCurrentTemplateFromEditor(editor, fallbackTemplate = {}) {
  if (!editor) {
    return {
      html: fallbackTemplate?.html || "",
      css: fallbackTemplate?.css || "",
    };
  }

  try {
    const page = editor.Pages.getSelected() || editor.Pages.getAll()[0];
    const component = page?.getMainComponent?.();

    const rawCss = component ? editor.getCss({ component }) : editor.getCss();

    return {
      html: formatHandlebarTemplate(
        component ? editor.getHtml({ component }) : editor.getHtml(),
      ),
      css: stripEditorOnlyWrapperStyles(rawCss),
    };
  } catch (error) {
    console.error("Failed to extract current template", error);
    return {
      html: fallbackTemplate?.html || "",
      css: fallbackTemplate?.css || "",
    };
  }
}

function PrintTemplate({
  printTemplate,
  csrfToken,
  dataTableColumns,
  preferences,
  exampleData,
  docInfo,
}) {
  const { t } = useLaravelReactI18n();
  const isMobile = useIsMobile();
  const unitCode = useMemo(
    () => resolveTemplateUnitCode(printTemplate),
    [printTemplate],
  );
  const pageWidth = useMemo(
    () => parseNumericValue(printTemplate?.width, 210),
    [printTemplate?.width],
  );
  const pageHeight = useMemo(
    () => parseNumericValue(printTemplate?.height, 297),
    [printTemplate?.height],
  );
  const pageMargins = useMemo(
    () => ({
      top: parseNumericValue(printTemplate?.margin_top, 0),
      right: parseNumericValue(printTemplate?.margin_right, 0),
      bottom: parseNumericValue(printTemplate?.margin_bottom, 0),
      left: parseNumericValue(printTemplate?.margin_left, 0),
    }),
    [
      printTemplate?.margin_bottom,
      printTemplate?.margin_left,
      printTemplate?.margin_right,
      printTemplate?.margin_top,
    ],
  );
  const canvasStyle = useMemo(
    () => ({
      width: `${pageWidth}${unitCode}`,
      minHeight: `${pageHeight}${unitCode}`,
    }),
    [pageHeight, pageWidth, unitCode],
  );

  // StaticHTMLComponent modal state (Requirements: 6.1, 6.2)
  const [staticHTMLModalOpen, setStaticHTMLModalOpen] = useState(false);
  const [staticHTMLInitial, setStaticHTMLInitial] = useState("");
  const [editingStaticHTMLComponent, setEditingStaticHTMLComponent] =
    useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState({
    html: printTemplate?.html || "",
    css: printTemplate?.css || "",
  });
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const sidebarResizeStateRef = useRef({
    startX: 0,
    startWidth: SIDEBAR_DEFAULT_WIDTH,
  });
  const desktopLayoutStyle = useMemo(
    () => ({
      "--print-editor-sidebar-width": `${sidebarWidth}px`,
    }),
    [sidebarWidth],
  );

  const handleSidebarResizeStart = useCallback(
    (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      sidebarResizeStateRef.current = {
        startX: event.clientX,
        startWidth: sidebarWidth,
      };
      setIsSidebarResizing(true);
    },
    [sidebarWidth],
  );

  useEffect(() => {
    if (!isSidebarResizing) {
      return undefined;
    }

    const handleMouseMove = (event) => {
      const { startX, startWidth } = sidebarResizeStateRef.current;
      const nextWidth = clampSidebarWidth(
        startWidth + (startX - event.clientX),
      );
      setSidebarWidth(nextWidth);
    };

    const stopResizing = () => {
      setIsSidebarResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isSidebarResizing]);

  // Handle save from StaticHTMLComponent modal
  const handleStaticHTMLSave = useCallback(
    (rawHTML, sanitizedHTML, warnings) => {
      if (editingStaticHTMLComponent) {
        // Store raw HTML for re-editing and sanitized HTML for display/output
        editingStaticHTMLComponent.set("customHTML", rawHTML);
        editingStaticHTMLComponent.set("sanitizedHTML", sanitizedHTML);
        editingStaticHTMLComponent.set(
          "sanitizationWarnings",
          Array.isArray(warnings) ? warnings : [],
        );
        // Update canvas display with sanitized content
        if (sanitizedHTML) {
          editingStaticHTMLComponent.components(sanitizedHTML);
        }
      }
      setEditingStaticHTMLComponent(null);
    },
    [editingStaticHTMLComponent],
  );

  const onEditor = (editor) => {
    let isBootstrapping = true;
    let removeCanvasEmptyClickListener = null;
    let clearSelectionTimeoutId = null;

    const applyBodyStyle = () => {
      const frame = editor.Canvas.getFrameEl();
      if (!frame) {
        return;
      }

      const doc = frame.contentDocument || frame.contentWindow.document;
      if (!doc?.body) {
        return;
      }

      const body = doc.body;
      body.style.margin = "0";
      body.style.boxSizing = "border-box";
      body.style.padding = `${pageMargins.top}${unitCode} ${pageMargins.right}${unitCode} ${pageMargins.bottom}${unitCode} ${pageMargins.left}${unitCode}`;
      body.style.minHeight = `${pageHeight}${unitCode}`;
      body.style.backgroundColor = "#fff";
      body.style.fontFamily = getSafePrintFontFamily(
        printTemplate?.font_family,
      );
      body.style.color = "#111827";

      let styleEl = doc.getElementById("print-template-editor-style");
      if (!styleEl) {
        styleEl = doc.createElement("style");
        styleEl.id = "print-template-editor-style";
        doc.head.appendChild(styleEl);
      }

      styleEl.innerHTML = `
        *, *::before, *::after {
          box-sizing: border-box;
        }
        p {
          margin-top: 2px;
          margin-bottom: 2px;
        }
        [data-gjs-type]:not([data-gjs-type=""]) {
          outline: 1px dashed transparent;
          padding: 2px;
          margin: 1px 0;
          min-height: 8px;
          transition: outline-color 0.15s ease-in-out;
        }
        [data-gjs-type]:hover {
          outline-color: rgba(59, 130, 246, 0.35);
        }
        .gjs-selected {
          outline-color: rgba(59, 130, 246, 0.7) !important;
        }
      `;

      bindCanvasEmptyClickToClearSelection();
    };

    const bindCanvasEmptyClickToClearSelection = () => {
      const frameEl = editor.Canvas.getFrameEl();
      const frameDocument =
        frameEl?.contentDocument || frameEl?.contentWindow?.document;
      const frameBody = frameDocument?.body;
      const frameWindow = frameDocument?.defaultView || window;

      if (!frameBody) {
        return;
      }

      removeCanvasEmptyClickListener?.();

      if (clearSelectionTimeoutId !== null) {
        frameWindow.clearTimeout(clearSelectionTimeoutId);
        clearSelectionTimeoutId = null;
      }

      const handleCanvasClick = (event) => {
        const shouldClearSelection = shouldClearSelectionOnCanvasClick({
          target: event?.target,
          wrapperElement: editor.getWrapper()?.view?.el || null,
        });

        if (!shouldClearSelection) {
          return;
        }

        clearSelectionTimeoutId = frameWindow.setTimeout(() => {
          clearSelectionTimeoutId = null;
          removeAllSelectedComponents(editor);
        }, 0);
      };

      frameDocument.addEventListener("click", handleCanvasClick);
      frameDocument.addEventListener("pointerup", handleCanvasClick);
      removeCanvasEmptyClickListener = () => {
        frameDocument.removeEventListener("click", handleCanvasClick);
        frameDocument.removeEventListener("pointerup", handleCanvasClick);
        if (clearSelectionTimeoutId !== null) {
          frameWindow.clearTimeout(clearSelectionTimeoutId);
          clearSelectionTimeoutId = null;
        }
        removeCanvasEmptyClickListener = null;
      };
    };

    editor.on("load", applyBodyStyle);
    editor.on("canvas:frame:load:body", bindCanvasEmptyClickToClearSelection);
    editor.on("canvas:frame:unload", () => {
      removeCanvasEmptyClickListener?.();
    });
    editor.on("destroy", () => {
      removeCanvasEmptyClickListener?.();
    });
    variableDropListener(editor, {
      t,
      exampleData,
      locale: printTemplate?.default_language,
    });

    // Register multi-function container component type (Requirements: 17.2, 17.3, 17.4, 17.5)
    editor.DomComponents.addType("multiContainer", {
      model: {
        defaults: {
          tagName: "div",
          droppable: true,
          traits: [
            {
              type: "select",
              name: "tagName",
              label: t("core.printTemplate.editor.html_tag"),
              options: [
                { value: "div", name: "div" },
                { value: "section", name: "section" },
                { value: "article", name: "article" },
                { value: "aside", name: "aside" },
                { value: "header", name: "header" },
                { value: "footer", name: "footer" },
                { value: "main", name: "main" },
                { value: "nav", name: "nav" },
                { value: "span", name: "span" },
              ],
              changeProp: true,
            },
          ],
        },
      },
    });

    // Register multi-function container block (Requirements: 17.1, 17.5)
    editor.BlockManager.add("multiContainer", {
      label: t("core.printTemplate.editor.multi_container"),
      category: "Basic",
      content: { type: "multiContainer" },
    });

    editor.on("load", () => {
      isBootstrapping = false;
    });

    if (isMobile) {
      toast.info(
        t("core.printTemplate.editor.mobile_mode_info") ||
          "Mode mobile: drag & drop dan perubahan struktur layout hanya tersedia di desktop.",
      );
      editor.getWrapper()?.set({
        droppable: false,
      });

      editor.Commands.add("core:mobile-structural-block", {
        run() {
          toast.info(
            t("core.printTemplate.editor.desktop_only_structure") ||
              "Fitur perubahan struktur hanya tersedia di desktop.",
          );
        },
      });

      editor.Keymaps.add(
        "core:mobile-block-delete",
        "backspace, del",
        "core:mobile-structural-block",
        {
          prevent: true,
        },
      );

      editor.on("component:add", (component) => {
        if (isBootstrapping) {
          return;
        }
        component.remove();
        toast.info(
          t("core.printTemplate.editor.desktop_only_add") ||
            "Menambah komponen baru hanya tersedia di desktop.",
        );
      });

      editor.on("component:remove", () => {
        if (isBootstrapping) {
          return;
        }
        toast.info(
          t("core.printTemplate.editor.desktop_only_remove") ||
            "Menghapus komponen hanya tersedia di desktop.",
        );
      });
    }

    if (!exampleData || Object.keys(exampleData || {}).length === 0) {
      toast.info(
        t("core.printTemplate.editor.no_example_data") ||
          "Data contoh belum tersedia untuk model ini. Preview dapat menampilkan placeholder.",
      );
    }

    // Listen for staticHTML:edit event to open the modal (Requirements: 6.1, 6.2)
    editor.on("staticHTML:edit", (component) => {
      setEditingStaticHTMLComponent(component);
      setStaticHTMLInitial(component.get("customHTML") || "");
      setStaticHTMLModalOpen(true);
    });

    const openPreview = () => {
      const currentTemplate = getCurrentTemplateFromEditor(editor, {
        html: printTemplate?.html || "",
        css: printTemplate?.css || "",
      });

      setPreviewTemplate(currentTemplate);
      setPreviewModalOpen(true);
    };

    const saveTemplate = async () => {
      editor.trigger("template:save-start");

      try {
        const currentTemplate = getCurrentTemplateFromEditor(editor, {
          html: printTemplate?.html || "",
          css: printTemplate?.css || "",
        });
        const validation = validateHandlebarTemplate(currentTemplate.html);
        if (!validation.valid) {
          toast.error(
            `${t("core.printTemplate.editor.template_invalid") || "Template tidak valid"}: ${validation.message}`,
          );
          editor.trigger("template:save-error", validation.message);
          return;
        }

        await editor.store();
        editor.trigger("template:save-success");
      } catch (error) {
        console.error("Failed to save template", error);
        editor.trigger("template:save-error", error);
      } finally {
        editor.trigger("template:save-finish");
      }
    };

    editor.Commands.add("core:save-template", {
      run() {
        void saveTemplate();
      },
    });

    editor.Commands.add("core:preview-template", {
      run() {
        openPreview();
      },
    });

    editor.Keymaps.add(
      "core:save-template-shortcut",
      "command+s, ctrl+s",
      "core:save-template",
      {
        prevent: true,
      },
    );

    editor.Keymaps.add(
      "core:preview-template-shortcut",
      "command+shift+p, ctrl+shift+p",
      "core:preview-template",
      {
        prevent: true,
      },
    );
    editor.on("preview:open", openPreview);
    editor.on("storage:error:load", () => {
      toast.error(
        t("core.printTemplate.editor.load_error") ||
          "Gagal memuat template. Menggunakan template kosong.",
        {
          action: {
            label: t("core.printTemplate.editor.reload") || "Muat Ulang",
            onClick: () => window.location.reload(),
          },
        },
      );

      editor.loadProjectData({
        pages: [
          {
            name: "Page 1",
            component: "<div></div>",
            styles: "",
          },
        ],
      });
    });
    editor.on("storage:error:store", () => {
      toast.error(
        t("core.printTemplate.editor.save_error") ||
          "Gagal menyimpan template karena masalah jaringan.",
      );
    });

    if (!printTemplate.is_letter_head && printTemplate.letter_head) {
      initHandlebar(t);
      const template = printTemplate.letter_head;
      const css =
        (template.css?.replace("body", "div") ?? "") +
        ".resize-divider{display:none !important;}";
      mountLetterheadPreview(editor, {
        html: Handlebars.compile(
          "{{#with preferences}}" +
            (template?.html?.replace("body", "div") ?? "") +
            "{{/with}}",
        )({
          dataTableColumns,
          preferences,
        }),
        css,
      });
    }
  };

  return (
    <AppLayout>
      <Head title={`${t(printTemplate.title)} - Print Editor`} />
      <GjsEditor
        grapesjs={grapesjs}
        options={{
          telemetry: false,
          undoManager: { trackSelection: false },
          canvas: {
            allowExternalDrop: true,
            styles: [
              "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
            ],
            scripts: ["https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"],
          },
          deviceManager: {
            devices: [
              {
                id: "full",
                name: "Full",
              },
            ],
          },
          storageManager: {
            type: "remote",
            // ...
            stepsBeforeSave: 1,
            autosave: true,
            options: {
              remote: {
                headers: {
                  "X-CSRF-TOKEN": csrfToken,
                  "X-Requested-With": "XMLHttpRequest",
                  Accept: "application/json",
                  "Content-Type": "application/json",
                }, // Custom headers for the remote storage request
                urlLoad: window.route("printTemplates.show", {
                  printTemplates: printTemplate.id,
                }), // Endpoint URL where to load data project
                urlStore: window.route("printTemplates.store"),
              },
            },
            onStore: (data, editor) => {
              const pagesHtml = editor.Pages.getAll().map((page) => {
                const component = page.getMainComponent();
                return {
                  html: formatHandlebarTemplate(editor.getHtml({ component })),
                  css: stripEditorOnlyWrapperStyles(
                    editor.getCss({ component }),
                  ),
                };
              });
              return {
                id: printTemplate.id,
                idSaved: generateRandom(8),
                data,
                pagesHtml,
              };
            },
          },
        }}
        plugins={[
          gjsTable,
          gjsDocHeader,
          (editor) =>
            gjsBlockBasic(editor, {
              blocks: ["text", "link", "image", "map"],
            }),
          (editor) => gjsRelationsTable(editor),
          gjsStaticHTML,
          flattenMediaPlugin,
        ]}
        onEditor={onEditor}
      >
        {isMobile ? (
          <WithEditor>
            <MobileEditor
              canvasClassName="h-full w-full rounded-md bg-background shadow-sm"
              canvasStyle={canvasStyle}
            />
          </WithEditor>
        ) : (
          <div
            className="grid h-full w-full gap-3 md:max-xl:grid-cols-1 lg:grid-cols-[minmax(0,1fr)_12px_var(--print-editor-sidebar-width)] lg:gap-0"
            style={desktopLayoutStyle}
          >
            <div className="flex h-full min-h-0 w-full grow flex-col gap-3 lg:pr-2">
              <div className="rounded-xl border border-border bg-card px-2 py-1.5 shadow-xs">
                <WithEditor>
                  <TopBar />
                </WithEditor>
              </div>
              <div className="flex h-full min-h-0 grow touch-pan-y flex-col overflow-auto rounded-xl border border-border bg-muted/20 p-2 text-center md:max-xl:min-h-[60vh] md:max-xl:p-1.5">
                <Canvas
                  className="h-full w-full max-w-4xl rounded-md bg-background shadow-sm md:max-xl:max-w-full"
                  style={canvasStyle}
                />
              </div>
            </div>
            <div className="relative hidden h-full min-h-0 lg:flex lg:items-stretch">
              <button
                type="button"
                aria-label="Resize sidebar"
                onMouseDown={handleSidebarResizeStart}
                className="group flex h-full w-3 cursor-col-resize touch-none items-center justify-center"
              >
                <span
                  className={`h-[calc(100%-12px)] w-px rounded-full transition-colors ${
                    isSidebarResizing
                      ? "bg-primary"
                      : "bg-border group-hover:bg-primary/70"
                  }`}
                />
              </button>
            </div>
            <div className="h-full min-h-0 w-full lg:pl-2">
              <WithEditor>
                <Sidebar />
              </WithEditor>
            </div>
          </div>
        )}
      </GjsEditor>
      {/* StaticHTML Code Editor Modal (Requirements: 6.1, 6.2, 6.7, 6.8) */}
      <StaticHTMLComponent
        open={staticHTMLModalOpen}
        onOpenChange={(open) => {
          setStaticHTMLModalOpen(open);
          if (!open) setEditingStaticHTMLComponent(null);
        }}
        initialHTML={staticHTMLInitial}
        onSave={handleStaticHTMLSave}
      />
      <PreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        printTemplate={printTemplate}
        template={previewTemplate}
        dataTableColumns={dataTableColumns}
        preferences={preferences}
        docInfo={docInfo}
      />
    </AppLayout>
  );
}

export default PrintTemplate;
