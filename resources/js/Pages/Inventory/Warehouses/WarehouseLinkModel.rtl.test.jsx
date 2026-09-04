import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

vi.mock("./Form", () => ({
  default: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import WarehouseLinkModel from "./WarehouseLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

// app/Models/Inventory/Warehouse.php templateLink() = ':code{:title} - :name'.
// Sintaks `:code{:title}` di convertTemplateLink (lib/linkModelUtils.js)
// BUKAN berarti "pakai field code" -- regex `(.*?){:(.*?)}` mengubah seluruh
// placeholder itu jadi `:title` sebelum lookup, jadi field yang benar2
// dipakai adalah `title` (accessor computed di Warehouse.php, $appends =
// ['title']), bukan `code`. Bagian "code"/"name" sebelum kurung kurawal cuma
// dekoratif di string PHP, tidak pernah dibaca runtime FE. Dikonfirmasi lewat
// baca langsung app/Models/Inventory/Warehouse.php (title(): Attribute) --
// BUKAN bug, desain accessor computed yang disengaja.
describe("WarehouseLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":code{:title} - :name",
            // `title` di sini adalah SATU-SATUNYA field yang benar-benar
            // dibaca (lihat komentar di atas describe) -- jangan sertakan
            // ":name" lagi di dalamnya, template sudah menambah " - :name"
            // sendiri setelahnya.
            title: "WH-001",
            name: "Gudang Pusat",
            thisModel: "App\\Models\\Inventory\\Warehouse",
          },
          {
            id: 2,
            templateLink: ":code{:title} - :name",
            title: "WH-002",
            name: "Gudang Cabang",
            thisModel: "App\\Models\\Inventory\\Warehouse",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<WarehouseLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (pakai field `title`, BUKAN `code`/`name` mentah)", async () => {
    await render(
      <WarehouseLinkModel
        value={{
          templateLink: ":code{:title} - :name",
          title: "WH-009",
          name: "Gudang B",
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("WH-009 - Gudang B");
    // (title="WH-009" + " - " + name="Gudang B" -- lihat komentar mock data)
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<WarehouseLinkModel placeholder="Pilih gudang..." />);
    expect(screen.getByPlaceholderText("Pilih gudang...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<WarehouseLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<WarehouseLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Warehouse", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<WarehouseLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Pusat");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            model: "App\\Models\\Inventory\\Warehouse",
            search: "Pusat",
          }),
        );
      });
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('inventory.warehouse.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<WarehouseLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:inventory.warehouse.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<WarehouseLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Pusat");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Pusat" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "WH-001 - Gudang Pusat",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Gudang Pusat" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Warehouse) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":code{:title} - :name",
            title: "SM-001",
            name: "Salah Model",
            thisModel: "App\\Models\\Inventory\\Category",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<WarehouseLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Salah");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Salah" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "SM-001 - Salah Model",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Warehouse", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<WarehouseLinkModel model="AppModelsOverride" />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "x");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ model: "AppModelsOverride" }),
        );
      });
    });
  });
});
