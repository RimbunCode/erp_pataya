/**
 * LinkModel mode `multiple` (spec finance-multi-tax-per-item, Requirement 9):
 * value array objek, toggle, chip dgn navigasi per label, X terpisah, dst.
 * Regresi mode tunggal/multi-model ada di LinkModel*.rtl.test.jsx lain.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params?.name ? `TR:${key}:${params.name}` : `TR:${key}`,
  }),
}));

const can = vi.fn();
const canGlobal = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can, canGlobal }),
}));
vi.mock("@/Pages/Core/FormPage", () => ({ FormPageDialog: () => null }));

// Dialog Advance Search diganti stub: yang diuji di sini hanya kabel LinkModel
// (props multiple/selected, onSelectMany). Perilaku dialog: AdvanceSearchDialog.multiple.rtl.test.jsx.
vi.mock("./LinkModel/AdvanceSearchDialog", () => ({
  default: ({ open, multiple, selected, onSelectMany }) =>
    open ? (
      <div data-testid="advance-stub" data-multiple={String(multiple)}>
        <span data-testid="advance-selected">
          {(selected ?? []).map((row) => row.name).join("|")}
        </span>
        <button
          type="button"
          onClick={() =>
            onSelectMany([
              ...(selected ?? []),
              row(3, "Gamma", { name: "Gamma" }),
            ])
          }
        >
          pilih-stub
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

const MODEL = "App\\Models\\Finances\\Tax";
const TAX_GROUP = "App\\Models\\Finances\\TaxGroup";

function row(id, name, extra = {}) {
  return {
    id,
    name,
    templateLink: ":name",
    thisModel: MODEL,
    created_by_id: 1,
    ...extra,
  };
}

const ALPHA = row(1, "Alpha");
const BETA = row(2, "Beta");
const GAMMA = row(3, "Gamma");

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

// Pembungkus terkontrol: menyimpan array seperti form sungguhan.
function Controlled({ initial = [], onChange, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <LinkModel
      model={MODEL}
      multiple
      value={value}
      onValueChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
      {...props}
    />
  );
}

const chipLabels = () =>
  screen.queryAllByTestId("chip").map((chip) => chip.textContent);

const openDropdown = async (user) => {
  await act(async () => {
    await user.click(screen.getByRole("textbox"));
  });
};

let openSpy;
beforeEach(() => {
  axiosPost.mockReset().mockResolvedValue({
    data: { data: [ALPHA, BETA, GAMMA], total: 3 },
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

describe("LinkModel multiple -- memilih", () => {
  it("memilih opsi menambah chip, dropdown tetap terbuka, urutan pilihan terjaga", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    await render(<Controlled onChange={onChange} />);
    await openDropdown(user);

    await act(async () => {
      await user.click(await screen.findByRole("option", { name: "Beta" }));
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 2 }),
    ]);
    // dropdown masih terbuka: opsi lain tetap bisa diklik tanpa membuka ulang
    await act(async () => {
      await user.click(screen.getByRole("option", { name: /Alpha/ }));
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: 1 }),
    ]);
    expect(chipLabels()).toEqual(["Beta", "Alpha"]);
    expect(screen.getByRole("option", { name: /Gamma/ })).toBeInTheDocument();
  });

  it("opsi terpilih ditandai; memilih lagi mencabut chip (toggle)", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    await render(<Controlled initial={[ALPHA, BETA]} onChange={onChange} />);
    await openDropdown(user);

    const alpha = await screen.findByRole("option", { name: /Alpha/ });
    expect(alpha).toHaveAttribute("data-checked", "true");
    expect(screen.getByRole("option", { name: /Gamma/ })).toHaveAttribute(
      "data-checked",
      "false",
    );
    await act(async () => {
      await user.click(alpha);
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 2 }),
    ]);
    expect(chipLabels()).toEqual(["Beta"]);
  });

  it("opsi dari model lain (thisModel tak cocok) diabaikan", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    axiosPost.mockResolvedValue({
      data: { data: [{ ...ALPHA, thisModel: "App\\Models\\Lain" }], total: 1 },
    });
    await render(<Controlled onChange={onChange} />);
    await openDropdown(user);
    await act(async () => {
      await user.click(await screen.findByRole("option", { name: /Alpha/ }));
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("mode tak terkontrol (tanpa prop value) menyimpan array sendiri", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    await render(
      <LinkModel model={MODEL} multiple onValueChange={onValueChange} />,
    );
    await openDropdown(user);
    await act(async () => {
      await user.click(await screen.findByRole("option", { name: "Alpha" }));
    });
    expect(chipLabels()).toEqual(["Alpha"]);
    expect(onValueChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 1 }),
    ]);
  });

  it("mengetik memfilter lewat payload server (search) dan input dikosongkan saat dropdown tertutup", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<Controlled initial={[ALPHA]} />);
    await act(async () => {
      await user.type(screen.getByRole("textbox"), "gam");
    });
    await waitFor(
      () =>
        expect(axiosPost).toHaveBeenCalledWith(
          "model",
          expect.objectContaining({ search: "gam" }),
        ),
      { timeout: 3000 },
    );
    // klik di luar -> tutup, buffer pencarian dibersihkan, chip tetap
    await act(async () => {
      await user.click(document.body);
    });
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
    expect(chipLabels()).toEqual(["Alpha"]);
  });

  it("prop filters diteruskan ke permintaan opsi", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<Controlled filters={{ type: { eq: "ppn" } }} />);
    await openDropdown(user);
    await waitFor(() =>
      expect(axiosPost).toHaveBeenCalledWith(
        "model",
        expect.objectContaining({ filters: { type: { eq: "ppn" } } }),
      ),
    );
  });
});

describe("LinkModel multiple -- chip", () => {
  it("X mencabut chip tanpa membuka halaman; label terpisah dari X", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    await render(<Controlled initial={[ALPHA, BETA]} onChange={onChange} />);
    await act(async () => {
      await user.click(
        screen.getByRole("button", {
          name: "TR:core.form.linkmodel.remove:Alpha",
        }),
      );
    });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 2 })]);
    expect(openSpy).not.toHaveBeenCalled();
    expect(chipLabels()).toEqual(["Beta"]);
  });

  it("mencabut chip terakhir menghasilkan array kosong dan input kembali required", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    await render(<Controlled initial={[ALPHA]} required onChange={onChange} />);
    expect(screen.getByRole("textbox")).not.toBeRequired();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /remove:Alpha/ }));
    });
    expect(onChange).toHaveBeenCalledWith([]);
    expect(screen.getByRole("textbox")).toBeRequired();
  });

  it("klik label membuka halaman detail (<plural>.show) di tab baru", async () => {
    const user = userEvent.setup({ delay: null });
    await render(<Controlled initial={[ALPHA, BETA]} />);
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Beta" }));
    });
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("taxes.show:2", "_blank");
  });

  it("`as` (name:keyRoute) dipakai untuk rute label", async () => {
    const user = userEvent.setup({ delay: null });
    await render(
      <Controlled as="tax:code" initial={[row(1, "Alpha", { code: "PPN" })]} />,
    );
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Alpha" }));
    });
    expect(openSpy).toHaveBeenCalledWith("taxes.show:PPN", "_blank");
  });

  it("customNavigation dipanggil dgn data chip, lalu halaman tetap dibuka", async () => {
    const user = userEvent.setup({ delay: null });
    const customNavigation = vi.fn();
    await render(
      <Controlled
        initial={[ALPHA, BETA]}
        customNavigation={customNavigation}
      />,
    );
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Beta" }));
    });
    expect(customNavigation).toHaveBeenCalledWith(BETA);
    expect(openSpy).toHaveBeenCalledWith("taxes.show:2", "_blank");
  });

  it("disabledNavigation -> label teks biasa (tanpa tombol, tanpa window.open)", async () => {
    await render(<Controlled initial={[ALPHA]} disabledNavigation />);
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("izin read dicek PER DATA: chip tanpa izin teks biasa, chip lain tetap tautan", async () => {
    can.mockImplementation((_action, { user_id }) => user_id !== 99);
    await render(
      <Controlled initial={[ALPHA, row(2, "Beta", { created_by_id: 99 })]} />,
    );
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();
    expect(can).toHaveBeenCalledWith("read", { user_id: 99 });
  });

  it("canNavigation memakai canGlobal(model target, read)", async () => {
    canGlobal.mockReturnValue(false);
    await render(<Controlled initial={[ALPHA]} canNavigation={TAX_GROUP} />);
    expect(canGlobal).toHaveBeenCalledWith(
      "App\\Models\\Finances\\TaxGroup",
      "read",
      { user_id: 1 },
    );
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();
  });

  it.each([["disabled"], ["readOnly"]])(
    "%s: X disembunyikan tapi label tetap membuka detail",
    async (prop) => {
      const user = userEvent.setup({ delay: null });
      await render(<Controlled initial={[ALPHA]} {...{ [prop]: true }} />);
      expect(screen.queryByRole("button", { name: /remove/ })).toBeNull();
      await act(async () => {
        await user.click(screen.getByRole("button", { name: "Alpha" }));
      });
      expect(openSpy).toHaveBeenCalledWith("taxes.show:1", "_blank");
    },
  );

  it("disabled: tidak bisa menambah lewat dropdown", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    await render(<Controlled disabled onChange={onChange} />);
    await act(async () => {
      await user.click(screen.getByRole("textbox"));
    });
    expect(screen.queryByRole("option")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("label panjang: terpotong dengan tooltip title penuh", async () => {
    const long =
      "Pajak dengan nama yang sangat panjang sekali sampai terpotong";
    await render(<Controlled initial={[row(1, long)]} />);
    const label = screen.getByRole("button", { name: long });
    expect(label).toHaveAttribute("title", long);
    expect(label.className).toContain("truncate");
  });
});

describe("LinkModel multiple -- valueBefore & validasi", () => {
  it("valueBefore: chip baru ditandai added, chip yang dicabut tampil removed tanpa X", async () => {
    await render(
      <LinkModel
        model={MODEL}
        multiple
        value={[ALPHA, GAMMA]}
        valueBefore={[ALPHA, BETA]}
      />,
    );
    const chips = screen.getAllByTestId("chip");
    expect(chips.map((chip) => chip.getAttribute("data-status"))).toEqual([
      null,
      "added",
      "removed",
    ]);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Alpha",
      "Gamma",
      "Beta",
    ]);
    expect(within(chips[2]).queryByRole("button")).toBeNull();
  });

  it("valueBefore sama -> tanpa penanda diff", async () => {
    await render(
      <LinkModel
        model={MODEL}
        multiple
        value={[ALPHA]}
        valueBefore={[ALPHA]}
      />,
    );
    expect(screen.getByTestId("chip")).not.toHaveAttribute("data-status");
  });

  it("elemen value yang bukan model ini dibuang, sisanya tetap berurutan", async () => {
    const onValueChange = vi.fn();
    await render(
      <LinkModel
        model={MODEL}
        multiple
        value={[ALPHA, { ...BETA, thisModel: "App\\Models\\Lain" }, GAMMA]}
        onValueChange={onValueChange}
      />,
    );
    await waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ id: 3 }),
      ]),
    );
  });

  it("value null/kosong -> tanpa chip, placeholder tampil; ada chip -> placeholder hilang", async () => {
    const { rerender } = await render(
      <LinkModel
        model={MODEL}
        multiple
        value={null}
        placeholder="Pilih pajak"
      />,
    );
    expect(chipLabels()).toEqual([]);
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      "Pilih pajak",
    );
    await act(async () => {
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <TooltipProvider delayDuration={0}>
            <LinkModel
              model={MODEL}
              multiple
              value={[ALPHA]}
              placeholder="Pilih pajak"
            />
          </TooltipProvider>
        </QueryClientProvider>,
      );
    });
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "");
  });
});

describe("LinkModel multiple -- subModels & Advance Search", () => {
  it("multiple + subModels: subModels diabaikan dengan peringatan dev", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(
      <Controlled
        initial={[ALPHA]}
        subModels={[{ model: "App\\Models\\Lain", label: "Lain" }]}
      />,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("subModels"));
    // tanpa sumber sub: tak ada header sumber saat dropdown dibuka
    const user = userEvent.setup({ delay: null });
    await openDropdown(user);
    expect(screen.queryByTestId("linkmodel-source-header")).toBeNull();
    warn.mockRestore();
  });

  it("Advance Search menerima multiple + seleksi saat ini; hasilnya mengganti array", async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    await render(<Controlled initial={[ALPHA, BETA]} onChange={onChange} />);
    await openDropdown(user);
    await act(async () => {
      await user.click(
        await screen.findByText("TR:core.form.linkmodel.advance_search"),
      );
    });
    const stub = await screen.findByTestId("advance-stub");
    expect(stub).toHaveAttribute("data-multiple", "true");
    expect(screen.getByTestId("advance-selected")).toHaveTextContent(
      "Alpha|Beta",
    );
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "pilih-stub" }));
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: 3 }),
    ]);
    expect(chipLabels()).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(screen.queryByTestId("advance-stub")).toBeNull();
  });
});
