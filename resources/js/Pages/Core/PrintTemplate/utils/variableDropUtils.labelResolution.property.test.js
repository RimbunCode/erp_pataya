import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";

vi.mock("@/lib/utils", () => ({
  generateRandom: () => "staticid",
}));

vi.mock("@/lib/gjsRelationsTable", () => ({
  buildExampleDataTable: () => [],
  getColumnLabel: (col) => col?.title || col?.name || "",
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { variableDropListener } from "./variableDropUtils";

class MockComponent {
  constructor({
    type = "default",
    tagName = "div",
    attributes = {},
    content = "",
    components = [],
    columnsConfig = [],
  } = {}) {
    this._type = type;
    this._tagName = tagName;
    this._attributes = { ...attributes };
    this._content = content;
    this._columnsConfig = columnsConfig;
    this._children = [];
    this._parent = null;
    this._classes = new Set();
    this.components(components);
  }

  getType() {
    return this._type;
  }

  getAttributes() {
    return { ...this._attributes };
  }

  addAttributes(attrs = {}) {
    this._attributes = { ...this._attributes, ...attrs };
  }

  setAttributes(attrs = {}) {
    this._attributes = { ...attrs };
  }

  get(prop) {
    if (prop === "tagName") {
      return this._tagName;
    }
    if (prop === "content") {
      return this._content;
    }
    if (prop === "columnsConfig") {
      return this._columnsConfig;
    }
    return undefined;
  }

  set(prop, value) {
    if (prop === "content") {
      this._content = value;
    }
  }

  components(nextComponents) {
    if (typeof nextComponents === "undefined") {
      return this._children;
    }

    const normalized = [];
    const queue = Array.isArray(nextComponents)
      ? [...nextComponents]
      : [nextComponents];
    while (queue.length > 0) {
      const item = queue.shift();
      if (Array.isArray(item)) {
        queue.unshift(...item);
        continue;
      }

      if (item instanceof MockComponent) {
        item._parent = this;
        normalized.push(item);
        continue;
      }

      const created = new MockComponent(item || {});
      created._parent = this;
      normalized.push(created);
    }

    this._children = normalized;
    return this._children;
  }

  find(selector) {
    if (!selector?.startsWith("[") || !selector.endsWith("]")) {
      return [];
    }

    const attributeName = selector.slice(1, -1);
    const result = [];
    this._walk((component) => {
      const attrs = component.getAttributes();
      if (Object.prototype.hasOwnProperty.call(attrs, attributeName)) {
        result.push(component);
      }
    });
    return result;
  }

  findType(type) {
    const result = [];
    this._walk((component) => {
      if (component.getType() === type) {
        result.push(component);
      }
    });
    return result;
  }

  parent() {
    return this._parent;
  }

  removeClass(className) {
    this._classes.delete(className);
  }

  addClass(className) {
    this._classes.add(className);
  }

  _walk(visitor) {
    for (const child of this._children) {
      visitor(child);
      child._walk(visitor);
    }
  }
}

function createMockEditor(wrapper) {
  const handlers = {};

  return {
    Css: {
      setRule: vi.fn(),
    },
    DomComponents: {
      addType: vi.fn(),
    },
    on(eventName, handler) {
      if (!handlers[eventName]) {
        handlers[eventName] = [];
      }
      handlers[eventName].push(handler);
    },
    getWrapper() {
      return wrapper;
    },
    _emit(eventName, ...args) {
      (handlers[eventName] || []).forEach((handler) => handler(...args));
    },
  };
}

const segmentArb = fc.stringMatching(/^[a-z][a-z0-9_]{1,12}$/);
const labelArb = fc
  .string({ minLength: 1, maxLength: 24 })
  .filter((value) => value.trim().length > 0);
const titleTransArb = fc.stringMatching(/^[a-z][a-z0-9_.]{3,32}$/);

describe("Feature: editor-label-resolution, Property 4", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("sync komponen gjsSubGrid mengubah content label dan data-trans-title saat resolve berhasil", () => {
    fc.assert(
      fc.property(
        segmentArb,
        segmentArb,
        labelArb,
        titleTransArb,
        (relationName, fieldName, resolvedLabel, titleTransKey) => {
          const modelDoc = "App\\Models\\Sales\\SalesOrder";
          const relatedModel = "App\\Models\\Master\\Customer";
          const labelKey = `doc.${relationName}.${fieldName}`;

          const labelContainer = new MockComponent({
            tagName: "p",
            attributes: {
              "data-label-key": labelKey,
              "data-trans-title": "old.translation.key",
            },
            components: [
              {
                tagName: "span",
                attributes: { contenteditable: "false" },
                content: "old label",
              },
            ],
          });
          const tokenSpan = new MockComponent({
            tagName: "span",
            attributes: { "data-token": "{{doc.sample}}" },
            content: "{{doc.sample}}",
          });
          const tokenContainer = new MockComponent({
            tagName: "p",
            components: [tokenSpan],
          });

          const subGrid = new MockComponent({
            type: "gjsSubGrid",
            attributes: {
              "data-variable": `${relationName}.${fieldName}`,
              "data-variable-type": "doc",
            },
            components: [labelContainer, tokenContainer],
          });

          const wrapper = new MockComponent({
            type: "wrapper",
            components: [subGrid],
          });
          const editor = createMockEditor(wrapper);

          const columns = {
            [modelDoc]: {
              [relationName]: {
                name: relationName,
                type: "relation",
                related: relatedModel,
                title: "Relation",
              },
            },
            [relatedModel]: {
              [fieldName]: {
                name: fieldName,
                title: resolvedLabel,
                titleTrans: titleTransKey,
              },
            },
          };

          variableDropListener(editor, {
            t: (key) => `TR:${key}`,
            locale: "id",
            dataTableColumns: [],
            docInfo: {},
            columns,
            modelDoc,
          });

          editor._emit("load");
          vi.runAllTimers();

          expect(labelContainer.components()[0].get("content")).toBe(
            resolvedLabel,
          );
          expect(labelContainer.getAttributes()["data-trans-title"]).toBe(
            titleTransKey,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: editor-label-resolution, Property 5", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("sync header gjsRelationsTable mengubah content dan data-trans-title saat resolve berhasil", () => {
    fc.assert(
      fc.property(
        segmentArb,
        segmentArb,
        labelArb,
        titleTransArb,
        (relationName, fieldName, resolvedLabel, titleTransKey) => {
          const modelDoc = "App\\Models\\Sales\\SalesOrder";
          const relatedModel = "App\\Models\\Sales\\SalesOrderItem";
          const labelKey = `doc.${relationName}.${fieldName}`;

          const thIndex = new MockComponent({
            tagName: "th",
            attributes: { name: "idx" },
            content: "#",
          });
          const thLabel = new MockComponent({
            tagName: "th",
            attributes: {
              "data-label-key": labelKey,
              name: fieldName,
              "data-trans-title": "old.table.title.trans",
            },
            content: "old header",
          });
          const headerRow = new MockComponent({
            tagName: "tr",
            components: [thIndex, thLabel],
          });
          const thead = new MockComponent({
            tagName: "thead",
            components: [headerRow],
          });
          const table = new MockComponent({
            type: "gjsRelationsTable",
            tagName: "table",
            columnsConfig: [{ name: fieldName, title: "Fallback Header" }],
            components: [thead],
          });
          const wrapper = new MockComponent({
            type: "wrapper",
            components: [table],
          });
          const editor = createMockEditor(wrapper);

          const columns = {
            [modelDoc]: {
              [relationName]: {
                name: relationName,
                type: "relation",
                related: relatedModel,
                title: "Relation",
              },
            },
            [relatedModel]: {
              [fieldName]: {
                name: fieldName,
                title: resolvedLabel,
                titleTrans: titleTransKey,
              },
            },
          };

          variableDropListener(editor, {
            t: (key) => `TR:${key}`,
            locale: "id",
            dataTableColumns: [],
            docInfo: {},
            columns,
            modelDoc,
          });

          editor._emit("load");
          vi.runAllTimers();

          expect(thLabel.get("content")).toBe(resolvedLabel);
          expect(thLabel.getAttributes()["data-trans-title"]).toBe(
            titleTransKey,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
