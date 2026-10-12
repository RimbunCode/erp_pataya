import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

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
    render(<Index />);
  });

  it("meneruskan rowActions ke DataTable2 dan tidak lagi memakai actions", () => {
    expect(Array.isArray(capturedProps.rowActions)).toBe(true);
    expect(capturedProps.rowActions).toHaveLength(1);
    expect(capturedProps.actions).toBeUndefined();
  });

  it("aksi retry memakai key 'retry' dan mensyaratkan kolom canRetry", () => {
    const [retry] = capturedProps.rowActions;

    expect(retry.key).toBe("retry");
    expect(retry.label).toBe("TR:core.glPostingStatus.retry");
    expect(retry.requires).toEqual(["canRetry"]);
  });

  it("enabled bernilai true hanya saat canRetry true dan can('write') true", () => {
    const [retry] = capturedProps.rowActions;

    expect(retry.enabled({ id: 1, canRetry: true })).toBe(true);
    expect(retry.enabled({ id: 2, canRetry: false })).toBe(false);
    expect(canMock).toHaveBeenCalledWith("core.gl_posting_status", "write");
  });

  it("enabled bernilai false saat can('write') false walau canRetry true", () => {
    canMock.mockReturnValue(false);
    const [retry] = capturedProps.rowActions;

    expect(retry.enabled({ id: 3, canRetry: true })).toBe(false);
  });

  it("onAction memanggil router.post ke route gl-posting-statuses.retry dengan id baris", () => {
    const [retry] = capturedProps.rowActions;

    retry.onAction([{ id: 5 }]);

    expect(routerPost).toHaveBeenCalledTimes(1);
    expect(routerPost).toHaveBeenCalledWith("gl-posting-statuses.retry/5");
  });
});
