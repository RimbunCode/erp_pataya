/**
 * GrapesJS Approval Signature Plugin
 *
 * Mendaftarkan tipe komponen "approvalSignature" dan bloknya di panel blok
 * editor print template.
 *
 * Blok ini mengekspor pemanggilan helper Handlebars, bukan markup jadi:
 * tanda tangan baru diketahui saat dokumen di-render, bukan saat template
 * dirancang. Yang terlihat di kanvas hanyalah placeholder.
 */

/**
 * Nama helper Handlebars yang diekspor blok ini.
 */
const HELPER_NAME = "approvalSignature";

const PLACEHOLDER_HTML = `<div class="gjs-signature-placeholder">
  <span>Tanda Tangan</span>
  <small>Penandatangan final</small>
</div>`;

const EDITOR_ONLY_STYLES = `
  .gjs-signature-wrapper {
    position: relative;
    border: 2px dashed #0ea5e9;
    border-radius: 4px;
    padding: 12px;
    min-height: 64px;
  }
  .gjs-signature-wrapper::before {
    content: "TTD";
    position: absolute;
    top: -1px;
    left: 8px;
    background: #0ea5e9;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 0 0 4px 4px;
    letter-spacing: 0.5px;
    z-index: 1;
  }
`;

/**
 * Susun ekspresi Handlebars dari atribut komponen.
 *
 * TRIPLE-brace wajib: helper menghasilkan HTML, dan lightncandy di sisi
 * server meng-escape keluaran helper pada double-brace (tidak ada padanan
 * SafeString di sana). Template ber-double-brace akan tampil benar di
 * pratinjau tetapi keluar sebagai teks mentah di PDF.
 * @param {{showName?: boolean|string, showDate?: boolean|string}} options
 * @returns {string}
 */
export function buildSignatureExpression(options = {}) {
  const parts = [HELPER_NAME];

  if (isTruthy(options.showName)) parts.push("showName=true");
  if (isTruthy(options.showDate)) parts.push("showDate=true");

  return `{{{${parts.join(" ")}}}}`;
}

/**
 * Trait GrapesJS mengembalikan boolean, tetapi atribut yang dibaca kembali
 * dari markup tersimpan berupa string ("true"/"false"/""). Keduanya harus
 * ditafsirkan sama, kalau tidak round-trip simpan-muat mengubah arti
 * template.
 * @param {boolean|string|undefined} value
 * @returns {boolean}
 */
function isTruthy(value) {
  return value === true || value === "true" || value === "1";
}

/**
 * Baca ekspresi Handlebars kembali menjadi opsi. Kebalikan dari
 * `buildSignatureExpression`, dipakai saat template dimuat ulang.
 * @param {string} expression
 * @returns {{showName: boolean, showDate: boolean}|null}
 */
export function parseSignatureExpression(expression) {
  if (typeof expression !== "string") return null;

  const match = expression.match(
    new RegExp(`\\{\\{\\{?\\s*${HELPER_NAME}([^}]*)\\}?\\}\\}`),
  );
  if (!match) return null;

  const rest = match[1] ?? "";

  return {
    showName: /showName\s*=\s*true/.test(rest),
    showDate: /showDate\s*=\s*true/.test(rest),
  };
}

/**
 * Daftarkan tipe komponen dan blok tanda tangan pada editor.
 * @param {object} editor Instance GrapesJS.
 * @returns {void}
 */
export default function gjsSignature(editor) {
  const injectEditorStyles = () => {
    const frame = editor.Canvas.getFrameEl();
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;

    let styleEl = doc.getElementById("gjs-signature-editor-styles");
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "gjs-signature-editor-styles";
      doc.head.appendChild(styleEl);
    }
    styleEl.innerHTML = EDITOR_ONLY_STYLES;
  };

  editor.on("load", injectEditorStyles);

  editor.Components.addType("approvalSignature", {
    isComponent: (el) =>
      el?.getAttribute?.("data-gjs-type") === "approvalSignature"
        ? { type: "approvalSignature" }
        : undefined,

    model: {
      defaults: {
        tagName: "div",
        droppable: false,
        editable: false,
        layerable: true,
        selectable: true,
        hoverable: true,
        attributes: {
          class: "gjs-signature-wrapper",
          "data-gjs-type": "approvalSignature",
        },
        // TIDAK ada trait `sequence`: yang tercetak selalu penandatangan
        // final (approver pada step approved dengan sequence terbesar),
        // jadi step memang tidak bisa dipilih dari template.
        traits: [
          {
            type: "checkbox",
            name: "showName",
            label: "Tampilkan nama",
            valueTrue: "true",
            valueFalse: "false",
          },
          {
            type: "checkbox",
            name: "showDate",
            label: "Tampilkan tanggal",
            valueTrue: "true",
            valueFalse: "false",
          },
        ],
        styles: `
          .gjs-signature-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 12px;
            color: #0ea5e9;
            text-align: center;
          }
          .gjs-signature-placeholder span {
            font-weight: 600;
            font-size: 14px;
          }
          .gjs-signature-placeholder small {
            font-size: 11px;
            opacity: 0.7;
            margin-top: 4px;
          }
        `,
      },

      init() {
        this.set("content", PLACEHOLDER_HTML);
      },

      /**
       * Ekspor sebagai pemanggilan helper, bukan placeholder-nya. Atribut
       * trait ikut diserialisasi ke markup supaya template yang dimuat
       * ulang mengembalikan trait yang sama (round-trip).
       * @returns {string}
       */
      toHTML() {
        const attributes = this.getAttributes() ?? {};
        const expression = buildSignatureExpression({
          showName: attributes.showName,
          showDate: attributes.showDate,
        });

        const flags = [
          `data-gjs-type="approvalSignature"`,
          isTruthy(attributes.showName) ? `data-show-name="true"` : "",
          isTruthy(attributes.showDate) ? `data-show-date="true"` : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `<div class="gjs-signature-wrapper" ${flags}>${expression}</div>`;
      },
    },

    view: {
      onRender() {
        const content = this.model.get("content");
        if (content) this.el.innerHTML = content;
      },
    },
  });

  editor.Blocks.add("approvalSignature", {
    label: "Tanda Tangan",
    category: "Approval",
    media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 17c3-1 4-8 7-8s3 6 6 6 2-4 5-4"></path>
      <line x1="3" y1="21" x2="21" y2="21"></line>
    </svg>`,
    content: { type: "approvalSignature" },
    activate: true,
  });
}
