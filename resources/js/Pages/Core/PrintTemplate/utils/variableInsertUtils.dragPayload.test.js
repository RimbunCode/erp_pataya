import { describe, expect, it } from "vitest";
import {
  buildTitleTransLookupMap,
  buildVariableDragPayload,
  buildLabelComponent,
  buildTokenComponent,
  buildSubGridComponent,
} from "./variableInsertUtils";

describe("buildVariableDragPayload titleTrans handling", () => {
  it("menyertakan titleTrans yang sudah di-trim", () => {
    const payload = buildVariableDragPayload({
      variable: {
        name: "customer_name",
        type: "data",
        titleTrans: "  sales.fields.customer_name  ",
      },
      nestedColumns: [],
      displayLabel: "Customer Name",
      fullKey: "customer_name",
    });

    expect(payload.titleTrans).toBe("sales.fields.customer_name");
  });

  it("menghilangkan titleTrans jika kosong/whitespace", () => {
    const payload = buildVariableDragPayload({
      variable: {
        name: "customer_name",
        type: "data",
        titleTrans: "   ",
      },
      nestedColumns: [],
      displayLabel: "Customer Name",
      fullKey: "customer_name",
    });

    expect(Object.prototype.hasOwnProperty.call(payload, "titleTrans")).toBe(
      false,
    );
  });

  it("mengambil titleTrans dari lookup dataTableColumns jika titleTrans di variable kosong", () => {
    const lookup = buildTitleTransLookupMap([
      {
        name: "doc",
        type: "doc",
        columns: [
          {
            name: "customer_name",
            titleTrans: "sales.fields.customer_name",
            type: "data",
          },
        ],
      },
    ]);

    const payload = buildVariableDragPayload({
      variable: {
        name: "customer_name",
        type: "data",
      },
      nestedColumns: [],
      displayLabel: "Customer Name",
      fullKey: "customer_name",
      titleTransLookup: lookup,
    });

    expect(payload.titleTrans).toBe("sales.fields.customer_name");
  });
});

describe("Drop Mode Component Builders", () => {
  const dummyPayload = {
    name: "customer_name",
    type: "data",
    labelKey: "doc.customer_name",
    formattedToken: "{{doc.customer_name}}",
    simplifiedToken: "{{customer_name}}",
    displayLabel: "Customer Name",
    titleTrans: "sales.fields.customer_name",
  };

  it("buildLabelComponent returns correct definition", () => {
    const definition = buildLabelComponent(dummyPayload);
    expect(definition.type).toBe("text");
    expect(definition.tagName).toBe("p");
    expect(definition.attributes["data-label-key"]).toBe("doc.customer_name");
    expect(definition.attributes["data-trans-title"]).toBe(
      "sales.fields.customer_name",
    );
    expect(definition.components[0].content).toBe("Customer Name");
  });

  it("buildTokenComponent returns correct definition", () => {
    const definition = buildTokenComponent(dummyPayload);
    expect(definition.type).toBe("text");
    expect(definition.tagName).toBe("p");
    expect(definition.components[0].attributes["data-token"]).toBe(
      "{{doc.customer_name}}",
    );
    expect(definition.components[0].content).toBe("{{customer_name}}");
  });

  it("buildSubGridComponent returns correct definition", () => {
    const definition = buildSubGridComponent(dummyPayload);
    expect(definition.type).toBe("gjsSubGrid");
    expect(definition.attributes["data-variable"]).toBe("customer_name");
    expect(definition.components.length).toBe(2);
    expect(definition.components[0].attributes["data-label-key"]).toBe(
      "doc.customer_name",
    );
    expect(
      definition.components[1].components[1].attributes["data-token"],
    ).toBe("{{doc.customer_name}}");
  });
});
