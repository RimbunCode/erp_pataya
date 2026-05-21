import "grapesjs/dist/css/grapes.min.css";

import GjsEditor, { Canvas, WithEditor } from "@grapesjs/react";
import React, { useCallback, useMemo, useState } from "react";

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

function formatHandlebarTemplate(template = "") {
  if (typeof template !== "string" || !template.trim()) {
    return "";
  }

  const normalized = template
    .replace(/\{\{#(each|if|unless)([^}]*)\}\}/g, "\n$&\n")
    .replace(/\{\{\/(each|if|unless)\}\}/g, "\n$&\n")
    .replace(/\n{2,}/g, "\n");

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
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

function variableDropListener(editor, { t, exampleData }) {
  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;
  editor.DomComponents.addType("grid", {
    model: {
      defaults: {
        droppable: true,
        tagName: "div",
        attributes: {
          class: "gjs-grid",
        },
        styles: `
          .gjs-grid {
            display: grid;
            grid-template-columns: max-content 1fr;
            column-gap: 12px;
            padding-top: 10px;
            padding-bottom: 10px;
          }
        `,
      },
    },
  });
  editor.DomComponents.addType("subGrid", {
    model: {
      defaults: {
        droppable: false,
        draggable: true,
        selectable: true,
        layerable: true,
        tagName: "div",
        attributes: {
          class: "gjs-subgrid",
        },
        styles: `
          .gjs-subgrid {
            display: grid;
            grid-template-columns: subgrid;
            gap: 8px;
            grid-column: 1 / -1;
            padding: 0px;
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
          (variableType === "preferences"
            ? `{{companyDetail "${labelKey}"}}`
            : `{{${variablePath}}}`);

        const labelTypeArg =
          variableType === "preferences" ? ' type="companyDetail"' : "";

        return `
<div data-variable="${variablePath}" data-variable-type="${variableType}">
  <p>{{label "${labelKey}"${labelTypeArg}}}</p>
  <p>: ${token}</p>
</div>
        `.trim();
      },
    },
  });
  // 1. Intersep data drop dari luar
  editor.on("canvas:dragdata", (dataTransfer, result) => {
    const json = dataTransfer.getData("variable/json");
    if (!json) return;

    let payload;
    try {
      payload = JSON.parse(json);
    } catch (err) {
      console.error("Invalid variable/json payload", err);
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
      let exampleValue = payload.exampleValue || null;

      // Try to resolve from exampleData if not already provided
      if (!exampleValue && exampleData) {
        const parts = varPath.split(".");
        let current = exampleData;
        for (const part of parts) {
          if (current == null || typeof current !== "object") {
            current = null;
            break;
          }
          current = current[part];
        }
        if (current != null && typeof current !== "object") {
          exampleValue = String(current);
        }
      }

      // For preferences, resolve from preferences in exampleData
      if (
        !exampleValue &&
        payload.parentType === "preferences" &&
        exampleData?.preferences
      ) {
        const prefValue = exampleData.preferences[payload.name];
        if (prefValue != null) {
          exampleValue = String(prefValue);
        }
      }

      result.content = {
        type: "subGrid",
        attributes: {
          "data-variable": varPath,
          "data-variable-type": payload.parentType || payload.type || "data",
        },
        components: [
          {
            type: "text",
            tagName: "p",
            content: `{{label "${payload.name}" ${payload.parentType === "preferences" ? `type="companyDetail"` : ""}}}`,
            attributes: {
              "data-label-key": payload.name,
              title: `{{label "${payload.name}"}}`,
            },
          },
          {
            type: "text",
            tagName: "p",
            content: `: ${exampleValue || `{{${payload.parentType === "preferences" ? `companyDetail "${payload.name}"` : varPath}}}`}`,
            attributes: {
              "data-token":
                payload.formattedToken ||
                `{{${payload.parentType === "preferences" ? `companyDetail "${payload.name}"` : varPath}}}`,
              title:
                payload.formattedToken ||
                `{{${payload.parentType === "preferences" ? `companyDetail "${payload.name}"` : varPath}}}`,
            },
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

    // console.log({ target, model, parent: model.parent() });

    if (!model) return;
    if (model.getType() != "subGrid") {
      return;
    }
    const parent = model.parent();
    if (!parent) return;
    if (parent.getType() === "subGrid") {
      model.remove();
      toast.error("Invalid drop target for variable component.");
      return;
    }
    if (parent.getType() !== "grid") {
      const coll = parent.components();
      const oldIndex = coll.indexOf(model);
      const wrapper = coll.add(
        {
          type: "grid",
        },
        { at: oldIndex },
      );
      model.move(wrapper, { at: 0 });
    }

    editor.select(model);
  });
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

    return {
      html: formatHandlebarTemplate(
        component ? editor.getHtml({ component }) : editor.getHtml(),
      ),
      css: component ? editor.getCss({ component }) : editor.getCss(),
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
      `;
    };
    editor.on("load", applyBodyStyle);
    variableDropListener(editor, { t, exampleData });

    editor.on("load", () => {
      isBootstrapping = false;
    });

    if (isMobile) {
      toast.info(
        "Mode mobile: drag & drop dan perubahan struktur layout hanya tersedia di desktop.",
      );
      editor.getWrapper()?.set({
        droppable: false,
      });

      editor.Commands.add("core:mobile-structural-block", {
        run() {
          toast.info("Fitur perubahan struktur hanya tersedia di desktop.");
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
        toast.info("Menambah komponen baru hanya tersedia di desktop.");
      });

      editor.on("component:remove", () => {
        if (isBootstrapping) {
          return;
        }
        toast.info("Menghapus komponen hanya tersedia di desktop.");
      });
    }

    if (!exampleData || Object.keys(exampleData || {}).length === 0) {
      toast.info(
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
          toast.error(`Template tidak valid: ${validation.message}`);
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
      toast.error("Gagal memuat template. Silakan muat ulang halaman.");
    });
    editor.on("storage:error:store", () => {
      toast.error("Gagal menyimpan template karena masalah jaringan.");
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
                urlStore: `https://erp.test/settings/printTemplates/`, // Endpoint URL where to store data project
                urlLoad: `https://erp.test/settings/printTemplates/${printTemplate.id}`, // Endpoint URL where to load data project
              },
            },
            onStore: (data, editor) => {
              const pagesHtml = editor.Pages.getAll().map((page) => {
                const component = page.getMainComponent();
                return {
                  html: formatHandlebarTemplate(editor.getHtml({ component })),
                  css: editor.getCss({ component }),
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
              blocks: [
                "column1",
                "column2",
                "column3",
                "column3-7",
                "text",
                "link",
                "image",
                "map",
              ],
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
          <div className="grid h-full w-full gap-3 md:max-xl:grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
            <div className="flex h-full min-h-0 w-full grow flex-col gap-3">
              <div className="rounded-xl border border-border bg-card px-2 py-1.5 shadow-xs">
                <WithEditor>
                  <TopBar />
                </WithEditor>
              </div>
              <div className="flex h-full min-h-0 grow touch-pan-y flex-col overflow-auto rounded-xl border border-border bg-muted/20 p-2 text-center md:max-xl:min-h-[60vh]">
                <Canvas
                  className="h-full w-full max-w-4xl rounded-md bg-background shadow-sm"
                  style={canvasStyle}
                />
              </div>
            </div>
            <div className="h-full min-h-0">
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
      />
    </AppLayout>
  );
}

export default PrintTemplate;
