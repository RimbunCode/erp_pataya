/**
 * Unit tests for resources/js/lib/gjsTable.js
 *
 * gjsTable.js is a GrapesJS plugin: its default export `gjsTable(editor)`
 * only registers component types, a block, six editor Commands, and two
 * `editor.on("load", ...)` callbacks. Every bit of real logic (countCols,
 * normalizeTable, normalizeTableRows, getSelectedCell, findRowModel,
 * findSectionModel, findTableModel) is a closure defined *inside*
 * `gjsTable(editor)` — none of it is exported, so it cannot be imported and
 * unit-tested directly (confirmed via `grep -n "^export" gjsTable.js`: the
 * only export is the default `gjsTable` function itself).
 *
 * To exercise that logic without a full GrapesJS editor instance, these
 * tests build a small GrapesJS-Component-shaped mock (get/set,
 * getAttributes/addAttributes, components()/append(), parent(), find(),
 * remove()) — just enough of the API surface gjsTable.js actually calls —
 * and a mock `editor` whose Commands.add()/DomComponents.addType()/
 * Blocks.add()/on() capture what gjsTable(editor) registers. The captured
 * command `run()` functions are then invoked against hand-built table
 * fixtures to verify the plugin's real behavior (documented, not "fixed" —
 * see the two `[bug]`-tagged tests).
 *
 * `enableColumnResize()` (mouse-drag column resizing wired to
 * `editor.Canvas.getDocument()/getBody()` inside the first "load" callback)
 * is intentionally NOT covered — see "skipped" in the structured task
 * output for why.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import gjsTable from "./gjsTable";

// ---------------------------------------------------------------------------
// Minimal GrapesJS-Component/Collection mock
// ---------------------------------------------------------------------------

class _MockCollection {
  constructor(owner) {
    this._owner = owner;
    this.items = [];
  }

  get length() {
    return this.items.length;
  }

  toArray() {
    return this.items.slice();
  }

  filter(fn) {
    return this.items.filter(fn);
  }

  forEach(fn) {
    this.items.forEach(fn);
  }

  reduce(fn, init) {
    return this.items.reduce(fn, init);
  }

  indexOf(item) {
    return this.items.indexOf(item);
  }

  at(i) {
    return this.items[i];
  }

  add(defOrComp, opts = {}) {
    const comp =
      defOrComp instanceof _MockComponent
        ? defOrComp
        : buildComponent(defOrComp);
    comp._parent = this._owner;
    const at = opts.at === undefined ? this.items.length : opts.at;
    this.items.splice(at, 0, comp);
    return comp;
  }

  removeItem(item) {
    const idx = this.items.indexOf(item);
    if (idx !== -1) this.items.splice(idx, 1);
  }
}

class _MockComponent {
  constructor({ tagName, attributes = {}, content = "", type, toolbar } = {}) {
    this._tagName = tagName;
    this._attributes = { ...attributes };
    this._content = content;
    this._type = type;
    this._toolbar = toolbar;
    this._style = {};
    this._parent = null;
    this._children = new _MockCollection(this);
  }

  get(key) {
    switch (key) {
      case "tagName":
        return this._tagName;
      case "content":
        return this._content;
      case "attributes":
        return this._attributes;
      case "type":
        return this._type;
      case "toolbar":
        return this._toolbar;
      default:
        return undefined;
    }
  }

  set(key, value) {
    if (key === "content") this._content = value;
    else if (key === "toolbar") this._toolbar = value;
    else if (key === "type") this._type = value;
    return this;
  }

  getAttributes() {
    return { ...this._attributes };
  }

  addAttributes(attrs) {
    Object.assign(this._attributes, attrs);
    return this;
  }

  getStyle() {
    return this._style;
  }

  setStyle(style) {
    this._style = style;
    return this;
  }

  trigger() {}

  parent() {
    return this._parent;
  }

  components() {
    return this._children;
  }

  append(def, opts) {
    return this._children.add(def, opts);
  }

  find(selector) {
    const results = [];
    const walk = (node) => {
      node
        .components()
        .toArray()
        .forEach((child) => {
          if (matchesSelector(child, selector)) results.push(child);
          walk(child);
        });
    };
    walk(this);
    return results;
  }

  remove() {
    if (this._parent) this._parent.components().removeItem(this);
  }
}

function matchesSelector(comp, selector) {
  const attrMatch = selector.match(/^\[([\w-]+)="([^"]*)"\]$/);
  if (attrMatch) {
    const [, attr, value] = attrMatch;
    if (attr === "data-gjs-type") return comp.get("type") === value;
    return comp.getAttributes()[attr] === value;
  }
  const tags = selector.split(",").map((s) => s.trim());
  return tags.includes(comp.get("tagName"));
}

function buildComponent(def) {
  const comp = new _MockComponent({
    tagName: def.tagName,
    attributes: def.attributes,
    content: def.content,
    type: def.type,
    toolbar: def.toolbar,
  });
  (def.components || []).forEach((childDef) => {
    comp._children.add(childDef);
  });
  return comp;
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function cellDef(tagName, content, attributes = {}) {
  return { type: "text", tagName, content, attributes };
}

function rowDef(cells, attributes = {}) {
  return { tagName: "tr", attributes, components: cells };
}

function sectionDef(tagName, rows) {
  return { tagName, components: rows };
}

function tableDef(sections) {
  return { tagName: "table", components: sections };
}

function getCell(root, dataId) {
  return root.find(`[data-id="${dataId}"]`)[0];
}

// ---------------------------------------------------------------------------
// Mock editor
// ---------------------------------------------------------------------------

function createMockEditor() {
  const commands = {};
  const listeners = {};
  const editor = {
    DomComponents: { addType: vi.fn() },
    Commands: {
      add: vi.fn((name, obj) => {
        commands[name] = obj;
      }),
    },
    Blocks: { add: vi.fn() },
    on: vi.fn((event, cb) => {
      (listeners[event] ||= []).push(cb);
    }),
    getSelected: vi.fn(() => null),
    select: vi.fn(),
    getWrapper: vi.fn(),
    trigger: vi.fn(),
    store: vi.fn(),
  };
  return { editor, commands, listeners };
}

let editor;
let commands;
let listeners;

beforeEach(() => {
  ({ editor, commands, listeners } = createMockEditor());
  gjsTable(editor);
});

// ---------------------------------------------------------------------------
// Type & block registration (pure, deterministic data — asserted directly)
// ---------------------------------------------------------------------------

describe("gjsTable(editor) — registration", () => {
  it("registers exactly six commands with a run function each", () => {
    const names = editor.Commands.add.mock.calls.map((call) => call[0]);
    expect(names).toEqual([
      "add-row",
      "remove-row",
      "add-column",
      "remove-column",
      "merge-right",
      "merge-down",
    ]);
    names.forEach((name) => {
      expect(typeof commands[name].run).toBe("function");
    });
  });

  it("registers two 'load' listeners (column-resize wiring + cell toolbar refresh)", () => {
    expect(listeners.load).toHaveLength(2);
  });

  it("registers the gjsTable component type as a <table class='gjs-table'>", () => {
    expect(editor.DomComponents.addType).toHaveBeenCalledTimes(1);
    const [typeName, config] = editor.DomComponents.addType.mock.calls[0];
    expect(typeName).toBe("gjsTable");
    const defaults = config.model.defaults;
    expect(defaults.tagName).toBe("table");
    expect(defaults.attributes).toEqual({ class: "gjs-table" });
    expect(defaults.styles).toContain(".gjs-table");
  });

  it("default table type has thead/tbody/tfoot, each with one row of two cells", () => {
    const [, config] = editor.DomComponents.addType.mock.calls[0];
    const sections = config.model.defaults.components;
    expect(sections.map((s) => s.tagName)).toEqual(["thead", "tbody", "tfoot"]);

    const [thead, tbody, tfoot] = sections;
    expect(thead.components).toHaveLength(1);
    expect(thead.components[0].components.map((c) => c.content)).toEqual([
      "Header 1",
      "Header 2",
    ]);
    expect(
      thead.components[0].components.every((c) => c.tagName === "th"),
    ).toBe(true);

    expect(tbody.components[0].components.map((c) => c.content)).toEqual([
      "Cell 1",
      "Cell 2",
    ]);
    expect(
      tbody.components[0].components.every((c) => c.tagName === "td"),
    ).toBe(true);

    expect(tfoot.components[0].components.map((c) => c.content)).toEqual([
      "Footer 1",
      "Footer 2",
    ]);
    expect(
      tfoot.components[0].components.every((c) => c.tagName === "td"),
    ).toBe(true);
  });

  it("every default cell gets a unique cell-<8 chars> data-id and a 6-command toolbar", () => {
    const [, config] = editor.DomComponents.addType.mock.calls[0];
    const allCells = config.model.defaults.components.flatMap((section) =>
      section.components.flatMap((row) => row.components),
    );
    expect(allCells).toHaveLength(6);

    const ids = allCells.map((c) => c.attributes["data-id"]);
    ids.forEach((id) => expect(id).toMatch(/^cell-[A-Za-z0-9]{8}$/));
    expect(new Set(ids).size).toBe(ids.length); // all unique

    allCells.forEach((cell) => {
      expect(cell.toolbar.map((t) => t.command)).toEqual([
        "add-row",
        "remove-row",
        "add-column",
        "remove-column",
        "merge-right",
        "merge-down",
      ]);
    });
  });

  it("registers the 'Table' block under the 'Dokumen' category", () => {
    expect(editor.Blocks.add).toHaveBeenCalledWith("gjsTable", {
      label: "Table",
      category: "Dokumen",
      content: { type: "gjsTable" },
    });
  });
});

describe("gjsTable(editor) — 'load': re-attach cell toolbars", () => {
  it("finds every [data-gjs-type=gjsTable] component and re-sets a 6-command toolbar on its td/th cells", () => {
    const wrapper = buildComponent({
      tagName: "body",
      components: [
        {
          tagName: "table",
          type: "gjsTable",
          components: [
            {
              tagName: "tbody",
              components: [rowDef([cellDef("td", "A", { "data-id": "a" })])],
            },
          ],
        },
      ],
    });
    editor.getWrapper.mockReturnValue(wrapper);

    // listeners.load[0] wires enableColumnResize (not covered here — DOM-based).
    // listeners.load[1] is the cell-toolbar-refresh handler under test.
    listeners.load[1]();

    const cell = getCell(wrapper, "a");
    expect(cell.get("toolbar").map((t) => t.command)).toEqual([
      "add-row",
      "remove-row",
      "add-column",
      "remove-column",
      "merge-right",
      "merge-down",
    ]);
  });

  it("does nothing when the wrapper has no gjsTable-typed component", () => {
    const wrapper = buildComponent({
      tagName: "body",
      components: [
        {
          tagName: "table",
          components: [
            {
              tagName: "tbody",
              components: [rowDef([cellDef("td", "A", { "data-id": "a" })])],
            },
          ],
        },
      ],
    });
    editor.getWrapper.mockReturnValue(wrapper);

    listeners.load[1]();

    const cell = getCell(wrapper, "a");
    expect(cell.get("toolbar")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// add-row
// ---------------------------------------------------------------------------

describe("command: add-row", () => {
  it("does nothing when nothing is selected", () => {
    editor.getSelected.mockReturnValue(null);
    commands["add-row"].run(editor);
    expect(editor.select).not.toHaveBeenCalled();
  });

  it("does nothing when the selected cell has no <tr> ancestor", () => {
    const orphanCell = buildComponent(cellDef("td", "x"));
    editor.getSelected.mockReturnValue(orphanCell);
    commands["add-row"].run(editor);
    expect(editor.select).not.toHaveBeenCalled();
  });

  it("inserts a new <tr> directly after the selected row, matching its column count", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "A", { "data-id": "a" }),
            cellDef("td", "B", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    const tbody = table.components().at(0);
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["add-row"].run(editor);

    const rows = tbody.components().toArray();
    expect(rows).toHaveLength(2);
    const newCells = rows[1].components().toArray();
    expect(newCells).toHaveLength(2);
    newCells.forEach((c) => {
      expect(c.get("tagName")).toBe("td");
      expect(c.get("content")).toBe("New Cell");
      expect(c.getAttributes()["data-id"]).toMatch(/^cell-[A-Za-z0-9]{8}$/);
    });
  });

  it("uses <th> cells when the selected row lives in <thead>", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("thead", [
          rowDef([cellDef("th", "H1", { "data-id": "h1" })]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "h1"));

    commands["add-row"].run(editor);

    const thead = table.components().at(0);
    const newRow = thead.components().at(1);
    expect(newRow.components().at(0).get("tagName")).toBe("th");
  });

  it("[bug] editor.select() is called with the raw row definition object, not the Component the Collection actually created", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([cellDef("td", "A", { "data-id": "a" })], {
            "data-id": "row1",
          }),
        ]),
      ]),
    );
    const tbody = table.components().at(0);
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["add-row"].run(editor);

    expect(editor.select).toHaveBeenCalledTimes(1);
    const selectedArg = editor.select.mock.calls[0][0];
    const actualInsertedRow = tbody.components().at(1);

    // Documents the current (buggy) behavior: `section.components().add(newRow, ...)`
    // creates and inserts the real row Component, but its return value is
    // discarded — `editor.select(newRow)` re-passes the *plain insertion
    // spec* instead. A real Component exposes `.get`/`.components`; this
    // object does not, so calling the real editor.select() with it will not
    // select the freshly-inserted row in the canvas.
    expect(selectedArg).not.toBe(actualInsertedRow);
    expect(typeof selectedArg.get).not.toBe("function");
    expect(selectedArg.tagName).toBe("tr");
  });
});

// ---------------------------------------------------------------------------
// remove-row
// ---------------------------------------------------------------------------

describe("command: remove-row", () => {
  it("does nothing when nothing is selected", () => {
    editor.getSelected.mockReturnValue(null);
    expect(() => commands["remove-row"].run(editor)).not.toThrow();
  });

  it("removes the selected row when more than one row exists in its section", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([cellDef("td", "A", { "data-id": "a" })], {
            "data-id": "row1",
          }),
          rowDef([cellDef("td", "B", { "data-id": "b" })], {
            "data-id": "row2",
          }),
        ]),
      ]),
    );
    const tbody = table.components().at(0);
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["remove-row"].run(editor);

    const rows = tbody.components().toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttributes()["data-id"]).toBe("row2");
  });

  it("keeps the row when it is the only row left in its section", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([cellDef("td", "A", { "data-id": "a" })], {
            "data-id": "row1",
          }),
        ]),
      ]),
    );
    const tbody = table.components().at(0);
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["remove-row"].run(editor);

    expect(tbody.components().toArray()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// add-column
// ---------------------------------------------------------------------------

describe("command: add-column", () => {
  it("does nothing when getSelectedCell() resolves to null", () => {
    const div = buildComponent({ tagName: "div" });
    editor.getSelected.mockReturnValue(div);
    expect(() => commands["add-column"].run()).not.toThrow();
  });

  it("inserts a new cell after the selected column in every section, matching each section's cell tag", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("thead", [
          rowDef([
            cellDef("th", "H1", { "data-id": "h1" }),
            cellDef("th", "H2", { "data-id": "h2" }),
          ]),
        ]),
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "A", { "data-id": "a" }),
            cellDef("td", "B", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "h1")); // colIndex 0

    commands["add-column"].run();

    const theadRow = table.components().at(0).components().at(0);
    const tbodyRow = table.components().at(1).components().at(0);
    expect(theadRow.components().toArray()).toHaveLength(3);
    expect(tbodyRow.components().toArray()).toHaveLength(3);
    expect(theadRow.components().at(1).get("tagName")).toBe("th");
    expect(theadRow.components().at(1).get("content")).toBe("New");
    expect(tbodyRow.components().at(1).get("tagName")).toBe("td");
    expect(tbodyRow.components().at(1).get("content")).toBe("New");
  });

  it("appends the new cell at the end when the selected column is the last one", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "A", { "data-id": "a" }),
            cellDef("td", "B", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "b")); // last col

    commands["add-column"].run();

    const tbodyRow = table.components().at(0).components().at(0);
    const cells = tbodyRow.components().toArray();
    expect(cells).toHaveLength(3);
    expect(cells[2].get("content")).toBe("New");
  });

  it("resolves the column through getSelectedCell() when a whole <table> is selected", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "A", { "data-id": "a" }),
            cellDef("td", "B", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(table); // table itself selected, not a cell

    commands["add-column"].run();

    const tbodyRow = table.components().at(0).components().at(0);
    expect(tbodyRow.components().toArray()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// remove-column
// ---------------------------------------------------------------------------

describe("command: remove-column", () => {
  it("does nothing when getSelectedCell() resolves to null", () => {
    const div = buildComponent({ tagName: "div" });
    editor.getSelected.mockReturnValue(div);
    expect(() => commands["remove-column"].run()).not.toThrow();
  });

  it("refuses to remove the last remaining column", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [rowDef([cellDef("td", "A", { "data-id": "a" })])]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["remove-column"].run();

    const tbodyRow = table.components().at(0).components().at(0);
    expect(tbodyRow.components().toArray()).toHaveLength(1);
  });

  it("removes the selected column's cell from every section", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("thead", [
          rowDef([
            cellDef("th", "H1", { "data-id": "h1" }),
            cellDef("th", "H2", { "data-id": "h2" }),
          ]),
        ]),
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "A", { "data-id": "a" }),
            cellDef("td", "B", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "h1")); // colIndex 0

    commands["remove-column"].run();

    const theadRow = table.components().at(0).components().at(0);
    const tbodyRow = table.components().at(1).components().at(0);
    expect(
      theadRow
        .components()
        .toArray()
        .map((c) => c.getAttributes()["data-id"]),
    ).toEqual(["h2"]);
    expect(
      tbodyRow
        .components()
        .toArray()
        .map((c) => c.getAttributes()["data-id"]),
    ).toEqual(["b"]);
  });

  it("falls back to removing a row's last cell when that row is shorter than the selected column index", () => {
    // Deliberately uneven fixture (bypassing normalizeTable) to exercise the
    // `cells[colIndex]` undefined fallback branch.
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef(
            [
              cellDef("td", "A", { "data-id": "a" }),
              cellDef("td", "B", { "data-id": "b" }),
              cellDef("td", "C", { "data-id": "c" }),
            ],
            { "data-id": "row1" },
          ),
          rowDef(
            [
              cellDef("td", "D", { "data-id": "d" }),
              cellDef("td", "E", { "data-id": "e" }),
            ],
            { "data-id": "row2" },
          ),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "c")); // colIndex 2 in row1

    commands["remove-column"].run();

    const tbody = table.components().at(0);
    const row1 = tbody.components().at(0);
    const row2 = tbody.components().at(1);
    expect(
      row1
        .components()
        .toArray()
        .map((c) => c.getAttributes()["data-id"]),
    ).toEqual(["a", "b"]); // "c" removed directly by index
    // row2 has no cell at index 2, so the fallback removes its LAST cell
    // ("e"), not the cell that logically lines up with column 2. The
    // subsequent normalizeTable() call then pads row2 back up to row1's
    // column count (2) with a fresh blank filler cell.
    const row2Cells = row2.components().toArray();
    expect(row2Cells).toHaveLength(2);
    expect(row2Cells[0].getAttributes()["data-id"]).toBe("d");
    expect(row2Cells[1].get("content")).toBe("New");
    expect(row2Cells[1].get("tagName")).toBe("td");
  });
});

// ---------------------------------------------------------------------------
// merge-right
// ---------------------------------------------------------------------------

describe("command: merge-right", () => {
  it("does nothing when getSelectedCell() resolves to null", () => {
    const div = buildComponent({ tagName: "div" });
    editor.getSelected.mockReturnValue(div);
    expect(() => commands["merge-right"].run()).not.toThrow();
  });

  it("does nothing when the selected cell is the last column", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "A", { "data-id": "a" }),
            cellDef("td", "B", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "b"));

    commands["merge-right"].run();

    const row = table.components().at(0).components().at(0);
    expect(row.components().toArray()).toHaveLength(2);
  });

  it("merges default colspans (1+1=2), concatenates content, and removes the next cell", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "Left", { "data-id": "a" }),
            cellDef("td", "Right", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["merge-right"].run();

    const row = table.components().at(0).components().at(0);
    const cells = row.components().toArray();
    expect(cells).toHaveLength(1);
    expect(cells[0].getAttributes()["data-id"]).toBe("a");
    expect(cells[0].getAttributes().colspan).toBe(2);
    expect(cells[0].get("content")).toBe("Left Right");
  });

  it("sums existing colspan values from both merged cells", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "Left", { "data-id": "a", colspan: 2 }),
            cellDef("td", "Right", { "data-id": "b", colspan: 3 }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["merge-right"].run();

    const row = table.components().at(0).components().at(0);
    expect(row.components().at(0).getAttributes().colspan).toBe(5);
  });

  it("trims the joining space when one side's content is empty", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([
            cellDef("td", "", { "data-id": "a" }),
            cellDef("td", "Right", { "data-id": "b" }),
          ]),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["merge-right"].run();

    const row = table.components().at(0).components().at(0);
    expect(row.components().at(0).get("content")).toBe("Right");
  });
});

// ---------------------------------------------------------------------------
// merge-down
// ---------------------------------------------------------------------------

describe("command: merge-down", () => {
  it("does nothing when getSelectedCell() resolves to null", () => {
    const div = buildComponent({ tagName: "div" });
    editor.getSelected.mockReturnValue(div);
    expect(() => commands["merge-down"].run()).not.toThrow();
  });

  it("does nothing when there is no row below in the section", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [rowDef([cellDef("td", "A", { "data-id": "a" })])]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["merge-down"].run();

    const tbody = table.components().at(0);
    expect(tbody.components().toArray()).toHaveLength(1);
  });

  it("does nothing when the row below has no cell at the same index", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef(
            [
              cellDef("td", "A", { "data-id": "a" }),
              cellDef("td", "B", { "data-id": "b" }),
            ],
            { "data-id": "row1" },
          ),
          rowDef([], { "data-id": "row2" }), // empty row: no cell at any index
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["merge-down"].run();

    const tbody = table.components().at(0);
    const row1 = tbody.components().at(0);
    expect(
      row1
        .components()
        .toArray()
        .map((c) => c.getAttributes()["data-id"]),
    ).toEqual(["a", "b"]); // untouched
  });

  it("merges default rowspans (1+1=2), concatenates content, and removes the cell below (single-column table)", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef([cellDef("td", "Top", { "data-id": "a" })], {
            "data-id": "row1",
          }),
          rowDef([cellDef("td", "Bottom", { "data-id": "b" })], {
            "data-id": "row2",
          }),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["merge-down"].run();

    const tbody = table.components().at(0);
    const row1 = tbody.components().at(0);
    const row2 = tbody.components().at(1);
    expect(row1.components().toArray()).toHaveLength(1);
    expect(row1.components().at(0).getAttributes().rowspan).toBe(2);
    expect(row1.components().at(0).get("content")).toBe("Top Bottom");
    // In a single-column table, row2's cell is fully covered by row1's new
    // rowspan=2, so the post-merge normalizeTableRows() rowspan-trim pass
    // removes any cell normalizeTable() had padded back in at that slot,
    // correctly leaving row2 with zero cells.
    expect(row2.components().toArray()).toHaveLength(0);
  });

  it("[bug] in a multi-column table, merging down silently deletes the sibling column's cell in the row below and replaces it with a blank filler", () => {
    const table = buildComponent(
      tableDef([
        sectionDef("tbody", [
          rowDef(
            [
              cellDef("td", "Top", { "data-id": "a" }),
              cellDef("td", "Keep1", { "data-id": "keep1" }),
            ],
            { "data-id": "row1" },
          ),
          rowDef(
            [
              cellDef("td", "Bottom", { "data-id": "b" }),
              cellDef("td", "Keep2", { "data-id": "keep2" }),
            ],
            { "data-id": "row2" },
          ),
        ]),
      ]),
    );
    editor.getSelected.mockReturnValue(getCell(table, "a"));

    commands["merge-down"].run();

    const tbody = table.components().at(0);
    const row1 = tbody.components().at(0);
    const row2 = tbody.components().at(1);

    // Row 1: merge behaved as intended — one rowspan=2 cell plus the
    // untouched sibling column.
    expect(
      row1
        .components()
        .toArray()
        .map((c) => c.getAttributes()["data-id"]),
    ).toEqual(["a", "keep1"]);

    // Row 2 SHOULD end up with only "keep2" (column 0 is now covered by
    // row1's rowspan). Instead: normalizeTable()/normalizeTableRows()
    // compute each row's column count from literal cell colspans only —
    // ignorant of columns already covered by a rowspan from a prior row —
    // so they pad row2 back up to 2 cells with a blank "New" filler
    // *appended at the end* (array index 1, not index 0). The subsequent
    // rowspan-trim step then deletes "whatever sits at row2's index 0" to
    // honor row1's rowspan — which by then is "keep2" (shifted into index
    // 0), not the filler. Net result: the user's real "Keep2" content is
    // silently destroyed and replaced by an empty filler cell.
    const row2Ids = row2
      .components()
      .toArray()
      .map((c) => c.getAttributes()["data-id"]);
    expect(row2Ids).not.toContain("keep2");
    expect(row2.components().toArray()).toHaveLength(1);
    expect(row2.components().at(0).get("content")).toBe("New");
  });
});
