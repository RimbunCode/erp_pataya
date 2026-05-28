/**
 * Listener dan handler untuk drag-and-drop variabel ke canvas GrapesJS.
 * Mengelola registrasi tipe komponen grid/subgrid, sinkronisasi tampilan
 * variabel, dan intersepsi event drag-drop dari panel variabel ke canvas.
 * @module variableDropUtils
 */

import { generateRandom } from "@/lib/utils";
import { buildExampleDataTable } from "@/lib/gjsRelationsTable";
import { toast } from "sonner";
import {
  buildVariableToken,
  getSimplifiedTokenDisplay,
  extractLabelKeyFromToken,
} from "./variableInsertUtils";
import {
  GRID_CLASS,
  SUBGRID_CLASS,
  GRID_RULE_STYLE,
  SUBGRID_RULE_STYLE,
} from "./gridConstants";

/**
 * Mendaftarkan listener dan handler drag-and-drop variabel pada editor GrapesJS.
 * Fungsi ini melakukan:
 * - Registrasi tipe komponen gjsGrid dan gjsSubGrid
 * - Sinkronisasi tampilan variabel saat komponen ditambahkan atau dimuat
 * - Intersepsi data drop dari panel variabel ke canvas
 * - Validasi target drop dan pembungkusan otomatis dengan grid container
 * @param {object} editor - Instance editor GrapesJS
 * @param {object} options - Opsi konfigurasi listener
 * @param {Function} options.t - Fungsi translasi i18n
 * @param {string} options.locale - Kode locale untuk formatting (misal: "id", "en")
 */
export function variableDropListener(editor, { t, locale }) {
  // Helper untuk generate ID unik pada komponen grid
  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;

  /**
   * Memastikan CSS rules untuk grid dan subgrid terdaftar di CssComposer editor.
   * Dipanggil saat load dan setiap kali komponen grid/subgrid ditambahkan.
   */
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

  // Registrasi tipe komponen gjsGrid sebagai container grid utama
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

  // Registrasi tipe komponen gjsSubGrid sebagai baris variabel dalam grid
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
  <p><span>{{label "${labelKey}"}}</span></p>
  <p>: <span>${token}</span></p>
</div>
        `.trim();
      },
    },
  });

  /**
   * Sinkronisasi tampilan komponen variabel tunggal di canvas.
   * Memperbarui label terjemahan dan token yang disederhanakan.
   *
   * @param {object} component - Komponen GrapesJS yang akan disinkronisasi
   */
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

    // Perbarui tampilan label dengan terjemahan jika tersedia
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

    // Perbarui tampilan token dengan versi yang disederhanakan
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

  /**
   * Sinkronisasi semua komponen variabel yang ada di canvas.
   * Dipanggil saat editor selesai dimuat untuk memperbarui tampilan awal.
   */
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

  // Inisialisasi: pastikan CSS rules ada dan sinkronisasi komponen saat load
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

  // Intersep data drop dari luar (panel variabel) ke canvas
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

    // Penanganan drop tipe "relations" - buat tabel relasi dengan data contoh
    if (payload.type === "relations") {
      const columns =
        payload.columns
          ?.filter((c) => c.show)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) || [];

      // Bangun preview canvas untuk tabel relasi (tanpa data contoh)
      // Requirements: 3.1, 3.2, 3.4
      const tableComponents = buildExampleDataTable({
        columns,
        relationName: payload.name,
        exampleData: [],
        t,
        genId,
        locale,
      });

      // Beritahu GrapesJS: konten yang harus dibuat saat drop
      // Canvas menampilkan data contoh untuk preview visual
      // Override toHTML() pada komponen menghasilkan token Handlebar yang benar
      result.content = {
        type: "gjsRelationsTable",
        columnsConfig: columns,
        attributes: {
          "data-relations": payload.name,
        },
        components: tableComponents,
      };
    } else {
      // Penanganan drop variabel tunggal - buat baris subgrid dengan label dan token
      // Requirements: 1.1, 1.2, 1.5, 1.6 - Tampilkan data contoh di canvas dengan layout grid
      const varPath = payload.fullKey || payload.name;
      const token =
        payload.formattedToken ||
        buildVariableToken({
          variableType: payload.type,
          parentType: payload.parentType,
          variablePath: varPath,
          keyName: payload.name,
        });
      const labelKey = extractLabelKeyFromToken(token);
      const simplifiedToken = getSimplifiedTokenDisplay(token, varPath);
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
                    "data-label-key": labelKey,
                    title: labelKey,
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
                  "data-token": token,
                  title: token,
                  contenteditable: "false",
                },
                content: simplifiedToken,
              },
            ],
          },
        ],
      };
    }
  });

  // Validasi dan pembungkusan otomatis saat komponen di-drop ke canvas
  editor.on("canvas:drop", (_sorter, model) => {
    if (!model) return;
    if (model.getType() != "gjsSubGrid") {
      return;
    }
    const parent = model.parent();
    if (!parent) return;

    // Tolak drop ke dalam subgrid lain (nesting tidak diizinkan)
    if (parent.getType() === "gjsSubGrid") {
      model.remove();
      toast.error(
        t("core.printTemplate.editor.invalid_drop_target") ||
          "Invalid drop target for variable component.",
      );
      return;
    }

    // Jika parent bukan grid, bungkus otomatis dengan container grid baru
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
