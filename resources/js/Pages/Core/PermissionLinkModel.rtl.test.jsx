import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

// LinkModel.jsx (dipakai PermissionLinkModel di bawah tangan) meng-import
// FormPageDialog dari FormPage.jsx, yang menarik banyak dependency lain
// (Table2, editor, dst) tidak relevan untuk test wiring PermissionLinkModel --
// mock jadi stub kosong sama seperti NumberCardLinkModel.rtl.test.jsx &
// AssetLocationLinkModel.rtl.test.jsx. PermissionLinkModel.jsx sendiri TIDAK
// meng-import Form apapun (tidak ada prop `form`/`titleDialog` yang dikirim),
// jadi tidak perlu mock "./Form" tambahan seperti referensi lain.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageDialog: () => null,
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import PermissionLinkModel from "./PermissionLinkModel";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Sama seperti NumberCardLinkModel.rtl.test.jsx & AssetLocationLinkModel.rtl.test.jsx:
// LinkModel membungkus dirinya dengan <Tooltip> internal tanpa menyediakan
// <TooltipProvider> sendiri, dan menembak axios.post di useEffect saat mount
// tanpa di-await -- bungkus render() ITU SENDIRI dalam `await act(async () =>
// {})` supaya microtask stabil dulu. delayDuration=0 supaya Radix
// TooltipProvider tidak memakai setTimeout asli (700ms) yang tidak
// terkontrol test.
const render = async (ui) => {
  let result;
  await act(async () => {
    result = rtlRender(
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>,
    );
  });
  return result;
};

describe("PermissionLinkModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 1,
            templateLink: ":name",
            name: "user.create",
            // FQCN Laravel asli App\Models\User\Permission
            // (app/Models/User/Permission.php) -- literal string JS di sini
            // WAJIB double-backslash supaya menghasilkan satu backslash
            // sungguhan per separator, dibanding literal atribut JSX di
            // PermissionLinkModel.jsx sendiri (baris 13) yang cukup satu
            // backslash karena string literal JSX TIDAK memproses escape
            // sequence ala JS biasa (beda dari file .js biasa) -- keduanya
            // berakhir sbg string runtime yang sama.
            thisModel: "App\\Models\\User\\Permission",
          },
          {
            id: 2,
            templateLink: ":name",
            name: "user.update",
            thisModel: "App\\Models\\User\\Permission",
          },
        ],
        total: 2,
      },
    });
  });

  it("render input kosong tanpa value", async () => {
    await render(<PermissionLinkModel />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("render label value terpilih via convertTemplateLink (:name)", async () => {
    await render(
      <PermissionLinkModel
        value={{ templateLink: ":name", name: "user.delete" }}
      />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("user.delete");
  });

  it("placeholder diteruskan ke input", async () => {
    await render(<PermissionLinkModel placeholder="Pilih permission..." />);
    expect(
      screen.getByPlaceholderText("Pilih permission..."),
    ).toBeInTheDocument();
  });

  it("ref diteruskan ke handle imperatif Input (bukan node DOM mentah)", async () => {
    // ui/input.jsx (dipakai LinkModel di bawah tangan) sengaja memakai
    // useImperativeHandle yang HANYA mengekspos `{ focus }`, bukan node
    // <input> mentah -- jadi ref.current bukan instance HTMLInputElement.
    // Ini konvensi shared Input yang berlaku di semua pemakai (bukan
    // spesifik PermissionLinkModel), tapi tetap perlu dikunci di sini supaya
    // wiring `ref` dari PermissionLinkModel -> LinkModel -> Input tidak
    // diam-diam berubah.
    const ref = { current: null };
    await render(<PermissionLinkModel ref={ref} />);
    expect(typeof ref.current?.focus).toBe("function");
    expect(() => ref.current.focus()).not.toThrow();
  });

  it("disabled mencegah input diedit", async () => {
    await render(<PermissionLinkModel disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("mengetik memicu request axios dengan model Permission & fields default", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<PermissionLinkModel />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "user");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            // Literal atribut JSX di PermissionLinkModel.jsx baris 13
            // (model="App\Models\User\Permission") memakai satu backslash --
            // berbeda dari string literal JS biasa, JSX TIDAK memproses
            // escape sequence pada literal atribut string, jadi backslash-nya
            // tetap utuh saat runtime dan cocok dgn FQCN Laravel asli
            // app/Models/User/Permission.php.
            model: "App\\Models\\User\\Permission",
            search: "user",
            fields: [
              "model",
              "permissions",
              "is_submitable",
              "allow_only_creator",
            ],
          }),
        );
      });
    });
  });

  it("prop `fields` tambahan digabung SETELAH fields default (bukan menimpa)", async () => {
    // PermissionLinkModel.jsx baris 16-22 -- beda dari NumberCardLinkModel &
    // AssetLocationLinkModel (fields tetap, tidak menerima prop `fields`
    // caller) -- PermissionLinkModel secara eksplisit men-destructure `fields`
    // dari props lalu men-spread-nya SETELAH 4 fields default via
    // `...(fields ?? [])`, bukan menimpa semuanya lewat spread {...props}
    // biasa. Perlu dikunci terpisah dari test "prop tambahan via spread"
    // di bawah supaya perilaku append (bukan override) tidak diam-diam
    // berubah saat refactor.
    const user = userEvent.setup({ delay: null });
    await render(<PermissionLinkModel fields={["module"]} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "x");
    });

    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({
            fields: [
              "model",
              "permissions",
              "is_submitable",
              "allow_only_creator",
              "module",
            ],
          }),
        );
      });
    });
  });

  it("membuka dropdown TIDAK menampilkan tombol tambah (disabledAddButton=true, tanpa form)", async () => {
    // PermissionLinkModel.jsx mengunci disabledAddButton={true} secara tetap
    // (tidak ada prop `form`/`titleDialog` yang dikirim ke LinkModel sama
    // sekali) -- beda dari NumberCardLinkModel & AssetLocationLinkModel yang
    // menyediakan `form` + `titleDialog` sehingga tombol tambah muncul.
    // disabledAdd di LinkModel.jsx (`if (disabledAddButton) return true`)
    // membuat CommandItem "+ tambah" tidak pernah dirender di sini --
    // dikunci lewat jumlah option persis = jumlah data mock (tanpa baris
    // tambahan).
    const user = userEvent.setup({ delay: null });
    await render(<PermissionLinkModel />);

    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });

    await act(async () => {
      await vi.waitFor(() => expect(axiosPost).toHaveBeenCalled());
    });

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("memilih opsi dari daftar hasil memanggil onValueChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PermissionLinkModel onValueChange={onValueChange} />);

    await act(async () => {
      await user.type(screen.getByRole("textbox"), "user");
    });

    // Tunggu request pencarian benar-benar selesai sebelum klik -- render
    // opsi bisa berganti saat data axios datang, elemen yang diklik lebih
    // dulu bisa jadi stale.
    await act(async () => {
      await vi.waitFor(() => {
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "user" }),
        );
      });
    });

    const option = await screen.findByRole("option", {
      name: "user.create",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "user.create" }),
    );
  });

  it("opsi dengan thisModel model lain (bukan Permission) ditolak validate() -- onValueChange TIDAK terpanggil", async () => {
    // validate() di linkModelUtils.js membandingkan value.thisModel === model
    // secara ketat. PermissionLinkModel mengunci model ke Permission, jadi
    // opsi yang (secara data cacat/salah) membawa thisModel model lain harus
    // ditolak secara silent (tanpa error) -- bukan celah keamanan karena
    // payload pencarian sendiri sudah scoped ke model Permission, tapi
    // defense-in-depth ini tetap perlu dikunci lewat test.
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            id: 9,
            templateLink: ":name",
            name: "Salah Model",
            thisModel: "App\\Models\\User\\Role",
          },
        ],
        total: 1,
      },
    });

    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(<PermissionLinkModel onValueChange={onValueChange} />);

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
      name: "Salah Model",
    });
    await act(async () => {
      await user.click(option);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("prop tambahan (mis. model) via spread menimpa konfigurasi default Permission", async () => {
    // PermissionLinkModel men-spread {...props} SETELAH prop tetap (model,
    // disabledAddButton, disabledNavigation, fields) -- di JSX, atribut yang
    // ditulis belakangan menang. Jadi caller BISA menimpa `model` bawaan
    // Permission lewat prop tambahan. Bukan bug: konsekuensi urutan spread
    // yang perlu didokumentasikan lewat test supaya perilakunya tidak
    // berubah diam-diam saat file di-refactor.
    const user = userEvent.setup({ delay: null });
    await render(<PermissionLinkModel model="AppModelsOverride" />);

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
