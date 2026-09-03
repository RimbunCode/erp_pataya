import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const routerPost = vi.fn();
const usePageMock = vi.fn(() => ({
  props: { model: "core.gl_posting_status" },
}));
vi.mock("@inertiajs/react", () => ({
  router: { post: (...args) => routerPost(...args) },
  usePage: () => usePageMock(),
}));

const canMock = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: (model) => ({
    can: (...args) => canMock(model, ...args),
  }),
}));

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("Core/GlPostingStatuses Index", () => {
  beforeEach(() => {
    capturedProps = null;
    routerPost.mockClear();
    canMock.mockReset();
    canMock.mockReturnValue(true);
    usePageMock.mockClear();
  });

  it("meneruskan actions ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.actions).toBe("function");
  });

  it("actions mengembalikan falsy saat dataRow.status bukan 'failed', walau can('write') true", () => {
    render(<Index />);
    const dataRow = { id: 1, status: "posted" };
    const result = capturedProps.actions({ dataRow });

    expect(result).toBeFalsy();
  });

  it("actions mengembalikan falsy saat status 'failed' tapi can('write') false", () => {
    canMock.mockReturnValue(false);
    render(<Index />);
    const dataRow = { id: 2, status: "failed" };
    const result = capturedProps.actions({ dataRow });

    expect(result).toBeFalsy();
    expect(canMock).toHaveBeenCalledWith("core.gl_posting_status", "write");
  });

  it("actions merender tombol retry saat status 'failed' dan can('write') true", () => {
    render(<Index />);
    const dataRow = { id: 3, status: "failed" };
    render(capturedProps.actions({ dataRow }));

    const button = screen.getByRole("button", {
      name: "TR:core.glPostingStatus.retry",
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("klik tombol retry memanggil router.post ke route gl-posting-statuses.retry dgn id dataRow", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = { id: 42, status: "failed" };
    render(capturedProps.actions({ dataRow }));

    const button = screen.getByRole("button", {
      name: "TR:core.glPostingStatus.retry",
    });
    await user.click(button);

    expect(routerPost).toHaveBeenCalledTimes(1);
    expect(routerPost).toHaveBeenCalledWith("gl-posting-statuses.retry/42");
  });
});
