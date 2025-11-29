import { generateRandom } from "./utils";

export default function gjsRelationsTable(editor) {
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
          class: "gjs-html-comment",
        },
        styles: `
          .gjs-html-comment{
            display:none !important;
          }
        `,
      },
      toHTML() {
        const comment = this.getAttributes().text || "";
        return comment;
      },
    },
  });

  // 3️⃣ Definisi tipe gjsRelationsTable
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
        traits: [],
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
          (c) => c.get("tagName") === "thead",
        );
        if (!thead) return;

        const tr = thead.components().at(0);
        tr.components().reset(
          columns.map((col) => ({
            tagName: "th",
            content: col,
            attributes: {
              "data-id": genId("cell"),
              class: "border border-gray-400 px-2 py-1 text-left bg-gray-100",
            },
          })),
        );
      },
    },
  });
}
