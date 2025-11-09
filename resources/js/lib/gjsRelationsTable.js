export default function gjsRelationsTable(editor) {
  // 1️⃣ Tangkap event drop manual
  editor.on("load", () => {
    const iframe = editor.Canvas.getFrameEl();
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument;

    // Izinkan drag over
    iframeDoc.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    // Tangani drop manual
    iframeDoc.addEventListener("drop", (e) => {
      e.preventDefault();

      const json = e.dataTransfer.getData("variable/json");
      if (!json) return;

      let payload;
      try {
        payload = JSON.parse(json);
      } catch {
        console.error("Invalid JSON payload from drag:", json);
        return;
      }

      if (payload.type === "relations") {
        const columns =
          payload.columns
            ?.filter((col) => col.show)
            .sort((a, b) => a.order - b.order) || [];

        editor.addComponents({
          type: "gjsRelationsTable",
          attributes: {
            "data-relations": payload.name,
          },
          components: [
            {
              type: "tableHead",
              tagName: "thead",
              toolbars: [],
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
                  toolbars: [],
                  selectable: false,
                  droppable: false,
                  layerable: false,
                  editable: false,
                  draggable: false,
                  components: [
                    {
                      tagName: "th",
                      selectable: false,
                      droppable: false,
                      layerable: false,
                      editable: false,
                      draggable: false,
                      content: "#",
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
                        name: col.name,
                        titleTrans: col.titleTrans,
                        class:
                          "border border-gray-400 px-2 py-1 text-left bg-gray-100",
                      },
                      toolbars: [],
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
              toolbars: [],
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
                  toolbars: [],
                  selectable: false,
                  droppable: false,
                  layerable: false,
                  editable: false,
                  draggable: false,
                  components: [
                    {
                      tagName: "td",
                      toolbars: [],
                      selectable: false,
                      droppable: false,
                      layerable: false,
                      editable: false,
                      draggable: false,
                      content: "{{idx}}",
                    },
                    ...columns.map((col) => ({
                      tagName: "td",
                      content: `{{${col.type == "relation" ? "relation " : ""}${col.name}}}`,
                      toolbars: [],
                      selectable: false,
                      droppable: false,
                      layerable: false,
                      editable: false,
                      draggable: false,
                      attributes: {
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
        });
      }
    });
  });
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
        },
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
              class: "border border-gray-400 px-2 py-1 text-left bg-gray-100",
            },
          })),
        );
      },
    },
  });
}
