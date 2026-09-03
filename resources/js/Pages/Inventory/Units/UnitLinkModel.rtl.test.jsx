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

import UnitLinkModel from "./UnitLinkModel";
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

describe("UnitLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name (:code)",
            name: "Kilogram",
            code: "KG",
            // FQCN Laravel asli App\Models\Inventory\Unit
            // (app/Models/Inventory/Unit.php).
            thisModel: "App\\Models\\Inventory\\Unit",
          },
          {
            id: 2,
            templateLink: ":name (:code)",
            name: "Pieces",
            code: "PCS",
            thisModel: "App\\Models\\Inventory\\Unit",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<UnitLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name (:code))", async () => {
    await render(
      <UnitLinkModel
        value={{ templateLink: ":name (:code)", name: "Meter", code: "M" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Meter (M)");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<UnitLinkModel placeholder="Pilih satuan..." />);
    expect(screen.getByPlaceholderText("Pilih satuan...")).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<UnitLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<UnitLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Unit, keywords, dan fields tambahan (group)", async () => {
    // UnitLinkModel.jsx mengunci prop keywords=["group","name","code"] dan
    // fields=["group"] -- keduanya diteruskan apa adanya ke payload axios
    // LinkModel (lihat Components/LinkModel.jsx getModels()).
    const user = userEvent.setup({ delay: null });
    await render(<UnitLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kilo");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            model: "App\\Models\\Inventory\\Unit",
            search: "Kilo",
            keywords: ["group", "name", "code"],
            fields: ["group"],
          }),
        );
      });
    });
  });

  it("membuka dropdown menampilkan titleDialog (t('inventory.unit.new')) sbg label tombol tambah", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<UnitLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(
      await screen.findByText("TR:inventory.unit.new"),
    ).toBeInTheDocument();
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<UnitLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Kilo");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Kilo" }),
        );
      });
    });

    const option = await screen.findByRole("option", { name: "Kilogram (KG)" });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "KG" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Unit) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name (:code)",
            name: "Salah Model",
            code: "SM",
            thisModel: "App\\Models\\Inventory\\Category",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<UnitLinkModel onValueChange={onValueChange} />);

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
      name: "Salah Model (SM)",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Unit", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<UnitLinkModel model="AppModelsOverride" />);

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
