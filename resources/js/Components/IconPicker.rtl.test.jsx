import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import IconPicker from "./IconPicker";

// IconPicker merender ~1930 icon lucide-react via Popover + react-window
// Grid (virtualized). Ini dites via render sungguhan (bukan source-assertion)
// -- Grid react-window v2 terbukti jalan normal di jsdom (tak butuh mock
// ResizeObserver tambahan di luar polyfill test-setup.js), dan search term
// spesifik dipilih (mis. "rocket" -> cuma "RocketIcon") supaya assertion
// presisi tanpa bergantung pada urutan/posisi virtualisasi.
//
// Selector icon terpilih/placeholder pakai class svg asli lucide-react
// (mis. ".lucide-rocket", ".lucide-circle-question-mark" utk HelpCircle)
// krn icon svg tidak py teks/nama accessible sendiri.

describe("IconPicker — variant input (default)", () => {
  it("render tanpa crash, textbox kosong & icon placeholder (HelpCircle) saat value kosong", () => {
    const { container } = render(<IconPicker onValueChange={vi.fn()} />);

    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(
      container.querySelector(".lucide-circle-question-mark"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("value diberikan menampilkan icon sesuai value (bukan placeholder) & textbox terisi value", () => {
    const { container } = render(
      <IconPicker value="RocketIcon" onValueChange={vi.fn()} />,
    );

    expect(screen.getByRole("textbox")).toHaveValue("RocketIcon");
    expect(container.querySelector(".lucide-rocket")).toBeInTheDocument();
    expect(
      container.querySelector(".lucide-circle-question-mark"),
    ).not.toBeInTheDocument();
  });

  it("prop disabled diteruskan ke input, klik pada input disabled tidak membuka popover", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker onValueChange={vi.fn()} disabled />);

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();

    await user.click(input);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prop tambahan (mis. placeholder, name) diteruskan ke input via ...inputProps", () => {
    render(
      <IconPicker
        onValueChange={vi.fn()}
        placeholder="Cari icon"
        name="icon_field"
      />,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "Cari icon");
    expect(input).toHaveAttribute("name", "icon_field");
  });

  it("klik pada input (belum terbuka) membuka popover & menampilkan grid icon", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker value="" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("textbox"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mengetik di input memanggil onValueChange tiap keystroke & memfilter grid sesuai teks", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<IconPicker value="" onValueChange={onValueChange} />);

    await user.type(screen.getByRole("textbox"), "rocket");

    expect(onValueChange).toHaveBeenCalledTimes(6);
    expect(onValueChange).toHaveBeenLastCalledWith("rocket");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByTitle("RocketIcon")).toBeInTheDocument();
  });

  it("search tidak match icon apapun menampilkan pesan 'Icon tidak ditemukan.'", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker value="" onValueChange={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "zzzznotfound");

    expect(
      await screen.findByText("Icon tidak ditemukan."),
    ).toBeInTheDocument();
  });

  it("klik salah satu icon di grid memanggil onValueChange dgn nama icon & menutup popover", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<IconPicker value="" onValueChange={onValueChange} />);

    await user.type(screen.getByRole("textbox"), "rocket");
    await user.click(await screen.findByTitle("RocketIcon"));

    expect(onValueChange).toHaveBeenLastCalledWith("RocketIcon");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("icon yg sedang dipilih (value) ditandai border/bg primary di dalam grid", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker value="RocketIcon" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("textbox"));

    const selectedButton = await screen.findByTitle("RocketIcon");
    expect(selectedButton.className).toContain("border-primary");
    expect(selectedButton.className).toContain("text-primary");
  });

  it("Escape menutup popover", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker value="" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("textbox"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("IconPicker — variant button", () => {
  it("render tanpa crash, tombol icon dgn title 'Pilih icon' & placeholder HelpCircle saat value kosong", () => {
    const { container } = render(
      <IconPicker variant="button" onValueChange={vi.fn()} />,
    );

    const button = screen.getByRole("button", { name: "Pilih icon" });
    expect(button).toBeInTheDocument();
    expect(
      container.querySelector(".lucide-circle-question-mark"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("value diberikan menampilkan icon sesuai value & title tombol = value", () => {
    const { container } = render(
      <IconPicker
        variant="button"
        value="RocketIcon"
        onValueChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "RocketIcon" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".lucide-rocket")).toBeInTheDocument();
  });

  it("prop disabled diteruskan ke tombol, klik tombol disabled tidak membuka popover", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker variant="button" onValueChange={vi.fn()} disabled />);

    const button = screen.getByRole("button", { name: "Pilih icon" });
    expect(button).toBeDisabled();

    await user.click(button);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("klik tombol membuka popover berisi search input & grid icon", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker variant="button" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Pilih icon" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cari icon ...")).toBeInTheDocument();
  });

  it("mengetik di search box popover memfilter grid icon", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker variant="button" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Pilih icon" }));
    await user.type(screen.getByPlaceholderText("Cari icon ..."), "rocket");

    expect(await screen.findByTitle("RocketIcon")).toBeInTheDocument();
  });

  it("search tidak match apapun menampilkan pesan 'Icon tidak ditemukan.'", async () => {
    const user = userEvent.setup({ delay: null });
    render(<IconPicker variant="button" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Pilih icon" }));
    await user.type(
      screen.getByPlaceholderText("Cari icon ..."),
      "zzzznotfound",
    );

    expect(
      await screen.findByText("Icon tidak ditemukan."),
    ).toBeInTheDocument();
  });

  it("klik salah satu icon di grid memanggil onValueChange dgn nama icon & menutup popover", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    render(<IconPicker variant="button" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Pilih icon" }));
    await user.type(screen.getByPlaceholderText("Cari icon ..."), "rocket");
    await user.click(await screen.findByTitle("RocketIcon"));

    expect(onValueChange).toHaveBeenCalledWith("RocketIcon");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
