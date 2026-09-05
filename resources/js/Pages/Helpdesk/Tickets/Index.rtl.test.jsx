import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { isValidElement } from "react";

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";
import Form from "./Form";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("Helpdesk/Tickets Index", () => {
  it("meneruskan classNameDialog, form (elemen <Form/>), dan forceCanCreate ke DataTable2", () => {
    render(<Index />);

    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(isValidElement(capturedProps.form)).toBe(true);
    expect(capturedProps.form.type).toBe(Form);
    expect(capturedProps.forceCanCreate).toBe(true);
  });

  it("tidak meneruskan templateItem -- DataTable2 pakai default tampilan mobile-nya sendiri", () => {
    render(<Index />);

    expect(capturedProps.templateItem).toBeUndefined();
  });
});
