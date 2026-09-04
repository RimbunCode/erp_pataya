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

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import AssignableLinkModel from "./AssignableLinkModel";
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

// app/Models/User/Assignable.php templateLink() =
// '<title>:name (:type)</title><b>:name</b><br/><span>:type</span>' -- template
// HTML dgn tag <title> (BUKAN html <title> asli, cuma delimiter konvensi
// linkModelUtils.js). convertTemplateLink() berperilaku beda tergantung
// argumen `search`:
// - dipanggil TANPA search (search==null, jalur nilai textbox via
//   setSearch(convertTemplateLink(option))) -> ekstrak isi <title>...</title>
//   apa adanya (mis. "Budi Santoso (Staff)"), tag lain dibuang.
// - dipanggil DENGAN search (jalur render opsi dropdown, convertTemplateLink(opt,
//   search ?? "")) -> tag <title> dibuang, sisa HTML (<b>/<br/>/<span>) tetap
//   dirender via dangerouslySetInnerHTML -- textContent gabungan JADI
//   "Budi Santoso" + "Staff" TANPA pemisah spasi (tag <br/> tak menyumbang
//   whitespace ke accessible name). Test opsi di bawah pakai pencarian
//   textContent (bukan getByRole name persis) supaya tidak rapuh terhadap
//   detail concatenation ini.
describe("AssignableLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink:
              "<title>:name (:type)</title><b>:name</b><br/><span>:type</span>",
            name: "Budi Santoso",
            type: "Staff",
            thisModel: "App\\Models\\User\\Assignable",
          },
          {
            id: 2,
            templateLink:
              "<title>:name (:type)</title><b>:name</b><br/><span>:type</span>",
            name: "Tim Gudang",
            type: "Team",
            thisModel: "App\\Models\\User\\Assignable",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<AssignableLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it('render label value terpilih via convertTemplateLink -- isi <title> saja ("Nama (Tipe)")', async () => {
    await render(
      <AssignableLinkModel
        value={{
          templateLink:
            "<title>:name (:type)</title><b>:name</b><br/><span>:type</span>",
          name: "Ani Wijaya",
          type: "Staff",
        }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("Ani Wijaya (Staff)");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<AssignableLinkModel placeholder="Pilih assignee..." />);
    expect(
      screen.getByPlaceholderText("Pilih assignee..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    const ref = { current: null };
    await render(<AssignableLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<AssignableLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Assignable", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssignableLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Budi");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            model: "App\\Models\\User\\Assignable",
            search: "Budi",
          }),
        );
      });
    });
  });

  it("disabledAddButton -- tidak ada CommandItem tambah selain opsi hasil pencarian", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssignableLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssignableLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "Budi");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "Budi" }),
        );
      });
    });

    const options = await screen.findAllByRole("option");
    const target = options.find((el) => el.textContent.includes("Budi"));
    expect(target).toBeTruthy();
    await act(async () => {
      await user.click(target);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Budi Santoso" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Assignable) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink:
              "<title>:name (:type)</title><b>:name</b><br/><span>:type</span>",
            name: "Salah Model",
            type: "Staff",
            thisModel: "App\\Models\\User\\User",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<AssignableLinkModel onValueChange={onValueChange} />);

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

    const options = await screen.findAllByRole("option");
    const target = options.find((el) => el.textContent.includes("Salah"));
    expect(target).toBeTruthy();
    await act(async () => {
      await user.click(target);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Assignable", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<AssignableLinkModel model="AppModelsOverride" />);

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
