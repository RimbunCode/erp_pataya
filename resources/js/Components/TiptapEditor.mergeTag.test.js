import { describe, it, expect } from "vitest";

import { dotPathToMergeTagToken } from "./TiptapEditor";

describe("dotPathToMergeTagToken", () => {
  it("converts a single-segment path to a direct attribute token", () => {
    expect(dotPathToMergeTagToken("doc")).toBe("{{ $doc }}");
  });

  it("converts a two-segment path (attribute access)", () => {
    expect(dotPathToMergeTagToken("doc.number")).toBe("{{ $doc->number }}");
  });

  it("converts a three-segment path (one relation hop)", () => {
    expect(dotPathToMergeTagToken("doc.customer.name")).toBe(
      "{{ $doc->customer->name }}",
    );
  });

  it("converts a deeply nested path (multiple relation hops)", () => {
    expect(dotPathToMergeTagToken("doc.customer.address.city")).toBe(
      "{{ $doc->customer->address->city }}",
    );
  });

  it("handles the docInfo and company prefixes the same way", () => {
    expect(dotPathToMergeTagToken("docInfo.doc_name")).toBe(
      "{{ $docInfo->doc_name }}",
    );
    expect(dotPathToMergeTagToken("company.company_name")).toBe(
      "{{ $company->company_name }}",
    );
  });
});
