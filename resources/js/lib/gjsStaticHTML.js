/**
 * GrapeJS Static HTML Component Plugin
 *
 * Registers the "staticHTML" component type and block in GrapeJS.
 * When added to the canvas, it shows a visual indicator (badge/border)
 * indicating it's a custom HTML block.
 *
 * The actual HTML editing is handled by the StaticHTMLComponent modal
 * which is triggered from the editor when the component is double-clicked
 * or added fresh.
 *
 * Requirements: 6.1, 6.2, 6.8
 */

import { sanitizeHTML } from "@/lib/htmlSanitizer";

/**
 * Default placeholder content shown in canvas when no HTML is set.
 */
const PLACEHOLDER_HTML = `<div class="gjs-static-html-placeholder">
  <span>Custom HTML Block</span>
  <small>Double-click to edit</small>
</div>`;

/**
 * Editor-only styles for the static HTML wrapper.
 * These are injected directly into the canvas iframe and are NOT included
 * in CSS export or print preview output (Requirements: 24.1, 24.2, 24.3, 24.4).
 */
const EDITOR_ONLY_STYLES = `
  .gjs-static-html-wrapper {
    position: relative;
    border: 2px dashed #6366f1;
    border-radius: 4px;
    padding: 12px;
    min-height: 48px;
  }
  .gjs-static-html-wrapper::before {
    content: "HTML";
    position: absolute;
    top: -1px;
    left: 8px;
    background: #6366f1;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 0 0 4px 4px;
    letter-spacing: 0.5px;
    z-index: 1;
  }
`;

export default function gjsStaticHTML(editor) {
  // Inject editor-only styles into the canvas iframe (not exported via getCss)
  const injectEditorStyles = () => {
    const frame = editor.Canvas.getFrameEl();
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc) return;

    let styleEl = doc.getElementById("gjs-static-html-editor-styles");
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "gjs-static-html-editor-styles";
      doc.head.appendChild(styleEl);
    }
    styleEl.innerHTML = EDITOR_ONLY_STYLES;
  };

  editor.on("load", injectEditorStyles);

  // 1. Register the "staticHTML" component type with proper defaults
  editor.Components.addType("staticHTML", {
    model: {
      defaults: {
        tagName: "div",
        droppable: false,
        editable: false,
        layerable: true,
        selectable: true,
        hoverable: true,
        attributes: {
          class: "gjs-static-html-wrapper",
          "data-gjs-type": "staticHTML",
        },
        // Store the raw user HTML and sanitized HTML
        customHTML: "",
        sanitizedHTML: "",
        sanitizationWarnings: [],
        // Only placeholder styles are exported (harmless in print).
        // Editor-only border/::before styles are injected into the canvas
        // iframe directly and excluded from CSS export (Requirements: 24.3, 24.4).
        styles: `
          .gjs-static-html-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 16px;
            color: #6366f1;
            text-align: center;
          }
          .gjs-static-html-placeholder span {
            font-weight: 600;
            font-size: 14px;
          }
          .gjs-static-html-placeholder small {
            font-size: 11px;
            opacity: 0.7;
            margin-top: 4px;
          }
        `,
        traits: [],
      },

      init() {
        // Use `content` to render raw HTML without GrapesJS parsing it
        // into editable child components.
        const sanitized = this.get("sanitizedHTML");
        if (sanitized) {
          // Loaded from saved data — render the sanitized HTML directly
          this.set("content", sanitized);
        } else if (!this.get("customHTML")) {
          // Fresh component — show placeholder
          this.set("content", PLACEHOLDER_HTML);
        }
      },

      /**
       * Update the component content with sanitized HTML.
       * Called from the StaticHTMLComponent modal on save.
       *
       * @param {string} rawHTML - The raw user-provided HTML
       */
      setCustomHTML(rawHTML) {
        const result = sanitizeHTML(rawHTML);
        this.set("customHTML", rawHTML);
        this.set("sanitizedHTML", result.sanitizedHTML);
        this.set("sanitizationWarnings", result.warnings || []);

        // Use `content` instead of `components()` to render raw HTML directly
        // in the canvas view. This prevents GrapesJS from parsing children into
        // editable component nodes, keeping the canvas faithful to the actual HTML
        // and consistent with the Inspector preview.
        if (result.sanitizedHTML) {
          // Clear any previously parsed child components
          this.components().reset();
          this.set("content", result.sanitizedHTML);
        } else {
          this.components().reset();
          this.set("content", PLACEHOLDER_HTML);
        }

        // Trigger view re-render
        this.trigger("change:content");

        return result;
      },

      /**
       * Override toHTML to output the sanitized HTML content
       * (not the wrapper/placeholder structure).
       */
      toHTML() {
        const sanitized = this.get("sanitizedHTML");
        if (sanitized) {
          return `<div class="gjs-static-html-wrapper">${sanitized}</div>`;
        }
        return `<div class="gjs-static-html-wrapper"></div>`;
      },
    },

    view: {
      // Override the view to render `content` as innerHTML directly,
      // preventing GrapesJS from creating editable child component views.
      onRender() {
        const content = this.model.get("content");
        if (content) {
          this.el.innerHTML = content;
        }

        // Ensure no child element is contenteditable
        this.disableChildContentEditable();
      },

      /**
       * Disable contenteditable on all child elements within the wrapper.
       * This prevents accidental inline editing of staticHTML content on the canvas.
       */
      disableChildContentEditable() {
        const children = this.el.querySelectorAll("[contenteditable]");
        children.forEach((child) => {
          child.removeAttribute("contenteditable");
        });
      },
    },
  });

  // 2. Register the "Static HTML" block in the blocks panel (Requirement 6.1)
  editor.Blocks.add("staticHTML", {
    label: "Custom HTML",
    category: "Basic",
    media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
      <line x1="12" y1="2" x2="12" y2="22" opacity="0.3"></line>
    </svg>`,
    content: { type: "staticHTML" },
    activate: true,
  });

  // 3. Open the HTML editor modal when the staticHTML component is double-clicked
  //    or when it's first added to the canvas.
  //    The modal opening is handled via a custom event that the Editor.jsx listens to.
  editor.on("component:dblclick", (component) => {
    if (component.get("type") === "staticHTML") {
      editor.trigger("staticHTML:edit", component);
    }
  });

  // When a new staticHTML component is added, trigger the edit modal
  // Only open for freshly added components (no existing customHTML content),
  // not for components being loaded from a saved template.
  editor.on("component:add", (component) => {
    if (
      component.get("type") === "staticHTML" &&
      !component.get("customHTML")
    ) {
      // Small delay to let the component render first
      setTimeout(() => {
        editor.trigger("staticHTML:edit", component);
      }, 100);
    }
  });
}
