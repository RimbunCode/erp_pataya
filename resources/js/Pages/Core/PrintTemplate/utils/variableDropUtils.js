/**
 * Listener dan handler untuk drag-and-drop variabel ke canvas GrapesJS.
 * Mengelola registrasi tipe komponen grid/subgrid, sinkronisasi tampilan
 * variabel, dan intersepsi event drag-drop dari panel variabel ke canvas.
 * @module variableDropUtils
 */

import { generateRandom } from "@/lib/utils";
import { buildExampleDataTable, getColumnLabel } from "@/lib/gjsRelationsTable";
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
import { getDisplayLabel, resolveLabelWithMeta } from "./variableTokenUtils";

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
 * @param {Array} options.dataTableColumns - Kolom variabel dari props halaman
 * @param {object} options.docInfo - Informasi dokumen untuk variabel docInfo
 * @param {object|null} options.columns - Model columns keyed by model class
 * @param {string|null} options.modelDoc - Root model class untuk path "doc."
 */
export function variableDropListener(
  editor,
  {
    t,
    locale,
    dataTableColumns = [],
    docInfo = {},
    columns = null,
    modelDoc = null,
  },
) {
  // Helper untuk generate ID unik pada komponen grid
  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;
  const resolveTitleTransValue = (value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const escapeHtmlAttribute = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const setTransTitleAttribute = (component, rawValue) => {
    if (!component) {
      return;
    }

    const nextValue = resolveTitleTransValue(rawValue);
    const currentAttributes = { ...(component.getAttributes?.() || {}) };

    if (nextValue) {
      delete currentAttributes["data-title-trans"];
      currentAttributes["data-trans-title"] = nextValue;
      component.setAttributes?.(currentAttributes);
      return;
    }

    if (
      !("data-trans-title" in currentAttributes) &&
      !("data-title-trans" in currentAttributes)
    ) {
      return;
    }

    delete currentAttributes["data-trans-title"];
    delete currentAttributes["data-title-trans"];
    component.setAttributes?.(currentAttributes);
  };

  /**
   * Membangun flat lookup map dari semua variabel: labelKey → displayLabel.
   * Digunakan untuk sinkronisasi displayLabel di canvas saat editor load.
   * Key di canvas (data-label-key) dihasilkan dari extractLabelKeyFromToken:
   * - Tipe doc: "doc.<fieldName>" (karena token = {{doc.<fieldName>}})
   * - Tipe company: "company.<fieldName>"
   * - Tipe docInfo: "docInfo.<fieldName>"
   * - Tipe relation: "doc.<path>" (cleaned dari {{relation doc.<path>}})
   */
  const buildLabelMap = () => {
    const map = {};

    const traverse = (columns, parentPath = "", parentType = "") => {
      if (!Array.isArray(columns)) return;
      for (const col of columns) {
        const label = getDisplayLabel(col, t);
        const colType = col.type || "";

        // Tentukan key sesuai dengan cara VariableItem membangun fullKey
        // dan bagaimana buildVariableToken menghasilkan token
        let fullKey;
        if (
          parentType === "doc" ||
          parentType === "docInfo" ||
          parentType === "company"
        ) {
          // Parent bertipe doc/docInfo/company → path dikirim sebagai "" ke children
          // fullKey = col.name (tanpa parent path)
          fullKey = parentPath ? `${parentPath}.${col.name}` : col.name;
        } else if (parentPath) {
          fullKey = `${parentPath}.${col.name}`;
        } else {
          fullKey = col.name;
        }

        // Simpan dengan fullKey asli
        map[fullKey] = label;
        // Simpan dengan col.name saja
        map[col.name] = label;

        // Simpan sesuai format labelKey di canvas (hasil extractLabelKeyFromToken)
        if (parentType === "doc" || colType === "doc") {
          // Token: {{doc.<fullKey>}} → labelKey: "doc.<fullKey>"
          map[`doc.${fullKey}`] = label;
        }
        if (parentType === "company" || colType === "company") {
          map[`company.${col.name}`] = label;
          map[`company.${fullKey}`] = label;
        }
        if (parentType === "docInfo" || colType === "docInfo") {
          map[`docInfo.${col.name}`] = label;
        }
        if (colType === "relation") {
          // Token: {{relation doc.<fullKey>}} → labelKey: "doc.<fullKey>" (cleaned)
          map[`doc.${fullKey}`] = label;
          // Keep legacy key for backward compatibility with existing templates
          map[`relation doc.${fullKey}`] = label;
        }

        // Traverse nested columns
        if (Array.isArray(col.columns) && col.columns.length > 0) {
          // Tentukan effectiveParentType untuk children
          const effectiveParentType =
            colType === "doc" || colType === "docInfo" || colType === "company"
              ? colType
              : parentType;
          // Tentukan effectivePath untuk children (sama seperti VariableItem)
          const effectivePath =
            colType === "doc" || colType === "docInfo" || colType === "company"
              ? ""
              : fullKey;
          traverse(col.columns, effectivePath, effectiveParentType);
        }
      }
    };

    traverse(dataTableColumns, "", "");

    // Tambahkan docInfo variables dari prop docInfo
    if (docInfo && typeof docInfo === "object") {
      for (const key of Object.keys(docInfo)) {
        map[key] = key;
        map[`docInfo.${key}`] = key;
      }
    }

    return map;
  };

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
      },
      toHTML() {
        const attrs = this.getAttributes() || {};
        const variablePath = attrs["data-variable"] || "";
        const variableType = attrs["data-variable-type"] || "data";
        const titleTrans = resolveTitleTransValue(
          attrs["data-trans-title"] || attrs["data-title-trans"],
        );
        const labelTitleTransAttr = titleTrans
          ? ` data-trans-title="${escapeHtmlAttribute(titleTrans)}"`
          : "";

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
  <p data-label-key="${labelKey}"${labelTitleTransAttr}><span>{{label "${labelKey}"}}</span></p>
  <p>: <span>${token}</span></p>
</div>
        `.trim();
      },
    },
  });

  /**
   * Sinkronisasi tampilan komponen variabel tunggal di canvas.
   * Memperbarui label terjemahan dan token yang disederhanakan.
   * @param {object} component - Komponen GrapesJS yang akan disinkronisasi
   */
  const syncVariableComponentDisplay = (component) => {
    if (!component || component.getType?.() !== "gjsSubGrid") {
      return;
    }

    // Build labelMap saat dipanggil agar t() sudah ready (translate selesai)
    const labelMap = buildLabelMap();

    const attributes = component.getAttributes?.() || {};
    const variablePath = attributes["data-variable"] || "";

    // Cari label dan token component secara rekursif
    let labelComponent = null;
    let tokenComponent = null;

    const findComponents = (parent) => {
      const children = parent.components?.() || [];
      children.forEach((child) => {
        const childAttrs = child.getAttributes?.() || {};
        if (childAttrs["data-label-key"] && !labelComponent) {
          labelComponent = child;
        }
        if (childAttrs["data-token"] && !tokenComponent) {
          tokenComponent = child;
        }
        // Traverse deeper
        if (!labelComponent || !tokenComponent) {
          findComponents(child);
        }
      });
    };

    findComponents(component);

    component.removeClass(SUBGRID_CLASS);
    component.addClass(SUBGRID_CLASS);

    // Perbarui tampilan label dengan urutan fallback:
    // 1) modelColumns (resolveLabelWithMeta)
    // 2) data-trans-title tersimpan di komponen
    // 3) labelMap dari dataTableColumns
    // 4) fallback path terakhir
    if (labelComponent) {
      const labelKey =
        labelComponent.getAttributes?.()?.["data-label-key"] || "";
      let displayLabel = null;
      let resolvedFromModelColumns = false;
      let resolvedTitleTrans = null;

      if (columns) {
        try {
          const resolved = resolveLabelWithMeta(labelKey, columns, modelDoc, t);
          if (resolved?.label && resolved.label !== labelKey) {
            resolvedFromModelColumns = true;
            displayLabel = resolved.label;
            resolvedTitleTrans = resolveTitleTransValue(resolved.titleTrans);
          }
        } catch {
          // Ignore resolve failures and continue fallback chain.
        }
      }

      if (!displayLabel) {
        const storedTitleTrans = resolveTitleTransValue(
          labelComponent.getAttributes?.()?.["data-trans-title"] ||
            labelComponent.getAttributes?.()?.["data-title-trans"] ||
            component.getAttributes?.()?.["data-trans-title"] ||
            component.getAttributes?.()?.["data-title-trans"],
        );
        if (storedTitleTrans) {
          displayLabel = t(storedTitleTrans);
        }
      }

      if (!displayLabel) {
        displayLabel = labelMap[labelKey] || labelMap[variablePath];
      }

      if (!displayLabel) {
        // Fallback final: strip prefix ke segment terakhir
        const stripped = labelKey
          .replace(/^relation\s+/, "")
          .replace(/^doc\./, "")
          .replace(/^company\./, "")
          .replace(/^docInfo\./, "");
        displayLabel = stripped || labelKey.split(".").pop() || variablePath;
      }

      if (resolvedFromModelColumns) {
        setTransTitleAttribute(labelComponent, resolvedTitleTrans);
      }

      const labelTagName = String(
        labelComponent.get("tagName") || "",
      ).toLowerCase();

      if (labelTagName === "p") {
        // Format lama: data-label-key ada di <p>, ganti children-nya
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
            content: displayLabel,
          },
        ]);
      } else if (labelTagName === "span") {
        // Format baru: data-label-key ada di <span>, update content langsung
        labelComponent.set("content", displayLabel);
        // Pastikan parent <p> tidak draggable
        const parentP = labelComponent.parent?.();
        if (
          parentP &&
          String(parentP.get("tagName") || "").toLowerCase() === "p"
        ) {
          parentP.set("draggable", false);
        }
      }
    }

    if (!tokenComponent) {
      return;
    }

    // Perbarui tampilan token dengan versi yang disederhanakan
    const tokenValue = tokenComponent.getAttributes?.()?.["data-token"] || "";
    const simplifiedToken = getSimplifiedTokenDisplay(tokenValue, variablePath);

    const tokenTagName = String(
      tokenComponent.get("tagName") || "",
    ).toLowerCase();

    if (tokenTagName === "p") {
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

    // Cari semua komponen gjsSubGrid di canvas
    const allComponents = wrapper.findType?.("gjsSubGrid") || [];
    // Fallback: cari juga berdasarkan atribut data-variable
    const byAttribute = Array.from(wrapper.find?.("[data-variable]") || []);

    // Gabungkan dan deduplikasi
    const seen = new Set();
    const components = [];
    for (const comp of [...allComponents, ...byAttribute]) {
      const cid = comp.cid || comp.getId?.();
      if (!seen.has(cid)) {
        seen.add(cid);
        components.push(comp);
      }
    }

    components.forEach((component) => syncVariableComponentDisplay(component));
  };

  /**
   * Sinkronisasi header row pada semua gjsRelationsTable di canvas.
   * Memperbarui label kolom header agar selaras dengan terjemahan terbaru.
   * Menggunakan data-label-key untuk resolusi label dari labelMap.
   */
  const syncRelationsTableHeaders = () => {
    const wrapper = editor.getWrapper?.();
    if (!wrapper) {
      return;
    }

    const labelMap = buildLabelMap();

    const tables = wrapper.findType?.("gjsRelationsTable") || [];
    tables.forEach((table) => {
      const columnsConfig = table.get("columnsConfig") || [];
      if (!columnsConfig.length) {
        return;
      }

      // Cari thead > tr > th cells
      const findThead = (parent) => {
        const children = parent.components?.() || [];
        for (const child of children) {
          const tag = String(child.get("tagName") || "").toLowerCase();
          if (tag === "thead" || child.getType?.() === "tableHead") {
            return child;
          }
        }
        return null;
      };

      const thead = findThead(table);
      if (!thead) {
        return;
      }

      // Cari tr di dalam thead
      const trComponents = thead.components?.() || [];
      const headerRow = trComponents.at?.(0) || trComponents.models?.[0];
      if (!headerRow) {
        return;
      }

      // Update setiap th cell yang punya atribut data-label-key
      const thCells = headerRow.components?.() || [];
      thCells.forEach((th) => {
        const attrs = th.getAttributes?.() || {};
        const labelKey = attrs["data-label-key"];
        if (!labelKey) {
          return; // Skip "#" column atau cell tanpa data-label-key
        }

        let newLabel = null;
        let resolvedFromModelColumns = false;
        let resolvedTitleTrans = null;

        if (columns) {
          try {
            const resolved = resolveLabelWithMeta(
              labelKey,
              columns,
              modelDoc,
              t,
            );
            if (resolved?.label && resolved.label !== labelKey) {
              resolvedFromModelColumns = true;
              newLabel = resolved.label;
              resolvedTitleTrans = resolveTitleTransValue(resolved.titleTrans);
            }
          } catch {
            // Ignore resolve failures and continue fallback chain.
          }
        }

        if (!newLabel) {
          const storedTitleTrans = resolveTitleTransValue(
            attrs["data-trans-title"] || attrs["data-title-trans"],
          );
          if (storedTitleTrans) {
            newLabel = t(storedTitleTrans);
          }
        }

        if (!newLabel) {
          newLabel = labelMap[labelKey];
        }

        // Fallback: cari dari columnsConfig menggunakan name attribute
        if (!newLabel) {
          const colName = attrs.name;
          const colConfig = colName
            ? columnsConfig.find((c) => c.name === colName)
            : null;
          if (colConfig) {
            newLabel = getColumnLabel(colConfig, t, locale);
          }
        }

        if (resolvedFromModelColumns) {
          setTransTitleAttribute(th, resolvedTitleTrans);
        }

        if (newLabel && newLabel !== th.get("content")) {
          th.set("content", newLabel);
        }
      });
    });
  };

  // Inisialisasi: pastikan CSS rules ada dan sinkronisasi komponen saat load
  ensureVariableGridCssRules();
  editor.on("load", () => {
    ensureVariableGridCssRules();
    // Delay sinkronisasi untuk memastikan semua komponen sudah ter-render
    // GrapesJS membutuhkan waktu untuk mem-parse project data dan membangun tree komponen
    setTimeout(() => {
      syncAllVariableComponents();
      syncRelationsTableHeaders();
    }, 300);
  });
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
      const dropTitleTrans = resolveTitleTransValue(payload.titleTrans);
      result.content = {
        type: "gjsSubGrid",
        attributes: {
          "data-variable": varPath,
          "data-variable-type": payload.parentType || payload.type || "data",
        },
        components: [
          {
            type: "text",
            tagName: "p",
            draggable: false,
            attributes: {
              "data-label-key": labelKey,
              ...(dropTitleTrans ? { "data-trans-title": dropTitleTrans } : {}),
            },
            components: [
              [
                {
                  type: "text",
                  tagName: "span",
                  selectable: true,
                  editable: false,
                  draggable: false,
                  attributes: {
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
        },
        { at: oldIndex },
      );
      model.move(wrapper, { at: 0 });
      ensureVariableGridCssRules();
    }

    editor.select(model);
  });
}
