import { generateRandom } from "./utils";

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

      const tr = th?.closest("tr");
      const table = tr?.closest("table");

      const colIndex = Array.from(tr.children).indexOf(th);
      const colSpan = (th.getAttribute("colspan") ?? 1) - 1;
      const colHeader = table?.querySelector(
        `thead>tr th:nth-child(${colSpan + colIndex + 1}), thead>tr td:nth-child(${colSpan + colIndex + 1})`,
      );

      if (!colHeader) return;

      const rect = colHeader?.getBoundingClientRect();
      const offset = 5;
      const isNearRightEdge = rect?.right - e.clientX < offset;
      colHeader.style.cursor = isNearRightEdge ? "col-resize" : "";
    },
    true,
  );

  canvasDoc.addEventListener(
    "mousedown",
    (e) => {
      const th = e.target.closest("th, td");
      if (!th) return;

      const tr = th?.closest("tr");
      const table = tr?.closest("table");

      const colIndex = Array.from(tr.children).indexOf(th);
      const colSpan = (th?.getAttribute("colspan") ?? 1) - 1;
      const colHeader = table?.querySelector(
        `thead>tr th:nth-child(${colSpan + colIndex + 1}), thead>tr td:nth-child(${colSpan + colIndex + 1})`,
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
        currentComp = editor
          .getWrapper()
          .find(`[data-id="${colHeader.dataset.id}"]`)[0];
        canvasBody.style.userSelect = "none";
        canvasBody.style.cursor = "col-resize";
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
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
    true,
  );

  canvasDoc.addEventListener(
    "mouseup",
    () => {
      if (!isResizing || !currentTh) return;
      isResizing = false;
      canvasBody.style.userSelect = "";
      canvasBody.style.cursor = "";

      // 🧩 Simpan perubahan ke model GrapesJS agar tidak hilang
      if (currentComp) {
        const newWidth = currentTh.style.width;
        const style = { ...(currentComp.getStyle() || {}), width: newWidth };
        currentComp.setStyle(style);
        currentComp.trigger("change:style");
        editor.trigger("component:update", currentComp);
        editor.store();
      }

      currentTh = null;
      currentComp = null;
    },
    true,
  );
}

export default function gjsTable(editor) {
  const domc = editor.DomComponents;
  editor.on("load", () => enableColumnResize(editor));

  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;
  const countCols = (row) =>
    row
      .components()
      .toArray()
      .reduce((sum, c) => sum + parseInt(c.getAttributes().colspan || 1), 0);
  const normalizeTable = (table) => {
    if (!table) return;
    const sections = table
      .components()
      .filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));

    // cari jumlah kolom maksimum
    let maxCols = 0;
    sections.forEach((sec) => {
      sec.components().forEach((tr) => {
        const cols = countCols(tr);
        if (cols > maxCols) maxCols = cols;
      });
    });

    // sesuaikan setiap baris agar punya maxCols kolom visual
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
                  title: "Add Row (after)",
                },
                command: "add-row",
              },
              {
                attributes: {
                  class: "fa fa-minus-square",
                  title: "Remove Row",
                },
                command: "remove-row",
              },
              {
                attributes: {
                  class: "fa fa-plus-circle",
                  title: "Add Column (after)",
                },
                command: "add-column",
              },
              {
                attributes: {
                  class: "fa fa-minus-circle",
                  title: "Remove Column",
                },
                command: "remove-column",
              },
              {
                attributes: {
                  class: "fa fa-object-group",
                  title: "Merge Right",
                },
                command: "merge-right",
              },
              {
                attributes: {
                  class: "fa fa-object-ungroup",
                  title: "Merge Down",
                },
                command: "merge-down",
              },
            ],
            tagName: sec.get("tagName") === "thead" ? "th" : "td",
            attributes: { "data-id": genId("cell"), contenteditable: true },
            content: "New",
          });
          cols++;
        }
      });
    });
  };
  const normalizeTableRows = (table) => {
    if (!table) return;

    const sections = table
      .components()
      .filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));

    sections.forEach((section) => {
      const rows = section
        .components()
        .filter((c) => c.get("tagName") === "tr");
      if (rows.length === 0) return;

      // 🔹 Tentukan jumlah kolom maksimum berdasarkan semua baris
      let maxCols = 0;
      rows.forEach((row) => {
        const cols = row
          .components()
          .reduce(
            (sum, cell) => sum + parseInt(cell.getAttributes().colspan || 1),
            0,
          );
        if (cols > maxCols) maxCols = cols;
      });

      // 🔹 Pastikan semua baris punya jumlah kolom sesuai maxCols
      rows.forEach((row) => {
        let currentCols = row
          .components()
          .reduce(
            (sum, cell) => sum + parseInt(cell.getAttributes().colspan || 1),
            0,
          );

        while (currentCols < maxCols) {
          row.append({
            type: "text",
            toolbar: [
              {
                attributes: {
                  class: "fa fa-plus-square",
                  title: "Add Row (after)",
                },
                command: "add-row",
              },
              {
                attributes: {
                  class: "fa fa-minus-square",
                  title: "Remove Row",
                },
                command: "remove-row",
              },
              {
                attributes: {
                  class: "fa fa-plus-circle",
                  title: "Add Column (after)",
                },
                command: "add-column",
              },
              {
                attributes: {
                  class: "fa fa-minus-circle",
                  title: "Remove Column",
                },
                command: "remove-column",
              },
              {
                attributes: {
                  class: "fa fa-object-group",
                  title: "Merge Right",
                },
                command: "merge-right",
              },
              {
                attributes: {
                  class: "fa fa-object-ungroup",
                  title: "Merge Down",
                },
                command: "merge-down",
              },
            ],
            tagName: section.get("tagName") === "thead" ? "th" : "td",
            attributes: { "data-id": genId("cell"), contenteditable: true },
            content: "New",
          });
          currentCols++;
        }
      });

      // 🔹 Perbaiki rowspan agar tidak melebihi jumlah baris
      rows.forEach((row, rowIdx) => {
        row.components().forEach((cell) => {
          const rs = parseInt(cell.getAttributes().rowspan || 1);
          if (rs + rowIdx > rows.length) {
            cell.addAttributes({ rowspan: rows.length - rowIdx });
          }

          // Hapus sel di baris yang tertutupi oleh rowspan
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

  // helper: selected component (prefer cell). If selected is tr/table, try to find a cell inside
  const getSelectedCell = () => {
    let sel = editor.getSelected();
    if (!sel) return null;
    // if user selected a TR or TABLE or SECTION, try to find first child cell
    if (
      sel.get &&
      ["tr", "thead", "tbody", "tfoot", "table"].includes(sel.get("tagName"))
    ) {
      // try to find a child cell component
      const cell =
        sel.find("td,th")[0] ||
        sel
          .components()
          .filter((c) => ["td", "th"].includes(c.get("tagName")))[0];
      return cell || null;
    }
    // if selected is a cell already (td/th)
    if (sel.get && ["td", "th"].includes(sel.get("tagName"))) return sel;
    return null;
  };

  // climb parents to find models
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

  // ===== Commands =====

  // ADD ROW after the current row (in same section)
  editor.Commands.add("add-row", {
    run(editor) {
      const cell = editor.getSelected();
      if (!cell) return;
      const row = findRowModel(cell);
      const section = findSectionModel(cell);
      const table = findTableModel(cell);
      if (!row || !section) return;

      // ambil jumlah kolom logis dari baris terpilih
      const colCount = countCols(row);

      // buat baris baru
      const newRow = {
        tagName: "tr",
        attributes: { "data-id": genId("row") },
        components: Array.from({ length: colCount }).map(() => ({
          tagName: section.get("tagName") === "thead" ? "th" : "td",
          attributes: { "data-id": genId("cell"), contenteditable: true },
          content: "New Cell",
          type: "text",
          toolbar: [
            {
              attributes: {
                class: "fa fa-plus-square",
                title: "Add Row (after)",
              },
              command: "add-row",
            },
            {
              attributes: { class: "fa fa-minus-square", title: "Remove Row" },
              command: "remove-row",
            },
            {
              attributes: {
                class: "fa fa-plus-circle",
                title: "Add Column (after)",
              },
              command: "add-column",
            },
            {
              attributes: {
                class: "fa fa-minus-circle",
                title: "Remove Column",
              },
              command: "remove-column",
            },
            {
              attributes: { class: "fa fa-object-group", title: "Merge Right" },
              command: "merge-right",
            },
            {
              attributes: {
                class: "fa fa-object-ungroup",
                title: "Merge Down",
              },
              command: "merge-down",
            },
          ],
        })),
      };

      // tambahkan setelah baris terpilih
      const index = section.components().indexOf(row);
      section.components().add(newRow, { at: index + 1 });

      normalizeTable(table);
      normalizeTableRows(table);

      editor.select(newRow);
    },
  });

  // REMOVE ROW (the row of the selected cell)
  editor.Commands.add("remove-row", {
    run(editor) {
      const sel = editor.getSelected();
      if (!sel) return;
      const row = findRowModel(sel);
      const section = findSectionModel(sel);
      const table = findTableModel(sel);
      if (!row || !section) return;

      // jangan hapus kalau hanya 1 row tersisa
      const rows = section
        .components()
        .filter((r) => r.get("tagName") === "tr");
      if (rows.length > 1) row.remove();

      normalizeTable(table);
      normalizeTableRows(table);
    },
  });

  // ADD COLUMN after the current column index — affect all sections (thead/tbody/tfoot)
  editor.Commands.add("add-column", {
    run() {
      const cell = getSelectedCell();
      if (!cell) return;
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!row || !table) return;

      // find column index inside its row
      const cellsInRow = row.components().toArray();
      const colIndex = cellsInRow.indexOf(cell);

      // gather all section models (thead, tbody, tfoot) in table
      const sections = table
        .components()
        .filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));

      sections.forEach((sec) => {
        // for each tr in section, insert a new cell at colIndex + 1
        sec.components().forEach((tr) => {
          if (tr.get("tagName") !== "tr") return;
          const isHeader = sec.get("tagName") === "thead";
          const cellObj = {
            type: "text",
            toolbar: [
              {
                attributes: {
                  class: "fa fa-plus-square",
                  title: "Add Row (after)",
                },
                command: "add-row",
              },
              {
                attributes: {
                  class: "fa fa-minus-square",
                  title: "Remove Row",
                },
                command: "remove-row",
              },
              {
                attributes: {
                  class: "fa fa-plus-circle",
                  title: "Add Column (after)",
                },
                command: "add-column",
              },
              {
                attributes: {
                  class: "fa fa-minus-circle",
                  title: "Remove Column",
                },
                command: "remove-column",
              },
              {
                attributes: {
                  class: "fa fa-object-group",
                  title: "Merge Right",
                },
                command: "merge-right",
              },
              {
                attributes: {
                  class: "fa fa-object-ungroup",
                  title: "Merge Down",
                },
                command: "merge-down",
              },
            ],
            tagName: isHeader ? "th" : "td",
            attributes: { "data-id": genId("cell"), contenteditable: true },
            content: "New",
          };
          // ensure we don't insert beyond existing cells: append if necessary
          const targetCells = tr.components().toArray();
          const insertPos = Math.min(colIndex + 1, targetCells.length);
          tr.append(cellObj, { at: insertPos });
        });
      });
      normalizeTable(table);
    },
  });

  // REMOVE COLUMN at the selected column index — remove that column from all sections
  editor.Commands.add("remove-column", {
    run() {
      const cell = getSelectedCell();
      if (!cell) return;
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!row || !table) return;

      const cellsInRow = row.components().toArray();
      const colIndex = cellsInRow.indexOf(cell);

      const sections = table
        .components()
        .filter((s) => ["thead", "tbody", "tfoot"].includes(s.get("tagName")));
      // ensure at least one column remains (check first section row length)
      const firstSection = sections[0];
      const firstRow =
        firstSection &&
        firstSection.components().filter((c) => c.get("tagName") === "tr")[0];
      if (!firstRow) return;
      if (firstRow.components().length <= 1) return;

      sections.forEach((sec) => {
        sec.components().forEach((tr) => {
          if (tr.get("tagName") !== "tr") return;
          const cells = tr.components().toArray();
          if (cells.length <= 1) return; // don't remove if only 1 cell
          if (cells[colIndex]) cells[colIndex].remove();
          else {
            // if this row is shorter (rare), remove last cell instead to keep counts sane
            const last = tr.components().at(tr.components().length - 1);
            if (last) last.remove();
          }
        });
      });
      normalizeTable(table);
    },
  });

  // ===== Cell type registration (toolbar + editable) =====
  // domc.addType("text", {
  //   model: {
  //     defaults: {
  //       tagName: "td",
  //       editable: true,
  //       droppable: false,
  //       // toolbar with titles (browser tooltip)
  //     },
  //   },
  //   // view left default
  // });

  // ===== Merge commands (robust) =====
  editor.Commands.add("merge-right", {
    run() {
      const cell = getSelectedCell();
      if (!cell) return;
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!row) return;
      const cells = row.components().toArray();
      const idx = cells.indexOf(cell);
      const next = cells[idx + 1];
      if (!next) return;

      // current colspan (attributes may be string)
      const attrs = cell.get("attributes") || {};
      const cur = parseInt(attrs.colspan || attrs.colSpan || 1, 10) || 1;
      cell.addAttributes({
        colspan:
          cur + (parseInt(next.get("attributes")?.colspan || 1, 10) || 1),
      });

      // merge content (optional, keep a space)
      cell.set(
        "content",
        `${cell.get("content") || ""} ${next.get("content") || ""}`.trim(),
      );

      // remove next cell
      next.remove();
      normalizeTable(table);
      normalizeTableRows(table);
    },
  });

  editor.Commands.add("merge-down", {
    run() {
      const cell = getSelectedCell();
      if (!cell) return;
      const section = findSectionModel(cell);
      const row = findRowModel(cell);
      const table = findTableModel(cell);
      if (!section || !row) return;

      const rows = section
        .components()
        .filter((c) => c.get("tagName") === "tr");
      const rowIdx = rows.indexOf(row);
      const belowRow = rows[rowIdx + 1];
      if (!belowRow) return;

      const cellIdx = row.components().toArray().indexOf(cell);
      const belowCell = belowRow.components().toArray()[cellIdx];
      if (!belowCell) return;

      const attrs = cell.get("attributes") || {};
      const cur = parseInt(attrs.rowspan || 1, 10) || 1;
      cell.addAttributes({
        rowspan:
          cur + (parseInt(belowCell.get("attributes")?.rowspan || 1, 10) || 1),
      });

      cell.set(
        "content",
        `${cell.get("content") || ""} ${belowCell.get("content") || ""}`.trim(),
      );
      belowCell.remove();
      normalizeTable(table);
      normalizeTableRows(table);
    },
  });

  // ===== Table registration & block =====
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
                          title: "Add Row (after)",
                        },
                        command: "add-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row",
                        },
                        command: "remove-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)",
                        },
                        command: "add-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column",
                        },
                        command: "remove-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right",
                        },
                        command: "merge-right",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down",
                        },
                        command: "merge-down",
                      },
                    ],
                    tagName: "th",
                    attributes: {
                      "data-id": genId("cell"),
                      contenteditable: true,
                    },
                    content: "Header 1",
                  },
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)",
                        },
                        command: "add-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row",
                        },
                        command: "remove-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)",
                        },
                        command: "add-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column",
                        },
                        command: "remove-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right",
                        },
                        command: "merge-right",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down",
                        },
                        command: "merge-down",
                      },
                    ],
                    tagName: "th",
                    attributes: {
                      "data-id": genId("cell"),
                      contenteditable: true,
                    },
                    content: "Header 2",
                  },
                ],
              },
            ],
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
                          title: "Add Row (after)",
                        },
                        command: "add-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row",
                        },
                        command: "remove-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)",
                        },
                        command: "add-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column",
                        },
                        command: "remove-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right",
                        },
                        command: "merge-right",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down",
                        },
                        command: "merge-down",
                      },
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell"),
                      contenteditable: true,
                    },
                    content: "Cell 1",
                  },
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)",
                        },
                        command: "add-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row",
                        },
                        command: "remove-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)",
                        },
                        command: "add-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column",
                        },
                        command: "remove-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right",
                        },
                        command: "merge-right",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down",
                        },
                        command: "merge-down",
                      },
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell"),
                      contenteditable: true,
                    },
                    content: "Cell 2",
                  },
                ],
              },
            ],
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
                          title: "Add Row (after)",
                        },
                        command: "add-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row",
                        },
                        command: "remove-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)",
                        },
                        command: "add-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column",
                        },
                        command: "remove-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right",
                        },
                        command: "merge-right",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down",
                        },
                        command: "merge-down",
                      },
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell"),
                      contenteditable: true,
                    },
                    content: "Footer 1",
                  },
                  {
                    type: "text",
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-plus-square",
                          title: "Add Row (after)",
                        },
                        command: "add-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-square",
                          title: "Remove Row",
                        },
                        command: "remove-row",
                      },
                      {
                        attributes: {
                          class: "fa fa-plus-circle",
                          title: "Add Column (after)",
                        },
                        command: "add-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-minus-circle",
                          title: "Remove Column",
                        },
                        command: "remove-column",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-group",
                          title: "Merge Right",
                        },
                        command: "merge-right",
                      },
                      {
                        attributes: {
                          class: "fa fa-object-ungroup",
                          title: "Merge Down",
                        },
                        command: "merge-down",
                      },
                    ],
                    tagName: "td",
                    attributes: {
                      "data-id": genId("cell"),
                      contenteditable: true,
                    },
                    content: "Footer 2",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  });

  editor.Blocks.add("gjsTable", {
    label: "Table",
    category: "Dokumen",
    content: { type: "gjsTable" },
  });

  editor.on("load", () => {
    const tables = editor.getWrapper().find('[data-gjs-type="gjsTable"]');
    tables.forEach((table) => {
      // temukan semua cell di dalam tabel ini
      const cells = table.find("td,th");
      cells.forEach((cell) => {
        // jika cell belum punya toolbar, tambahkan kembali
        cell.set("toolbar", [
          {
            attributes: {
              class: "fa fa-plus-square",
              title: "Add Row (after)",
            },
            command: "add-row",
          },
          {
            attributes: {
              class: "fa fa-minus-square",
              title: "Remove Row",
            },
            command: "remove-row",
          },
          {
            attributes: {
              class: "fa fa-plus-circle",
              title: "Add Column (after)",
            },
            command: "add-column",
          },
          {
            attributes: {
              class: "fa fa-minus-circle",
              title: "Remove Column",
            },
            command: "remove-column",
          },
          {
            attributes: { class: "fa fa-object-group", title: "Merge Right" },
            command: "merge-right",
          },
          {
            attributes: { class: "fa fa-object-ungroup", title: "Merge Down" },
            command: "merge-down",
          },
        ]);
      });
    });
  });
}
