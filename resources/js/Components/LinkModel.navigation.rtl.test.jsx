/**
 * Regresi navigasi LinkModel mode TUNGGAL (tombol panah) -- dikunci sebelum
 * logikanya diekstrak ke `resolveNavigation` (spec finance-multi-tax-per-item,
 * Task 1.2): perilaku mode tunggal tidak boleh berubah.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const canGlobal = vi.fn();
const can = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can, canGlobal }),
}));
vi.mock("@/Pages/Core/FormPage", () => ({ FormPageDialog: () => null }));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args) => axiosPost(...args),
    get: () => Promise.resolve({ data: { data: [] } }),
  },
}));

window.route = (name, id) => (id === undefined ? name : `${name}:${id}`);

import LinkModel from "./LinkModel";
import { TooltipProvider } from "./ui/tooltip";

const MODEL = "App\\Models\\Inventory\\Item";
const OTHER = "App\\Models\\Other";

const render = async (ui) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let result;
  await act(async () => {
    result = rtlRender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
      </QueryClientProvider>,
    );
  });
  return result;
};

const navButton = (container) =>
  container.querySelector("button svg.lucide-arrow-right")?.closest("button");

const value = (extra = {}) => ({
  id: 7,
  name: "Widget",
  templateLink: ":name",
  thisModel: MODEL,
  created_by_id: 3,
  ...extra,
});

let openSpy;
beforeEach(() => {
  axiosPost.mockReset().mockResolvedValue({
    data: { data: [], total: 0, current_page: 1, last_page: 1 },
  });
  can.mockReset().mockReturnValue(true);
  canGlobal.mockReset().mockReturnValue(true);
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("LinkModel mode tunggal -- navigasi", () => {
  it("klik panah membuka `<plural>.show` dgn id di tab baru", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = await render(
      <LinkModel model={MODEL} value={value()} />,
    );
    await act(async () => {
      await user.click(navButton(container));
    });
    expect(openSpy).toHaveBeenCalledWith("items.show:7", "_blank");
  });

  it("`as` mengganti nama resource & key route", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = await render(
      <LinkModel
        model={MODEL}
        as="product:code"
        value={value({ code: "P-1" })}
      />,
    );
    await act(async () => {
      await user.click(navButton(container));
    });
    expect(openSpy).toHaveBeenCalledWith("products.show:P-1", "_blank");
  });

  it("customNavigation dipanggil dgn value, lalu window.open tetap jalan", async () => {
    const user = userEvent.setup({ delay: null });
    const customNavigation = vi.fn();
    const v = value();
    const { container } = await render(
      <LinkModel model={MODEL} value={v} customNavigation={customNavigation} />,
    );
    await act(async () => {
      await user.click(navButton(container));
    });
    expect(customNavigation).toHaveBeenCalledWith(v);
    expect(openSpy).toHaveBeenCalledWith("items.show:7", "_blank");
  });

  it("disabledNavigation menyembunyikan tombol", async () => {
    const { container } = await render(
      <LinkModel model={MODEL} value={value()} disabledNavigation />,
    );
    expect(navButton(container)).toBeFalsy();
  });

  it("tanpa izin read -> tombol tersembunyi; izin dicek dgn created_by_id", async () => {
    can.mockReturnValue(false);
    const { container } = await render(
      <LinkModel model={MODEL} value={value()} />,
    );
    expect(can).toHaveBeenCalledWith("read", { user_id: 3 });
    expect(navButton(container)).toBeFalsy();
  });

  it("canNavigation memakai canGlobal(model target, read); keyRoute bertitik memakai scope induknya", async () => {
    const { container } = await render(
      <LinkModel
        model={MODEL}
        as="item:item.id"
        canNavigation={OTHER}
        value={value({ item: { id: 9, created_by_id: 11 } })}
      />,
    );
    expect(canGlobal).toHaveBeenCalledWith(OTHER, "read", {
      user_id: 11,
    });
    expect(navButton(container)).toBeTruthy();

    canGlobal.mockReturnValue(false);
    const denied = await render(
      <LinkModel model={MODEL} canNavigation={OTHER} value={value()} />,
    );
    expect(navButton(denied.container)).toBeFalsy();
  });
});
