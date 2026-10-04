import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { lang: "id", preferences: {} } }),
}));

const canGlobal = vi.fn();
const can = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can, canGlobal }),
}));

// FormPageDialog palsu: tampil saat open, tombol memicu onSuccess seperti
// halaman form sungguhan (flash.id = id baris yang baru dibuat).
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: ({ title, name, open, onSuccess, children }) =>
    open ? (
      <div data-testid={`dialog-${title}`} data-name={name}>
        {children}
        <button
          type="button"
          onClick={() => onSuccess({ props: { flash: { id: "new-id" } } })}
        >
          save-{title}
        </button>
      </div>
    ) : null,
}));

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

const MAIN = "App\\Models\\Main";
const SUB = "App\\Models\\Variant";
const row = (model, id, name, extra = {}) => ({
  id,
  name,
  templateLink: ":name",
  thisModel: model,
  ...extra,
});

let openSpy;
beforeEach(() => {
  axiosPost.mockReset();
  can.mockReset().mockReturnValue(true);
  canGlobal.mockReset().mockReturnValue(true);
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  axiosPost.mockImplementation((_url, payload) => {
    if (payload?.id) {
      return Promise.resolve({ data: row(payload.model, payload.id, "Baru") });
    }

    return Promise.resolve({
      data: { data: [], total: 0, current_page: 1, last_page: 1 },
    });
  });
});

// Tombol navigasi = tombol dengan ikon ArrowRight (tak punya nama aksesibel).
const navButton = (container) =>
  container.querySelector("button svg.lucide-arrow-right")?.closest("button");

describe("LinkModel multi-model -- navigate per sumber", () => {
  it("option main -> navigasi memakai `as` main; option sub -> `as` sub", async () => {
    const user = userEvent.setup({ delay: null });
    const subModels = [
      { model: SUB, label: "Varian", as: "variant:variant_id" },
    ];
    const { container, rerender } = await render(
      <LinkModel
        model={MAIN}
        as="main:main_id"
        subModels={subModels}
        value={row(MAIN, 1, "Alpha", { main_id: "m-1" })}
      />,
    );
    await act(async () => {
      await user.click(navButton(container));
    });
    expect(openSpy).toHaveBeenLastCalledWith("mains.show:m-1", "_blank");

    await act(async () => {
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider delayDuration={0}>
            <LinkModel
              model={MAIN}
              as="main:main_id"
              subModels={subModels}
              value={row(SUB, 2, "Varian X", { variant_id: "v-9" })}
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await user.click(navButton(container));
    });
    expect(openSpy).toHaveBeenLastCalledWith("variants.show:v-9", "_blank");
  });

  it("customNavigation & disabledNavigation sub hanya berlaku untuk option sub", async () => {
    const user = userEvent.setup({ delay: null });
    const customNavigation = vi.fn();
    const value = row(SUB, 2, "Varian X");
    const { container } = await render(
      <LinkModel
        model={MAIN}
        subModels={[{ model: SUB, label: "Varian", customNavigation }]}
        value={value}
      />,
    );
    await act(async () => {
      await user.click(navButton(container));
    });
    expect(customNavigation).toHaveBeenCalledWith(value);

    const disabled = await render(
      <LinkModel
        model={MAIN}
        subModels={[{ model: SUB, label: "Varian", disabledNavigation: true }]}
        value={value}
      />,
    );
    expect(navButton(disabled.container)).toBeFalsy();
  });

  it("canNavigation sub dipakai untuk izin baca; tanpa itu canGlobal(model sub)", async () => {
    const { container } = await render(
      <LinkModel
        model={MAIN}
        subModels={[
          {
            model: SUB,
            label: "Varian",
            canNavigation: "App\\Models\\Inventory\\Item",
          },
        ]}
        value={row(SUB, 2, "Varian X")}
      />,
    );
    expect(canGlobal).toHaveBeenCalledWith(
      "App\\Models\\Inventory\\Item",
      "read",
      expect.anything(),
    );
    expect(navButton(container)).toBeTruthy();

    canGlobal.mockImplementation((model) => model !== SUB);
    const denied = await render(
      <LinkModel
        model={MAIN}
        subModels={[{ model: SUB, label: "Varian" }]}
        value={row(SUB, 3, "Varian Y")}
      />,
    );
    expect(canGlobal).toHaveBeenCalledWith(SUB, "read", expect.anything());
    expect(navButton(denied.container)).toBeFalsy();
  });
});

describe("LinkModel multi-model -- Add per sumber", () => {
  const openDropdown = async (user) => {
    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });
  };

  it("baris Add muncul per sumber yang punya form & izin create", async () => {
    const user = userEvent.setup({ delay: null });
    await render(
      <LinkModel
        model={MAIN}
        form={<div>form-main</div>}
        titleDialog="Tambah Main"
        subModels={[
          {
            model: SUB,
            label: "Varian",
            form: <div>form-sub</div>,
            titleDialog: "Tambah Varian",
          },
        ]}
      />,
    );

    await openDropdown(user);

    expect(await screen.findByText("Tambah Main")).toBeInTheDocument();
    expect(screen.getByText("Tambah Varian")).toBeInTheDocument();
  });

  it("sub tanpa form / disabledAddButton / tanpa izin create -> tak ada baris Add", async () => {
    const user = userEvent.setup({ delay: null });
    canGlobal.mockImplementation((model, action) =>
      action === "create" ? model !== "App\\Models\\NoPerm" : true,
    );
    await render(
      <LinkModel
        model={MAIN}
        disabledAddButton
        subModels={[
          { model: SUB, label: "Tanpa Form", titleDialog: "Add Tanpa Form" },
          {
            model: "App\\Models\\Disabled",
            label: "Disabled",
            form: <div />,
            disabledAddButton: true,
            titleDialog: "Add Disabled",
          },
          {
            model: "App\\Models\\NoPerm",
            label: "NoPerm",
            form: <div />,
            titleDialog: "Add NoPerm",
          },
        ]}
      />,
    );

    await openDropdown(user);
    await screen.findAllByTestId("linkmodel-source-header");

    expect(screen.queryByText("Add Tanpa Form")).not.toBeInTheDocument();
    expect(screen.queryByText("Add Disabled")).not.toBeInTheDocument();
    expect(screen.queryByText("Add NoPerm")).not.toBeInTheDocument();
  });

  it("Add sub membuka dialog sub; sukses -> fetch baris baru dgn model & with sub lalu jadi option", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(
      <LinkModel
        model={MAIN}
        onValueChange={onValueChange}
        subModels={[
          {
            model: SUB,
            label: "Varian",
            form: <div>form-sub</div>,
            titleDialog: "Tambah Varian",
            with: ["unit"],
            as: "variant:id",
          },
        ]}
      />,
    );

    await openDropdown(user);
    await act(async () => {
      await user.click(await screen.findByText("Tambah Varian"));
    });

    const dialog = await screen.findByTestId("dialog-Tambah Varian");
    expect(dialog).toHaveAttribute("data-name", "variant");
    expect(screen.getByText("form-sub")).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByText("save-Tambah Varian"));
    });

    expect(axiosPost).toHaveBeenCalledWith("model", {
      model: SUB,
      with: ["unit"],
      id: "new-id",
    });
    await waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith(
        expect.objectContaining({ id: "new-id", thisModel: SUB }),
      ),
    );
  });
});
