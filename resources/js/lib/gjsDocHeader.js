export default function gjsDocHeader(editor) {
  const domc = editor.DomComponents;
  const cmds = editor.Commands;

  // 🌀 Command: Tukar posisi logo kiri <-> kanan
  cmds.add("swap-header-layout", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected) return;

      // Cari elemen utama header
      const headerModel =
        selected.closest && selected.closest(".doc-header")
          ? selected.closest(".doc-header")
          : selected.find && selected.find(".doc-header")[0];

      if (!headerModel) return;

      // Toggle class reverse-layout pada .doc-header
      const classes = headerModel.getClasses();
      const isReversed = classes.includes("reverse-layout");

      if (isReversed) {
        headerModel.removeClass("reverse-layout");
      } else {
        headerModel.addClass("reverse-layout");
      }

      // 🔁 Update model dan simpan
      ed.trigger("component:update", headerModel);
      ed.store();
    },
  });

  // 🧱 Komponen utama Header Dokumen
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
                      title: "Tukar posisi logo",
                    },
                    command: "swap-header-layout",
                  },
                ],
                components: [
                  {
                    type: "image",
                    draggable: false,
                    dropable: false,
                    selectable: false,
                    attributes: {
                      src: "/company-logo",
                      alt: "Company Logo",
                    },
                    toolbar: [
                      {
                        attributes: {
                          class: "fa fa-exchange",
                          title: "Tukar posisi logo",
                        },
                        command: "swap-header-layout",
                      },
                    ],
                  },
                ],
              },
              {
                tagName: "div",
                attributes: { class: "resize-divider" },
                dropable: false,
                editable: false,
                toolbar: [],
              },
              {
                tagName: "div",
                attributes: {
                  class: "doc-info",
                },
                components: [
                  {
                    type: "text",
                    tagName: "h2",
                    content: "{{company_name}}",
                  },
                  {
                    type: "text",
                    tagName: "p",
                    content:
                      "{{street}}, {{city}}, {{state}}, {{country_name}}. {{zip_code}}",
                  },
                  {
                    type: "text",
                    tagName: "p",
                    content: "Telp: {{phone}}",
                  },
                  {
                    type: "text",
                    tagName: "p",
                    content: "Email: {{email}}",
                  },
                ],
              },
            ],
          },
        ],
      },
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

            // Tampilkan langsung di canvas
            logoWrap.style.width = `${newWidth}px`;
            logoWrap.style.flex = `0 0 ${newWidth}px`;
          };

          const onUp = () => {
            if (!isResizing) return;
            isResizing = false;

            // Simpan perubahan ke model GrapesJS
            const logoModel = this.model.find(".doc-logo")[0];
            if (logoModel) {
              const newWidth = logoWrap.getBoundingClientRect().width;
              logoModel.addStyle({
                width: `${Math.round(newWidth)}px`,
                flex: `0 0 ${Math.round(newWidth)}px`,
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
            { passive: false },
          );
        };
        // 🧩 Re-bind saat render ulang
        setTimeout(setupResizeHeader, 200);

        // 🧩 Juga bind ulang setiap kali editor load ulang dari storage
        editor.on("load", () => setTimeout(setupResizeHeader, 300));
        editor.on("component:add", (cmp) => {
          if (cmp.is("gjsDocHeader")) setTimeout(setupResizeHeader, 300);
        });
      },
    },
  });

  // 🧩 Blok GrapesJS untuk panel kiri
  editor.Blocks.add("gjsDocHeader", {
    label: "Header Dokumen",
    category: "Dokumen",
    content: { type: "gjsDocHeader" },
  });
  // 🧱 Pastikan toolbar logo & image direstore saat reload dari storage
  editor.on("load", () => {
    const logoComps = editor.getWrapper().find(".doc-logo");
    logoComps.forEach((comp) => {
      const toolbar = comp.get("toolbar") || [];
      const hasSwap = toolbar.some((t) => t.command === "swap-header-layout");

      if (!hasSwap) {
        comp.set("toolbar", [
          {
            attributes: { class: "fa fa-exchange", title: "Tukar posisi logo" },
            command: "swap-header-layout",
          },
        ]);
      }

      const img = comp.findType("image")[0];
      if (img) {
        const imgToolbar = img.get("toolbar") || [];
        const hasSwapImg = imgToolbar.some(
          (t) => t.command === "swap-header-layout",
        );
        if (!hasSwapImg) {
          img.set("toolbar", [
            {
              attributes: {
                class: "fa fa-exchange",
                title: "Tukar posisi logo",
              },
              command: "swap-header-layout",
            },
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
