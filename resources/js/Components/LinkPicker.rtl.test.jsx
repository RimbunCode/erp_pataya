import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// Select distub sebagai <select> asli supaya interaksi onValueChange bisa
// dipicu lewat userEvent.selectOptions tanpa merender internal Popover/Command
// Select (sudah punya test sendiri di Select.rtl.test.jsx). Pola sama dengan
// Pages/Inventory/Units/Form.rtl.test.jsx.
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options, disabled, placeholder }) => (
    <select
      data-testid="select"
      aria-label={placeholder}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

import LinkPicker from "./LinkPicker";

const noop = () => {};

// Harness terkontrol -- menyimpan value di state lokal supaya interaksi
// (ketik di Input, pilih di Select, klik tab) bisa diverifikasi hasil akhir
// yang benar-benar dikembalikan ke parent (pola sama dgn Controlled di
// ui/input.rtl.test.jsx).
function Harness({ initialValue, disabled, onChangeSpy }) {
  const [value, setValue] = useState(initialValue);
  return (
    <LinkPicker
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        onChangeSpy?.(v);
        setValue(v);
      }}
    />
  );
}

beforeEach(() => {
  usePageMock.mockReset();
  usePageMock.mockReturnValue({ props: { allMenuItems: [] } });
});

describe("LinkPicker — render dasar & default value", () => {
  it("render tanpa crash dgn value undefined -> tab Menu aktif & Select (bukan Input) ditampilkan", () => {
    render(<LinkPicker value={undefined} onValueChange={noop} />);

    const menuTab = screen.getByRole("button", { name: "Menu" });
    const urlTab = screen.getByRole("button", { name: "URL" });
    expect(menuTab.className).toContain("border-primary");
    expect(menuTab.className).toContain("bg-primary/10");
    expect(urlTab.className).toContain("text-muted-foreground");
    expect(urlTab.className).not.toContain("border-primary");

    expect(screen.getByTestId("select")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("https://... atau /path"),
    ).not.toBeInTheDocument();
  });

  it("Select ditampilkan dgn placeholder 'Pilih menu...' & value kosong saat link_to tidak diset", () => {
    render(<LinkPicker value={undefined} onValueChange={noop} />);

    const select = screen.getByRole("combobox", { name: "Pilih menu..." });
    expect(select).toHaveValue("");
  });

  it("value.link_type = 'url' -> tab URL aktif, Input ditampilkan (bukan Select), berisi link_to", () => {
    render(
      <LinkPicker
        value={{ link_type: "url", link_to: "https://contoh.test" }}
        onValueChange={noop}
      />,
    );

    const menuTab = screen.getByRole("button", { name: "Menu" });
    const urlTab = screen.getByRole("button", { name: "URL" });
    expect(urlTab.className).toContain("border-primary");
    expect(menuTab.className).toContain("text-muted-foreground");

    expect(screen.queryByTestId("select")).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText("https://... atau /path");
    expect(input).toHaveValue("https://contoh.test");
  });

  it("Input url memiliki atribut pattern sesuai URL_PATTERN (validasi bantuan UX)", () => {
    render(
      <LinkPicker
        value={{ link_type: "url", link_to: "" }}
        onValueChange={noop}
      />,
    );

    const input = screen.getByPlaceholderText("https://... atau /path");
    expect(input).toHaveAttribute("pattern", "^(https?://|/).*");
  });

  it("tombol URL merender ExternalLinkIcon", () => {
    render(<LinkPicker value={undefined} onValueChange={noop} />);

    const urlTab = screen.getByRole("button", { name: "URL" });
    expect(urlTab.querySelector("svg")).toBeInTheDocument();
  });
});

describe("LinkPicker — pindah tab Menu/URL", () => {
  it("klik tab URL saat linkType menu_item -> onValueChange({ link_type: 'url', link_to: '' })", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<LinkPicker value={undefined} onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "URL" }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith({
      link_type: "url",
      link_to: "",
    });
  });

  it("klik tab Menu saat linkType url dgn link_to terisi -> onValueChange me-reset link_to jadi ''", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LinkPicker
        value={{ link_type: "url", link_to: "/halaman-lama" }}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(onValueChange).toHaveBeenCalledWith({
      link_type: "menu_item",
      link_to: "",
    });
  });

  it("berpindah tab benar-benar menukar Select <-> Input saat value dikontrol penuh (Harness)", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue={undefined} />);

    expect(screen.getByTestId("select")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "URL" }));
    expect(screen.queryByTestId("select")).not.toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("https://... atau /path"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByTestId("select")).toBeInTheDocument();
  });
});

describe("LinkPicker — pilih menu (Select)", () => {
  it("menerjemahkan allMenuItems (props Inertia) jadi opsi Select {value: id, label}", () => {
    usePageMock.mockReturnValue({
      props: {
        allMenuItems: [
          { id: 1, label: "Dashboard" },
          { id: 2, label: "Laporan" },
        ],
      },
    });
    render(<LinkPicker value={undefined} onValueChange={noop} />);

    expect(
      screen.getByRole("option", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Laporan" })).toBeInTheDocument();
  });

  it("allMenuItems kosong (default props) -> Select tidak punya opsi selain placeholder kosong", () => {
    render(<LinkPicker value={undefined} onValueChange={noop} />);

    const select = screen.getByTestId("select");
    expect(select.querySelectorAll("option")).toHaveLength(1);
  });

  it("memilih opsi di Select memicu onValueChange({ link_type: 'menu_item', link_to: <id opsi> })", async () => {
    const user = userEvent.setup();
    usePageMock.mockReturnValue({
      props: { allMenuItems: [{ id: 7, label: "Pengaturan" }] },
    });
    const onValueChange = vi.fn();
    render(<LinkPicker value={undefined} onValueChange={onValueChange} />);

    await user.selectOptions(screen.getByTestId("select"), "7");

    expect(onValueChange).toHaveBeenCalledWith({
      link_type: "menu_item",
      link_to: "7",
    });
  });
});

describe("LinkPicker — isi URL manual (Input)", () => {
  it("mengetik di Input url memanggil onValueChange per karakter dgn shape { link_type: 'url', link_to }", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LinkPicker
        value={{ link_type: "url", link_to: "" }}
        onValueChange={onValueChange}
      />,
    );

    await user.type(
      screen.getByPlaceholderText("https://... atau /path"),
      "/x",
    );

    expect(onValueChange).toHaveBeenNthCalledWith(1, {
      link_type: "url",
      link_to: "/",
    });
    expect(onValueChange).toHaveBeenNthCalledWith(2, {
      link_type: "url",
      link_to: "x",
    });
  });

  it("mengetik URL lengkap pada Harness terkontrol -> value akhir tersimpan penuh", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue={{ link_type: "url", link_to: "" }} />);

    const input = screen.getByPlaceholderText("https://... atau /path");
    await user.type(input, "https://a.test");

    expect(input).toHaveValue("https://a.test");
  });
});

describe("LinkPicker — prop disabled", () => {
  it("disabled=true menonaktifkan kedua tombol tab", () => {
    render(
      <LinkPicker value={undefined} onValueChange={noop} disabled={true} />,
    );

    expect(screen.getByRole("button", { name: "Menu" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "URL" })).toBeDisabled();
  });

  it("disabled=true meneruskan disabled ke Select saat linkType menu_item", () => {
    render(
      <LinkPicker value={undefined} onValueChange={noop} disabled={true} />,
    );

    expect(screen.getByTestId("select")).toBeDisabled();
  });

  it("disabled=true meneruskan disabled ke Input saat linkType url", () => {
    render(
      <LinkPicker
        value={{ link_type: "url", link_to: "" }}
        onValueChange={noop}
        disabled={true}
      />,
    );

    expect(
      screen.getByPlaceholderText("https://... atau /path"),
    ).toBeDisabled();
  });

  it("tombol tab disabled tidak memicu onValueChange saat diklik", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LinkPicker
        value={undefined}
        onValueChange={onValueChange}
        disabled={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: "URL" }));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("tanpa prop disabled (default undefined), semua kontrol tetap aktif", () => {
    render(<LinkPicker value={undefined} onValueChange={noop} />);

    expect(screen.getByRole("button", { name: "Menu" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "URL" })).not.toBeDisabled();
    expect(screen.getByTestId("select")).not.toBeDisabled();
  });
});
