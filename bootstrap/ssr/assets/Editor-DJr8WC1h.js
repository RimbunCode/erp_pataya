import { jsxs, jsx } from "react/jsx-runtime";
import GjsEditor, { WithEditor, Canvas } from "@grapesjs/react";
import { useState, useEffect } from "react";
import { A as AppLayout } from "./AppLayout-Drqdr6Z-.js";
import Handlebars from "handlebars";
import { Head } from "@inertiajs/react";
import Sidebar from "./Sidebar-BUGFY30J.js";
import TopBar from "./TopBar-Bgl8cg6L.js";
import { k as generateRandom } from "./utils-ClCZGsDL.js";
import gjsBlockBasic from "grapesjs-blocks-basic";
import grapesjs from "grapesjs";
import { i as initHandlebar } from "./initHandlebar-DkcLBbFK.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "lucide-react";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "class-variance-authority";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./input-wk3Ou7wI.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
import "zustand";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./CustomBlockManager-3I5p96C9.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./CustomLayerManager-Dizp7WF_.js";
import "./LayerItem-D8wdUPwX.js";
import "./CustomStyleManager-BKIr7GqM.js";
import "./checkbox-C_BEU5E4.js";
import "@radix-ui/react-checkbox";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "react-detect-click-outside";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "./StylePropertyField-D6MlQOpI.js";
import "@radix-ui/react-radio-group";
import "./RelationsInspector-lmhuIleU.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
function flattenMediaPlugin(editor, { stripOnStore = true } = {}) {
  var _a;
  const MEDIA_RE = /@media[^{]+\{([\s\S]*?)\}\s*/g;
  const stripMedia = (css) => typeof css === "string" ? css.replace(MEDIA_RE, "$1") : css;
  const bindRuntimeScrubber = () => {
    var _a2, _b, _c;
    const frame = (_b = (_a2 = editor.Canvas).getFrameEl) == null ? void 0 : _b.call(_a2);
    const doc = (frame == null ? void 0 : frame.contentDocument) || ((_c = frame == null ? void 0 : frame.contentWindow) == null ? void 0 : _c.document);
    if (!doc) return () => {
    };
    const scrubAll = () => {
      const styles = doc.querySelectorAll("style");
      styles.forEach((node) => {
        const before = node.textContent || "";
        const after = stripMedia(before);
        if (after !== before) node.textContent = after;
      });
    };
    scrubAll();
    const obs = new MutationObserver(() => scrubAll());
    obs.observe(doc.head || doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true
    });
    const rerun = () => scrubAll();
    editor.on("component:styleUpdate", rerun);
    editor.on("styleManager:change", rerun);
    editor.on("change:device", rerun);
    editor.on("canvas:frame:load", () => {
      setTimeout(() => {
        obs.disconnect();
        bindRuntimeScrubber();
      }, 0);
    });
    return () => {
      obs.disconnect();
      editor.off("component:styleUpdate", rerun);
      editor.off("styleManager:change", rerun);
      editor.off("change:device", rerun);
    };
  };
  editor.on("load", () => {
    const unbind = bindRuntimeScrubber();
    editor.once("destroy", () => unbind && unbind());
  });
  if (stripOnStore) {
    const sm = (_a = editor.getConfig()) == null ? void 0 : _a.storageManager;
    if (sm) {
      const userOnStore = sm.onStore;
      sm.onStore = (data, ed) => {
        var _a2;
        const out = userOnStore ? userOnStore(data, ed) : data;
        if (Array.isArray(out == null ? void 0 : out.pagesHtml)) {
          out.pagesHtml = out.pagesHtml.map((p) => ({
            ...p,
            css: stripMedia(p.css)
          }));
        }
        if ((_a2 = out == null ? void 0 : out.data) == null ? void 0 : _a2.css) out.data.css = stripMedia(out.data.css);
        return out;
      };
    }
  }
}
function gjsDocHeader(editor) {
  const domc = editor.DomComponents;
  const cmds = editor.Commands;
  cmds.add("swap-header-layout", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected) return;
      const headerModel = selected.closest && selected.closest(".doc-header") ? selected.closest(".doc-header") : selected.find && selected.find(".doc-header")[0];
      if (!headerModel) return;
      const classes = headerModel.getClasses();
      const isReversed = classes.includes("reverse-layout");
      if (isReversed) {
        headerModel.removeClass("reverse-layout");
      } else {
        headerModel.addClass("reverse-layout");
      }
      ed.trigger("component:update", headerModel);
      ed.store();
    }
  });
  domc.addType("gjsDocHeader", {
    model: {
      defaults: {
        tagName: "header",
        attributes: { class: "gjs-doc-header" },
        droppable: false,
        draggable: true,
        styles: `
          .gjs-doc-header {
            width: 100%;
            border-bottom: 2px solid #444;
            margin-bottom: 20px;
            background: #fff;
          }
          .doc-header {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
          .doc-header.reverse-layout {
            flex-direction: row-reverse;
          }
          .doc-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10px;
            min-width: 100px;
            flex: 0 0 auto;
          }
          .doc-logo img {
            max-height: 80px;
            width: auto;
            height: auto;
            display: block;
            cursor: pointer;
          }
          .resize-divider {
            align-self: stretch;
            width: 6px;
            cursor: ew-resize;
            background: #ccc;
          }
          .resize-divider:hover {
            background: #888;
          }
          .doc-info {
            flex: 1;
            padding: 8px 12px;
          }
          .doc-info h2 {
            margin:0;
          }
        `,
        components: [
          {
            tagName: "div",
            attributes: { class: "doc-header" },
            components: [
              {
                tagName: "div",
                attributes: { class: "doc-logo" },
                draggable: false,
                dropable: false,
                editable: false,
                toolbar: [
                  {
                    attributes: {
                      class: "fa fa-exchange",
                      title: "Tukar posisi logo"
                    },
                    command: "swap-header-layout"
                  }
                ],
                components: [
                  {
                    type: "image",
                    draggable: false,
                    dropable: false,
                    selectable: false,
                    attributes: {
                      src: "/company-logo",
                      alt: "Company Logo"
                    },
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-exchange",
                          title: "Tukar posisi logo"
                        },
                        command: "swap-header-layout"
                      }
                    ]
                  }
                ]
              },
              {
                tagName: "div",
                attributes: { class: "resize-divider" },
                dropable: false,
                editable: false,
                toolbar: []
              },
              {
                tagName: "div",
                attributes: {
                  class: "doc-info"
                },
                components: [
                  {
                    type: "text",
                    tagName: "h2",
                    content: "{{company_name}}"
                  },
                  {
                    type: "text",
                    tagName: "p",
                    content: "{{street}}, {{city}}, {{state}}, {{country_name}}. {{zip_code}}"
                  },
                  {
                    type: "text",
                    tagName: "p",
                    content: "Telp: {{phone}}"
                  },
                  {
                    type: "text",
                    tagName: "p",
                    content: "Email: {{email}}"
                  }
                ]
              }
            ]
          }
        ]
      }
    },
    view: {
      onRender() {
        const setupResizeHeader = () => {
          const el = this.el;
          const canvasDoc = editor.Canvas.getDocument();
          const canvasBody = editor.Canvas.getBody();
          const logoWrap = el.querySelector(".doc-logo");
          const divider = el.querySelector(".resize-divider");
          if (!divider || !logoWrap) return;
          let isResizing = false;
          let startX = 0;
          let startWidth = 0;
          const onMove = (e) => {
            if (!isResizing) return;
            e.preventDefault();
            const header = el.querySelector(".doc-header");
            const isReversed = header.classList.contains("reverse-layout");
            const delta = (e.clientX - startX) * (isReversed ? -1 : 1);
            const newWidth = Math.max(80, Math.round(startWidth + delta));
            logoWrap.style.width = `${newWidth}px`;
            logoWrap.style.flex = `0 0 ${newWidth}px`;
          };
          const onUp = () => {
            if (!isResizing) return;
            isResizing = false;
            const logoModel = this.model.find(".doc-logo")[0];
            if (logoModel) {
              const newWidth = logoWrap.getBoundingClientRect().width;
              logoModel.addStyle({
                width: `${Math.round(newWidth)}px`,
                flex: `0 0 ${Math.round(newWidth)}px`
              });
              editor.trigger("component:update", logoModel);
              editor.store();
            }
            canvasDoc.removeEventListener("mousemove", onMove, true);
            canvasDoc.removeEventListener("mouseup", onUp, true);
            canvasBody.style.userSelect = "";
            canvasBody.style.cursor = "";
          };
          divider.addEventListener(
            "mousedown",
            (e) => {
              e.preventDefault();
              e.stopPropagation();
              isResizing = true;
              startX = e.clientX;
              startWidth = logoWrap.getBoundingClientRect().width;
              canvasBody.style.userSelect = "none";
              canvasBody.style.cursor = "ew-resize";
              canvasDoc.addEventListener("mousemove", onMove, true);
              canvasDoc.addEventListener("mouseup", onUp, true);
            },
            { passive: false }
          );
        };
        setTimeout(setupResizeHeader, 200);
        editor.on("load", () => setTimeout(setupResizeHeader, 300));
        editor.on("component:add", (cmp) => {
          if (cmp.is("gjsDocHeader")) setTimeout(setupResizeHeader, 300);
        });
      }
    }
  });
  editor.Blocks.add("gjsDocHeader", {
    label: "Header Dokumen",
    category: "Dokumen",
    content: { type: "gjsDocHeader" }
  });
  editor.on("load", () => {
    const logoComps = editor.getWrapper().find(".doc-logo");
    logoComps.forEach((comp) => {
      const toolbar = comp.get("toolbar") || [];
      const hasSwap = toolbar.some((t) => t.command === "swap-header-layout");
      if (!hasSwap) {
        comp.set("toolbar", [
          {
            attributes: { class: "fa fa-exchange", title: "Tukar posisi logo" },
            command: "swap-header-layout"
          }
        ]);
      }
      const img = comp.findType("image")[0];
      if (img) {
        const imgToolbar = img.get("toolbar") || [];
        const hasSwapImg = imgToolbar.some(
          (t) => t.command === "swap-header-layout"
        );
        if (!hasSwapImg) {
          img.set("toolbar", [
            {
              attributes: {
                class: "fa fa-exchange",
                title: "Tukar posisi logo"
              },
              command: "swap-header-layout"
            }
          ]);
        }
      }
    });
    const dividers = editor.getWrapper().find(".resize-divider");
    dividers.forEach((divider) => {
      divider.set("toolbar", []);
    });
  });
}
function gjsRelationsTable(editor) {
  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;
  editor.Components.addType("html-comment", {
    model: {
      defaults: {
        droppable: false,
        draggable: false,
        editable: false,
        selectable: false,
        layerable: false,
        attributes: {
          text: "default comment",
          class: "gjs-html-comment"
        },
        styles: `
          .gjs-html-comment{
            display:none !important;
          }
        `
      },
      toHTML() {
        const comment = this.getAttributes().text || "";
        return comment;
      }
    }
  });
  editor.Components.addType("gjsRelationsTable", {
    model: {
      defaults: {
        tagName: "table",
        attributes: { class: "gjs-relations-table" },
        styles: `
          .gjs-relations-table { width:100%; border-collapse:collapse; font-family:Arial, sans-serif; font-size:12px }
          .gjs-relations-table th, .gjs-relations-table td { border:1px solid #ddd; padding:8px; }
          .gjs-relations-table thead th { background:#f6f6f6; font-weight:700; }
        `,
        droppable: false,
        traits: []
      },
      init() {
        this.listenTo(this, "change:selectedColumns", this.updateColumns);
        this.listenTo(this, "change:columnOrder", this.updateColumns);
      },
      updateColumns() {
        const selected = this.get("selectedColumns") || [];
        const order = this.get("columnOrder") || [];
        const columns = order.filter((col) => selected.includes(col));
        const thead = this.components().find(
          (c) => c.get("tagName") === "thead"
        );
        if (!thead) return;
        const tr = thead.components().at(0);
        tr.components().reset(
          columns.map((col) => ({
            tagName: "th",
            content: col,
            attributes: {
              "data-id": genId("cell"),
              class: "border border-gray-400 px-2 py-1 text-left bg-gray-100"
            }
          }))
        );
      }
    }
  });
}
function enableColumnResize(editor) {
  const canvasDoc = editor.Canvas.getDocument();
  const canvasBody = editor.Canvas.getBody();
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  let currentTh = null;
  let currentComp = null;
  canvasDoc.addEventListener(
    "mousemove",
    (e) => {
      const th = e.target.closest("th, td");
      if (!th) return;
      const tr = th == null ? void 0 : th.closest("tr");
      const table = tr == null ? void 0 : tr.closest("table");
      const colIndex = Array.from(tr.children).indexOf(th);
      const colSpan = (th.getAttribute("colspan") ?? 1) - 1;
      const colHeader = table == null ? void 0 : table.querySelector(
        `thead>tr th:nth-child(${colSpan + colIndex + 1}), thead>tr td:nth-child(${colSpan + colIndex + 1})`
      );
      if (!colHeader) return;
      const rect = colHeader == null ? void 0 : colHeader.getBoundingClientRect();
      const offset = 5;
      const isNearRightEdge = (rect == null ? void 0 : rect.right) - e.clientX < offset;
      colHeader.style.cursor = isNearRightEdge ? "col-resize" : "";
    },
    true
  );
  canvasDoc.addEventListener(
    "mousedown",
    (e) => {
      const th = e.target.closest("th, td");
      if (!th) return;
      const tr = th == null ? void 0 : th.closest("tr");
      const table = tr == null ? void 0 : tr.closest("table");
      const colIndex = Array.from(tr.children).indexOf(th);
      const colSpan = ((th == null ? void 0 : th.getAttribute("colspan")) ?? 1) - 1;
      const colHeader = table == null ? void 0 : table.querySelector(
        `thead>tr th:nth-child(${colSpan + colIndex + 1}), thead>tr td:nth-child(${colSpan + colIndex + 1})`
      );
      if (!colHeader) return;
      const rect = colHeader.getBoundingClientRect();
      const offset = 5;
      const isNearRightEdge = rect.right - e.clientX < offset;
      if (isNearRightEdge) {
        isResizing = true;
        startX = e.clientX;
        startWidth = rect.width;
        currentTh = colHeader;
        currentComp = editor.getWrapper().find(`[data-id="${colHeader.dataset.id}"]`)[0];
        canvasBody.style.userSelect = "none";
        canvasBody.style.cursor = "col-resize";
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
  canvasDoc.addEventListener(
    "mousemove",
    (e) => {
      if (!isResizing || !currentTh) return;
      e.preventDefault();
      e.stopPropagation();
      const diff = e.clientX - startX;
      const newWidth = Math.max(startWidth + diff, 40);
      currentTh.style.width = `${newWidth}px`;
    },
    true
  );
  canvasDoc.addEventListener(
    "mouseup",
    () => {
      if (!isResizing || !currentTh) return;
      isResizing = false;
      canvasBody.style.userSelect = "";
      canvasBody.style.cursor = "";
      if (currentComp) {
        const newWidth = currentTh.style.width;
        const style = { ...currentComp.getStyle() || {}, width: newWidth };
        currentComp.setStyle(style);
        currentComp.trigger("change:style");
        editor.trigger("component:update", currentComp);
        editor.store();
      }
      currentTh = null;
      currentComp = null;
    },
    true
  );
}
function gjsTable(editor) {
  const domc = editor.DomComponents;
  editor.on("load", () => enableColumnResize(editor));
  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;
  const countCols = (row) => row.components().toArray().reduce((sum, c) => sum + parseInt(c.getAttributes().colspan || 1), 0);
  const normalizeTable = (table) => {
    if (!table) return;
    const sections = table.components().filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));
    let maxCols = 0;
    sections.forEach((sec) => {
      sec.components().forEach((tr) => {
        const cols = countCols(tr);
        if (cols > maxCols) maxCols = cols;
      });
    });
    sections.forEach((sec) => {
      sec.components().forEach((tr) => {
        let cols = countCols(tr);
        while (cols < maxCols) {
          tr.append({
            type: "text",
            toolbar: [
              {
                attributes: {
                  class: "fa fa-plus-square",
                  title: "Add Row (after)"
                },
                command: "add-row"
              },
              {
                attributes: {
                  class: "fa fa-minus-square",
                  title: "Remove Row"
                },
                command: "remove-row"
              },
              {
                attributes: {
                  class: "fa fa-plus-circle",
                  title: "Add Column (after)"
                },
                command: "add-column"
              },
              {
                attributes: {
                  class: "fa fa-minus-circle",
                  title: "Remove Column"
                },
                command: "remove-column"
              },
              {
                attributes: {
                  class: "fa fa-object-group",
                  title: "Merge Right"
                },
                command: "merge-right"
              },
              {
                attributes: {
                  class: "fa fa-object-ungroup",
                  title: "Merge Down"
                },
                command: "merge-down"
              }
            ],
            tagName: sec.get("tagName") === "thead" ? "th" : "td",
            attributes: { "data-id": genId("cell") },
            content: "New"
          });
          cols++;
        }
      });
    });
  };
  const normalizeTableRows = (table) => {
    if (!table) return;
    const sections = table.components().filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));
    sections.forEach((section) => {
      const rows = section.components().filter((c) => c.get("tagName") === "tr");
      if (rows.length === 0) return;
      let maxCols = 0;
      rows.forEach((row) => {
        const cols = row.components().reduce(
          (sum, cell) => sum + parseInt(cell.getAttributes().colspan || 1),
          0
        );
        if (cols > maxCols) maxCols = cols;
      });
      rows.forEach((row) => {
        let currentCols = row.components().reduce(
          (sum, cell) => sum + parseInt(cell.getAttributes().colspan || 1),
          0
        );
        while (currentCols < maxCols) {
          row.append({
            type: "text",
            toolbar: [
              {
                attributes: {
                  class: "fa fa-plus-square",
                  title: "Add Row (after)"
                },
                command: "add-row"
              },
              {
                attributes: {
                  class: "fa fa-minus-square",
                  title: "Remove Row"
                },
                command: "remove-row"
              },
              {
                attributes: {
                  class: "fa fa-plus-circle",
                  title: "Add Column (after)"
                },
                command: "add-column"
              },
              {
                attributes: {
                  class: "fa fa-minus-circle",
                  title: "Remove Column"
                },
                command: "remove-column"
              },
              {
                attributes: {
                  class: "fa fa-object-group",
                  title: "Merge Right"
                },
                command: "merge-right"
              },
              {
                attributes: {
                  class: "fa fa-object-ungroup",
                  title: "Merge Down"
                },
                command: "merge-down"
              }
            ],
            tagName: section.get("tagName") === "thead" ? "th" : "td",
            attributes: { "data-id": genId("cell") },
            content: "New"
          });
          currentCols++;
        }
      });
      rows.forEach((row, rowIdx) => {
        row.components().forEach((cell) => {
          const rs = parseInt(cell.getAttributes().rowspan || 1);
          if (rs + rowIdx > rows.length) {
            cell.addAttributes({ rowspan: rows.length - rowIdx });
          }
          for (let i = 1; i < rs; i++) {
            const targetRow = rows[rowIdx + i];
            if (!targetRow) continue;
            const cellIdx = row.components().indexOf(cell);
            const targetCell = targetRow.components().at(cellIdx);
            if (targetCell) targetCell.remove();
          }
        });
      });
    });
  };
  const getSelectedCell = () => {
    let sel = editor.getSelected();
    if (!sel) return null;
    if (sel.get && ["tr", "thead", "tbody", "tfoot", "table"].includes(sel.get("tagName"))) {
      const cell = sel.find("td,th")[0] || sel.components().filter((c) => ["td", "th"].includes(c.get("tagName")))[0];
      return cell || null;
    }
    if (sel.get && ["td", "th"].includes(sel.get("tagName"))) return sel;
    return null;
  };
  const findRowModel = (cellModel) => {
    if (!cellModel) return null;
    let p = cellModel.parent();
    while (p) {
      if (p.get && p.get("tagName") === "tr") return p;
      p = p.parent();
    }
    return null;
  };
  const findSectionModel = (cellModel) => {
    if (!cellModel) return null;
    let p = cellModel;
    while (p) {
      if (p.get && ["thead", "tbody", "tfoot"].includes(p.get("tagName")))
        return p;
      p = p.parent();
    }
    return null;
  };
  const findTableModel = (component) => {
    if (!component) return null;
    let p = component;
    while (p) {
      if (p.get && p.get("tagName") === "table") return p;
      p = p.parent();
    }
    return null;
  };
  editor.Commands.add("add-row", {
    run(editor2) {
      const cell = editor2.getSelected();
      if (!cell) return;
      const row = findRowModel(cell);
      const section = findSectionModel(cell);
      const table = findTableModel(cell);
      if (!row || !section) return;
      const colCount = countCols(row);
      const newRow = {
        tagName: "tr",
        attributes: { "data-id": genId("row") },
        components: Array.from({ length: colCount }).map(() => ({
          tagName: section.get("tagName") === "thead" ? "th" : "td",
          attributes: { "data-id": genId("cell") },
          content: "New Cell",
          type: "text",
          toolbar: [
            {
              attributes: {
                class: "fa fa-plus-square",
                title: "Add Row (after)"
              },
              command: "add-row"
            },
            {
              attributes: { class: "fa fa-minus-square", title: "Remove Row" },
              command: "remove-row"
            },
            {
              attributes: {
                class: "fa fa-plus-circle",
                title: "Add Column (after)"
              },
              command: "add-column"
            },
            {
              attributes: {
                class: "fa fa-minus-circle",
                title: "Remove Column"
              },
              command: "remove-column"
            },
            {
              attributes: { class: "fa fa-object-group", title: "Merge Right" },
              command: "merge-right"
            },
            {
              attributes: {
                class: "fa fa-object-ungroup",
                title: "Merge Down"
              },
              command: "merge-down"
            }
          ]
        }))
      };
      const index = section.components().indexOf(row);
      section.components().add(newRow, { at: index + 1 });
      normalizeTable(table);
      normalizeTableRows(table);
      editor2.select(newRow);
    }
  });
  editor.Commands.add("remove-row", {
    run(editor2) {
      const sel = editor2.getSelected();
      if (!sel) return;
      const row = findRowModel(sel);
      const section = findSectionModel(sel);
      const table = findTableModel(sel);
      if (!row || !section) return;
      const rows = section.components().filter((r) => r.get("tagName") === "tr");
      if (rows.length > 1) row.remove();
      normalizeTable(table);
      normalizeTableRows(table);
    }
  });
  editor.Commands.add("add-column", {
    run() {
      const cell = getSelectedCell();
      if (!cell) return;
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!row || !table) return;
      const cellsInRow = row.components().toArray();
      const colIndex = cellsInRow.indexOf(cell);
      const sections = table.components().filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));
      sections.forEach((sec) => {
        sec.components().forEach((tr) => {
          if (tr.get("tagName") !== "tr") return;
          const isHeader = sec.get("tagName") === "thead";
          const cellObj = {
            type: "text",
            toolbar: [
              {
                attributes: {
                  class: "fa fa-plus-square",
                  title: "Add Row (after)"
                },
                command: "add-row"
              },
              {
                attributes: {
                  class: "fa fa-minus-square",
                  title: "Remove Row"
                },
                command: "remove-row"
              },
              {
                attributes: {
                  class: "fa fa-plus-circle",
                  title: "Add Column (after)"
                },
                command: "add-column"
              },
              {
                attributes: {
                  class: "fa fa-minus-circle",
                  title: "Remove Column"
                },
                command: "remove-column"
              },
              {
                attributes: {
                  class: "fa fa-object-group",
                  title: "Merge Right"
                },
                command: "merge-right"
              },
              {
                attributes: {
                  class: "fa fa-object-ungroup",
                  title: "Merge Down"
                },
                command: "merge-down"
              }
            ],
            tagName: isHeader ? "th" : "td",
            attributes: { "data-id": genId("cell") },
            content: "New"
          };
          const targetCells = tr.components().toArray();
          const insertPos = Math.min(colIndex + 1, targetCells.length);
          tr.append(cellObj, { at: insertPos });
        });
      });
      normalizeTable(table);
    }
  });
  editor.Commands.add("remove-column", {
    run() {
      const cell = getSelectedCell();
      if (!cell) return;
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!row || !table) return;
      const cellsInRow = row.components().toArray();
      const colIndex = cellsInRow.indexOf(cell);
      const sections = table.components().filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));
      const firstSection = sections[0];
      const firstRow = firstSection && firstSection.components().filter((c) => c.get("tagName") === "tr")[0];
      if (!firstRow) return;
      if (firstRow.components().length <= 1) return;
      sections.forEach((sec) => {
        sec.components().forEach((tr) => {
          if (tr.get("tagName") !== "tr") return;
          const cells = tr.components().toArray();
          if (cells.length <= 1) return;
          if (cells[colIndex]) cells[colIndex].remove();
          else {
            const last = tr.components().at(tr.components().length - 1);
            if (last) last.remove();
          }
        });
      });
      normalizeTable(table);
    }
  });
  editor.Commands.add("merge-right", {
    run() {
      var _a;
      const cell = getSelectedCell();
      if (!cell) return;
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!row) return;
      const cells = row.components().toArray();
      const idx = cells.indexOf(cell);
      const next = cells[idx + 1];
      if (!next) return;
      const attrs = cell.get("attributes") || {};
      const cur = parseInt(attrs.colspan || attrs.colSpan || 1, 10) || 1;
      cell.addAttributes({
        colspan: cur + (parseInt(((_a = next.get("attributes")) == null ? void 0 : _a.colspan) || 1, 10) || 1)
      });
      cell.set(
        "content",
        `${cell.get("content") || ""} ${next.get("content") || ""}`.trim()
      );
      next.remove();
      normalizeTable(table);
      normalizeTableRows(table);
    }
  });
  editor.Commands.add("merge-down", {
    run() {
      var _a;
      const cell = getSelectedCell();
      if (!cell) return;
      const section = findSectionModel(cell);
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!section || !row) return;
      const rows = section.components().filter((c) => c.get("tagName") === "tr");
      const rowIdx = rows.indexOf(row);
      const belowRow = rows[rowIdx + 1];
      if (!belowRow) return;
      const cellIdx = row.components().toArray().indexOf(cell);
      const belowCell = belowRow.components().toArray()[cellIdx];
      if (!belowCell) return;
      const attrs = cell.get("attributes") || {};
      const cur = parseInt(attrs.rowspan || 1, 10) || 1;
      cell.addAttributes({
        rowspan: cur + (parseInt(((_a = belowCell.get("attributes")) == null ? void 0 : _a.rowspan) || 1, 10) || 1)
      });
      cell.set(
        "content",
        `${cell.get("content") || ""} ${belowCell.get("content") || ""}`.trim()
      );
      belowCell.remove();
      normalizeTable(table);
      normalizeTableRows(table);
    }
  });
  domc.addType("gjsTable", {
    model: {
      defaults: {
        tagName: "table",
        attributes: { class: "gjs-table" },
        styles: `
          .gjs-table { width:100%; border-collapse:collapse; font-family:Arial, sans-serif; font-size:12px }
          .gjs-table th, .gjs-table td { border:1px solid #ddd; padding:8px; }
          .gjs-table thead th { background:#f6f6f6; font-weight:700; }
        `,
        components: [
          {
            tagName: "thead",
            components: [
              {
                tagName: "tr",
                components: [
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)"
                        },
                        command: "add-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row"
                        },
                        command: "remove-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)"
                        },
                        command: "add-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column"
                        },
                        command: "remove-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right"
                        },
                        command: "merge-right"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down"
                        },
                        command: "merge-down"
                      }
                    ],
                    tagName: "th",
                    attributes: {
                      "data-id": genId("cell")
                    },
                    content: "Header 1"
                  },
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)"
                        },
                        command: "add-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row"
                        },
                        command: "remove-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)"
                        },
                        command: "add-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column"
                        },
                        command: "remove-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right"
                        },
                        command: "merge-right"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down"
                        },
                        command: "merge-down"
                      }
                    ],
                    tagName: "th",
                    attributes: {
                      "data-id": genId("cell")
                    },
                    content: "Header 2"
                  }
                ]
              }
            ]
          },
          {
            tagName: "tbody",
            components: [
              {
                tagName: "tr",
                components: [
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)"
                        },
                        command: "add-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row"
                        },
                        command: "remove-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)"
                        },
                        command: "add-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column"
                        },
                        command: "remove-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right"
                        },
                        command: "merge-right"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down"
                        },
                        command: "merge-down"
                      }
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell")
                    },
                    content: "Cell 1"
                  },
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)"
                        },
                        command: "add-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row"
                        },
                        command: "remove-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)"
                        },
                        command: "add-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column"
                        },
                        command: "remove-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right"
                        },
                        command: "merge-right"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down"
                        },
                        command: "merge-down"
                      }
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell")
                    },
                    content: "Cell 2"
                  }
                ]
              }
            ]
          },
          {
            tagName: "tfoot",
            components: [
              {
                tagName: "tr",
                components: [
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)"
                        },
                        command: "add-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row"
                        },
                        command: "remove-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)"
                        },
                        command: "add-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column"
                        },
                        command: "remove-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right"
                        },
                        command: "merge-right"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down"
                        },
                        command: "merge-down"
                      }
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell")
                    },
                    content: "Footer 1"
                  },
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)"
                        },
                        command: "add-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row"
                        },
                        command: "remove-row"
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)"
                        },
                        command: "add-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column"
                        },
                        command: "remove-column"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right"
                        },
                        command: "merge-right"
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down"
                        },
                        command: "merge-down"
                      }
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell")
                    },
                    content: "Footer 2"
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  });
  editor.Blocks.add("gjsTable", {
    label: "Table",
    category: "Dokumen",
    content: { type: "gjsTable" }
  });
  editor.on("load", () => {
    const tables = editor.getWrapper().find('[data-gjs-type="gjsTable"]');
    tables.forEach((table) => {
      const cells = table.find("td,th");
      cells.forEach((cell) => {
        cell.set("toolbar", [
          {
            attributes: {
              class: "fa fa-plus-square",
              title: "Add Row (after)"
            },
            command: "add-row"
          },
          {
            attributes: {
              class: "fa fa-minus-square",
              title: "Remove Row"
            },
            command: "remove-row"
          },
          {
            attributes: {
              class: "fa fa-plus-circle",
              title: "Add Column (after)"
            },
            command: "add-column"
          },
          {
            attributes: {
              class: "fa fa-minus-circle",
              title: "Remove Column"
            },
            command: "remove-column"
          },
          {
            attributes: { class: "fa fa-object-group", title: "Merge Right" },
            command: "merge-right"
          },
          {
            attributes: { class: "fa fa-object-ungroup", title: "Merge Down" },
            command: "merge-down"
          }
        ]);
      });
    });
  });
}
function mountLetterheadPreview(editor, { html, css }) {
  const addPreview = () => {
    var _a;
    const frame = editor.Canvas.getFrameEl();
    if (!frame) return;
    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc) return;
    const wrapperEl = (_a = editor.getWrapper().view) == null ? void 0 : _a.el;
    if (!wrapperEl) return;
    const styleEl = doc.createElement("style");
    styleEl.id = "letterhead-preview-style";
    styleEl.innerHTML = css || "";
    doc.head.appendChild(styleEl);
    const box = doc.createElement("div");
    box.id = "letterhead-preview";
    box.style.position = "relative";
    box.style.pointerEvents = "none";
    box.style.zIndex = "1";
    box.innerHTML = html || "";
    doc.body.insertBefore(box, wrapperEl);
  };
  editor.on("load", addPreview);
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
          class: "gjs-grid"
        },
        styles: `
          .gjs-grid {
            display: grid;
            grid-template-columns: max-content 1fr;
            column-gap: 12px;
            padding-top: 10px;
            padding-bottom: 10px;
          }
        `
      }
    }
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
          class: "gjs-subgrid"
        },
        styles: `
          .gjs-subgrid {
            display: grid;
            grid-template-columns: subgrid;
            gap: 8px;
            grid-column: 1 / -1;
            padding: 0px;
          }
        `
      }
    }
  });
  editor.on("canvas:dragdata", (dataTransfer, result) => {
    var _a;
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
      const columns = ((_a = payload.columns) == null ? void 0 : _a.filter((c) => c.show).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) || [];
      result.content = {
        type: "gjsRelationsTable",
        attributes: {
          "data-relations": payload.name
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
                  text: `{{#infoColumns @root.dataTableColumns key="${payload.name}" }}`
                }
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
                    attributes: { "data-id": genId("cell") }
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
                      class: "border border-gray-400 px-2 py-1 text-left bg-gray-100"
                    }
                  }))
                ]
              },
              {
                type: "html-comment",
                attributes: { text: `{{/infoColumns}}` }
              }
            ]
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
                attributes: { text: `{{#each ${payload.name}}}` }
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
                    attributes: { "data-id": genId("cell") }
                  },
                  ...columns.map((col) => ({
                    tagName: "td",
                    content: `{{${col.type === "relation" ? "relation " : ""}${col.name}}}`,
                    selectable: false,
                    droppable: false,
                    layerable: false,
                    editable: false,
                    draggable: false,
                    attributes: {
                      "data-id": genId("cell"),
                      name: col.name,
                      class: "border border-gray-300 px-2 py-1"
                    }
                  }))
                ]
              },
              {
                type: "html-comment",
                attributes: { text: `{{/each}}` }
              }
            ]
          }
        ]
      };
    } else {
      result.content = {
        type: "subGrid",
        components: [
          {
            type: "text",
            tagName: "p",
            content: `{{trans "${payload.name}" ${payload.parentType == "preferences" ? `type="companyDetail"` : ""}}}`
          },
          {
            type: "text",
            tagName: "p",
            content: `: {{${payload.parentType == "preferences" ? `companyDetail "${payload.name}"` : payload.name}}}`
          }
        ]
      };
    }
  });
  editor.on("canvas:drop", (sorter, model) => {
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
          type: "grid"
        },
        { at: oldIndex }
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
  preferences
}) {
  var _a;
  const [editor, setEditor] = useState();
  const { t } = useLaravelReactI18n();
  const onEditor = (editor2) => {
    var _a2, _b;
    setEditor(editor2);
    const applyBodyStyle = () => {
      const body = editor2.Canvas.getBody();
      if (!body) return;
      body.style.padding = `24px 24px 24px 24px`;
      body.style.fontFamily = printTemplate.font_family;
      editor2.addStyle(`
        p{
          margin-top: 2px;
          margin-bottom: 2px;
        }
      `);
    };
    editor2.on("load", applyBodyStyle);
    variableDropListener(editor2);
    if (!printTemplate.is_letter_head && printTemplate.letter_head) {
      initHandlebar(t);
      const template = printTemplate.letter_head;
      const css = (((_a2 = template.css) == null ? void 0 : _a2.replace("body", "div")) ?? "") + ".resize-divider{display:none !important;}";
      mountLetterheadPreview(editor2, {
        html: Handlebars.compile(
          "{{#with preferences}}" + (((_b = template == null ? void 0 : template.html) == null ? void 0 : _b.replace("body", "div")) ?? "") + "{{/with}}"
        )({
          dataTableColumns,
          preferences
        }),
        css
      });
    }
  };
  useEffect(() => {
    console.log(dataTableColumns);
  }, [editor, dataTableColumns]);
  return /* @__PURE__ */ jsxs(AppLayout, { children: [
    /* @__PURE__ */ jsx(Head, { title: `${t(printTemplate.title)} - Print Editor` }),
    /* @__PURE__ */ jsx(
      GjsEditor,
      {
        grapesjs,
        options: {
          telemetry: false,
          undoManager: { trackSelection: false },
          deviceManager: {
            devices: [
              {
                id: "full",
                name: "Full"
              }
            ]
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
                  "Content-Type": "application/json"
                },
                // Custom headers for the remote storage request
                urlStore: `https://erp.test/settings/printTemplates/`,
                // Endpoint URL where to store data project
                urlLoad: `https://erp.test/settings/printTemplates/${printTemplate.id}`
                // Endpoint URL where to load data project
              }
            },
            onStore: (data, editor2) => {
              const pagesHtml = editor2.Pages.getAll().map((page) => {
                const component = page.getMainComponent();
                return {
                  html: editor2.getHtml({ component }),
                  css: editor2.getCss({ component })
                };
              });
              return {
                id: printTemplate.id,
                idSaved: generateRandom(8),
                data,
                pagesHtml
              };
            }
          }
        },
        plugins: [
          gjsTable,
          gjsDocHeader,
          (editor2) => gjsBlockBasic(editor2, {
            blocks: [
              "column1",
              "column2",
              "column3",
              "column3-7",
              "text",
              "link",
              "image",
              "map"
            ]
          }),
          (editor2) => gjsRelationsTable(editor2),
          flattenMediaPlugin
        ],
        onEditor,
        children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[1fr_minmax(0,256px)] h-full w-full", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full w-full flex-grow gap-y-2", children: [
            /* @__PURE__ */ jsx(WithEditor, { children: /* @__PURE__ */ jsx(TopBar, {}) }),
            /* @__PURE__ */ jsx("div", { className: "border border-dotted flex flex-col h-full flex-grow overflow-auto w-full text-center", children: /* @__PURE__ */ jsx(
              Canvas,
              {
                className: " h-full w-full max-w-4xl ",
                style: {
                  width: `${printTemplate.width}$${(_a = printTemplate == null ? void 0 : printTemplate.unit) == null ? void 0 : _a.code}`
                }
              }
            ) })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "h-full", children: /* @__PURE__ */ jsx(WithEditor, { children: /* @__PURE__ */ jsx(Sidebar, {}) }) })
        ] })
      }
    )
  ] });
}
export {
  PrintTemplate as default
};
