import "grapesjs/dist/css/grapes.min.css";

import GjsEditor, { Canvas, WithEditor } from "@grapesjs/react";
import React, { useEffect, useState } from "react";

import AppLayout from "@/Layouts/AppLayout";
import Handlebars from "handlebars";
import { Head } from "@inertiajs/react";
import Sidebar from "./Components/Sidebar";
import TopBar from "./Components/TopBar";
import flattenMediaPlugin from "@/lib/flattenMediaPlugin";
import { generateRandom } from "@/lib/utils";
import gjsBlockBasic from "grapesjs-blocks-basic";
import gjsDocHeader from "@/lib/gjsDocHeader";
import gjsRelationsTable from "@/lib/gjsRelationsTable";
import gjsTable from "@/lib/gjsTable";
import grapesjs from "grapesjs";
import { initHandlebar } from "@/lib/initHandlebar";
import { useLaravelReactI18n } from "laravel-react-i18n";

function mountLetterheadPreview(editor, { html, css }) {
  const addPreview = () => {
    const frame = editor.Canvas.getFrameEl();
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc) return;

    const wrapperEl = editor.getWrapper().view?.el;
    if (!wrapperEl) return;

    // 1. SISIPKAN STYLE (sekali saja)
    const styleEl = doc.createElement("style");
    styleEl.id = "letterhead-preview-style";
    styleEl.innerHTML = css || "";
    doc.head.appendChild(styleEl);

    // 2. SISIPKAN HTML PREVIEW (di luar wrapper, TIDAK ikut GrapesJS model)
    const box = doc.createElement("div");
    box.id = "letterhead-preview";

    // penting: tidak ganggu interaksi editor
    box.style.position = "relative";
    box.style.pointerEvents = "none";
    box.style.zIndex = "1";

    box.innerHTML = html || "";

    // taruh sebelum wrapper, jadi seperti header global
    doc.body.insertBefore(box, wrapperEl);
  };

  // panggil saat frame siap (awal & reload)
  editor.on("load", addPreview);

  // kalau editor sudah siap ketika fungsi ini dipanggil
  addPreview();
}

function variableDropListener(editor) {
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

      // 👉 Beritahu GrapesJS: konten yang harus dibuat saat drop
      result.content = {
        type: "gjsRelationsTable",
        attributes: {
          "data-relations": payload.name,
        },
        components: [
          {
            type: "tableHead",
            tagName: "thead",
            selectable: false,
            droppable: false,
            layerable: false,
            editable: false,
            draggable: false,
            components: [
              {
                type: "html-comment",
                attributes: {
                  text: `{{#infoColumns @root.dataTableColumns key="${payload.name}" }}`,
                },
              },
              {
                tagName: "tr",
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                components: [
                  {
                    tagName: "th",
                    content: "#",
                    selectable: false,
                    droppable: false,
                    layerable: false,
                    editable: false,
                    draggable: false,
                    attributes: { "data-id": genId("cell") },
                  },
                  ...columns.map((col) => ({
                    tagName: "th",
                    content: `{{trans ${col.name}}}`,
                    selectable: false,
                    droppable: false,
                    layerable: false,
                    editable: false,
                    draggable: false,
                    attributes: {
                      "data-id": genId("cell"),
                      name: col.name,
                      titleTrans: col.titleTrans,
                      class:
                        "border border-gray-400 px-2 py-1 text-left bg-gray-100",
                    },
                  })),
                ],
              },
              {
                type: "html-comment",
                attributes: { text: `{{/infoColumns}}` },
              },
            ],
          },
          {
            tagName: "tbody",
            selectable: false,
            droppable: false,
            layerable: false,
            editable: false,
            draggable: false,
            components: [
              {
                type: "html-comment",
                attributes: { text: `{{#each ${payload.name}}}` },
              },
              {
                tagName: "tr",
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                components: [
                  {
                    tagName: "td",
                    content: "{{idx}}",
                    selectable: false,
                    droppable: false,
                    layerable: false,
                    editable: false,
                    draggable: false,
                    attributes: { "data-id": genId("cell") },
                  },
                  ...columns.map((col) => ({
                    tagName: "td",
                    content: `{{${
                      col.type === "relation" ? "relation " : ""
                    }${col.name}}}`,
                    selectable: false,
                    droppable: false,
                    layerable: false,
                    editable: false,
                    draggable: false,
                    attributes: {
                      "data-id": genId("cell"),
                      name: col.name,
                      class: "border border-gray-300 px-2 py-1",
                    },
                  })),
                ],
              },
              {
                type: "html-comment",
                attributes: { text: `{{/each}}` },
              },
            ],
          },
        ],
      };
    } else {
      result.content = {
        type: "subGrid",
        components: [
          {
            type: "text",
            tagName: "p",
            content: `{{trans "${payload.name}" ${payload.parentType == "preferences" ? `type="companyDetail"` : ""}}}`,
          },
          {
            type: "text",
            tagName: "p",
            content: `: {{${payload.parentType == "preferences" ? `companyDetail "${payload.name}"` : payload.name}}}`,
          },
        ],
      };
    }
  });
  editor.on("canvas:drop", (sorter, model) => {
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
function PrintTemplate({
  printTemplate,
  csrfToken,
  dataTableColumns,
  preferences,
}) {
  const [editor, setEditor] = useState();
  const { t } = useLaravelReactI18n();
  const onEditor = (editor) => {
    setEditor(editor);
    const applyBodyStyle = () => {
      const body = editor.Canvas.getBody();
      if (!body) return;
      body.style.padding = `24px 24px 24px 24px`;
      body.style.fontFamily = printTemplate.font_family;
      editor.addStyle(`
        p{
          margin-top: 2px;
          margin-bottom: 2px;
        }
      `);
    };
    // editor?.Modal.open({
    //   title: "My title", // string | HTMLElement
    //   content: "My content", // string | HTMLElement
    // });
    editor.on("load", applyBodyStyle);
    variableDropListener(editor);
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

  useEffect(() => {
    console.log(dataTableColumns);
  }, [editor, dataTableColumns]);

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
                  html: editor.getHtml({ component }),
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
          flattenMediaPlugin,
        ]}
        onEditor={onEditor}
      >
        <div className="grid grid-cols-[1fr_minmax(0,256px)] h-full w-full">
          <div className="flex flex-col h-full w-full flex-grow gap-y-2">
            <WithEditor>
              <TopBar />
            </WithEditor>
            <div className="border border-dotted flex flex-col h-full flex-grow overflow-auto w-full text-center">
              <Canvas
                className=" h-full w-full max-w-4xl "
                style={{
                  width: `${printTemplate.width}$${printTemplate?.unit?.code}`,
                }}
              />
            </div>
          </div>
          <div className="h-full">
            <WithEditor>
              <Sidebar />
            </WithEditor>
          </div>
        </div>
      </GjsEditor>
    </AppLayout>
  );
}

export default PrintTemplate;
