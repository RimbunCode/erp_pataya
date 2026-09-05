import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let capturedProps = null;
let renderCount = 0;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    renderCount += 1;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";

describe("<Logs> Index", () => {
  it("merender DataTable2 tepat satu kali tanpa error", () => {
    render(<Index />);
    expect(renderCount).toBe(1);
  });

  it("tidak meneruskan props apapun ke DataTable2 (wrapper murni tanpa kustomisasi)", () => {
    render(<Index />);
    expect(capturedProps).toEqual({});
  });
});
