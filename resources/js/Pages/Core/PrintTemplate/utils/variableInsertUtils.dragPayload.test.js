import { describe, expect, it } from "vitest";
import {
  buildTitleTransLookupMap,
  buildVariableDragPayload,
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
