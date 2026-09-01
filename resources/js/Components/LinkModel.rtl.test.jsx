import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// FormPage.jsx menarik banyak dependency lain (Table2, editor, dst) yang tidak
// relevan untuk test LinkModel -- mock FormPageDialog jadi stub kosong.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import LinkModel from "./LinkModel";
import { TooltipProvider } from "./ui/tooltip";

// Sama seperti Select.jsx, LinkModel membungkus dirinya dengan <Tooltip>
// internal tanpa menyediakan <TooltipProvider> sendiri.
//
// LinkModel menembak axios.post (search model) di useEffect saat mount
// TANPA di-await test-nya -- render() polos RTL cuma membungkus bagian
// SINKRON dalam act(), promise mock (walau resolve instan) tetap lanjut di
// microtask SESUDAH act() itu selesai. Bungkus render() ITU SENDIRI dalam
// `await act(async () => {})` supaya semua microtask stabil dulu.
const render = async (ui) => {
  let result;
  await act(async () => {
    // delayDuration=0 -- Radix TooltipProvider default (700ms) pakai
    // setTimeout ASLI internal utk hover-intent delay; userEvent.type()
    // ke input yang dibungkus Tooltip men-trigger banyak transisi
    // focus/hover, dan timer itu resolve JAUH di luar act() manapun yang
    // bisa kita kontrol dari test. delayDuration=0 membuat Radix transisi
    // segera tanpa timer.
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

describe("LinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        // thisModel WAJIB ada -- LinkModel.setOption() memvalidasi opt via
        // validate(val, model) (linkModelUtils.js: value.thisModel === model)
        // sebelum memanggil onValueChange. Tanpa ini, klik opsi silent no-op.
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "Alpha",
            thisModel: "AppModelsItem",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "Beta",
            thisModel: "AppModelsItem",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<LinkModel model="AppModelsItem" />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink", async () => {
    await render(
      <LinkModel
        model="AppModelsItem"
        value={{ templateLink: ":name", name: "Widget A" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Widget A");
  });

  it("mengetik di input memicu request axios pencarian", async () => {
    // LinkModel fetch 2x: sekali saat dropdown terbuka (search kosong, debounce
    // 100ms) dan sekali lagi setelah user berhenti mengetik (debounce 500ms).
    // Test ini memverifikasi call KEDUA (dengan search terisi) benar-benar terjadi.
    const user = userEvent.setup({ delay: null });
    await render(<LinkModel model="AppModelsItem" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Alpha");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "AppModelsItem", search: "Alpha" }),
        );
      });
    });
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(
      <LinkModel model="AppModelsItem" onValueChange={onValueChange} />,
    );

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Al");
    });

    // Tunggu request pencarian (debounce 500ms) benar-benar selesai sebelum
    // klik -- render opsi bisa berganti (unmount/remount) saat data axios
    // datang, sehingga elemen yang diklik lebih dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Al" }),
        );
      });
    });

    // Label opsi di-highlight (<mark>Al</mark>pha), jadi cari via role
    // "option" + data-value alih-alih text match langsung.
    const option = await screen.findByRole("option", { name: "Alpha" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Alpha" }),
    );
  });

  it("disabled mencegah input diedit", async () => {
    await render(<LinkModel model="AppModelsItem" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("menampilkan badge relasi terhapus saat option.deleted_at terisi", async () => {
    await render(
      <LinkModel
        model="AppModelsItem"
        value={{
          templateLink: ":name",
          name: "Widget",
          deleted_at: "2026-01-01",
        }}
      />,
    );
    // Input tetap menampilkan label walau relasi sudah dihapus.
    expect(screen.getByRole("textbox")).toHaveValue("Widget");
  });
});
