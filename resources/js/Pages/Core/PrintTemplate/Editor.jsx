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
import gjsRelationsTable from "@/lib/gjsRelationsTable";
import gjsStaticHTML from "@/lib/gjsStaticHTML";
import gjsTable from "@/lib/gjsTable";
import grapesjs from "grapesjs";
import { initHandlebar } from "@/lib/initHandlebar";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { toast } from "sonner";
import {
  removeAllSelectedComponents,
  shouldClearSelectionOnCanvasClick,
} from "./utils/canvasSelectionUtils";
import {
  clampSidebarWidth,
  resolveTemplateUnitCode,
  parseNumericValue,
  validateHandlebarTemplate,
  SIDEBAR_DEFAULT_WIDTH,
} from "./utils/editorHelpers";
import { variableDropListener } from "./utils/variableDropUtils";
import { mountLetterheadPreview } from "./utils/letterheadPreviewUtils";
import {
  stripEditorOnlyWrapperStyles,
  getCurrentTemplateFromEditor,
} from "./utils/templateExportUtils";
import { formatHandlebarTemplate } from "./utils/templateFormatUtils";

/**
 * Komponen halaman utama Editor PrintTemplate.
 * Menyediakan antarmuka visual untuk mengedit template cetak menggunakan GrapesJS,
 * termasuk drag-and-drop variabel, preview letterhead, dan penyimpanan template.
 *
 * @module Editor
 * @param {Object} props - Props komponen
 * @param {Object} props.printTemplate - Konfigurasi template cetak (dimensi, margin, font, HTML/CSS)
 * @param {string} props.csrfToken - Token CSRF untuk request penyimpanan
 * @param {Array} props.dataTableColumns - Kolom tabel data untuk relasi
 * @param {Object} props.preferences - Preferensi pengguna untuk rendering template
 * @param {Object} props.docInfo - Informasi dokumen untuk preview
 */

function PrintTemplate({
  printTemplate,
  csrfToken,
  dataTableColumns,
  preferences,
  docInfo,
}) {
  const { t } = useLaravelReactI18n();
  const isMobile = useIsMobile();
  // useMemo: Menghitung kode unit pengukuran dari konfigurasi template
  // Dipicu ulang saat objek printTemplate berubah
  const unitCode = useMemo(
    () => resolveTemplateUnitCode(printTemplate),
    [printTemplate],
  );
  // useMemo: Menghitung lebar halaman dari konfigurasi template (default 210mm)
  const pageWidth = useMemo(
    () => parseNumericValue(printTemplate?.width, 210),
    [printTemplate?.width],
  );
  // useMemo: Menghitung tinggi halaman dari konfigurasi template (default 297mm)
  const pageHeight = useMemo(
    () => parseNumericValue(printTemplate?.height, 297),
    [printTemplate?.height],
  );
  // useMemo: Menghitung margin halaman dari konfigurasi template (default 0 untuk semua sisi)
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
  // useMemo: Menghitung style dimensi canvas berdasarkan lebar, tinggi, dan unit halaman
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
  // useMemo: Menghitung style CSS variable untuk lebar sidebar di layout desktop
  const desktopLayoutStyle = useMemo(
    () => ({
      "--print-editor-sidebar-width": `${sidebarWidth}px`,
    }),
    [sidebarWidth],
  );

  // useCallback: Handler untuk memulai resize sidebar via drag mouse
  // Dipicu saat tombol kiri mouse ditekan pada handle resize
  // Menyimpan posisi awal dan lebar awal untuk kalkulasi delta
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

  // useEffect: Mengelola event listener mousemove/mouseup selama proses resize sidebar
  // Aktif hanya saat isSidebarResizing bernilai true
  // Mengubah cursor dan menonaktifkan text selection selama resize berlangsung
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

  // useCallback: Handler penyimpanan dari modal StaticHTMLComponent
  // Menyimpan HTML mentah untuk re-editing dan HTML tersanitasi untuk output
  // Memperbarui tampilan canvas dengan konten tersanitasi
  const handleStaticHTMLSave = useCallback(
    (rawHTML, sanitizedHTML, warnings) => {
      if (editingStaticHTMLComponent) {
        editingStaticHTMLComponent.set("customHTML", rawHTML);
        editingStaticHTMLComponent.set("sanitizedHTML", sanitizedHTML);
        editingStaticHTMLComponent.set(
          "sanitizationWarnings",
          Array.isArray(warnings) ? warnings : [],
        );
        if (sanitizedHTML) {
          editingStaticHTMLComponent.components(sanitizedHTML);
        }
      }
      setEditingStaticHTMLComponent(null);
    },
    [editingStaticHTMLComponent],
  );

  // Handler inisialisasi editor GrapesJS - dipanggil sekali saat editor siap
  // Mengatur style body canvas, listener klik untuk clear selection,
  // registrasi variableDropListener, dan konfigurasi mode mobile/desktop
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

      // Ensure Bootstrap CSS is loaded in the canvas iframe head
      // GrapesJS canvas.styles config may not persist across frame reloads,
      // so we manually inject the <link> as a reliable fallback.
      if (!doc.getElementById("bootstrap-css-canvas")) {
        const bootstrapLink = doc.createElement("link");
        bootstrapLink.id = "bootstrap-css-canvas";
        bootstrapLink.rel = "stylesheet";
        bootstrapLink.href =
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
        doc.head.appendChild(bootstrapLink);
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
    editor.on("canvas:frame:load:body", applyBodyStyle);
    editor.on("canvas:frame:load:body", bindCanvasEmptyClickToClearSelection);
    editor.on("canvas:frame:unload", () => {
      removeCanvasEmptyClickListener?.();
    });
    editor.on("destroy", () => {
      removeCanvasEmptyClickListener?.();
    });
    variableDropListener(editor, {
      t,
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
