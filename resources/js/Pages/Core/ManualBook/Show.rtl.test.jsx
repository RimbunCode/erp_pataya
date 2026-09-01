import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key, fallback) => fallback ?? key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

vi.mock("@inertiajs/react", () => ({
  Head: () => null,
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-app-layout">{children}</div>
  ),
}));

vi.mock("@inertiajs/core", async () => {
  const actual = await vi.importActual("@inertiajs/core");
  return { ...actual, router: { visit: vi.fn(), prefetch: vi.fn() } };
});

window.route = (name) => name;
window.print = vi.fn();

const mmrProps = vi.fn();
vi.mock("@/Components/ManualBook/MarkdownMermaidRenderer", () => ({
  default: (props) => {
    mmrProps(props);
    return <div data-testid="stub-mmr" />;
  },
}));

const tocHeadings = vi.fn();
vi.mock("@/Components/ManualBook/ManualBookToc", () => ({
  default: ({ headings }) => {
    tocHeadings(headings);
    return <div data-testid="stub-toc">{headings?.length ?? 0}</div>;
  },
}));

const renderShow = (props) =>
  render(
    <TooltipProvider>
      <Show
        title="Panduan A"
        description="Deskripsi"
        content_html="<p>Hi</p>"
        {...props}
      />
    </TooltipProvider>,
  );

import Show from "./Show";

describe("ManualBook Show", () => {
  beforeEach(() => {
    mmrProps.mockReset();
    tocHeadings.mockReset();
    window.print.mockReset();
  });

  it("menampilkan title dan description", () => {
    renderShow();
    expect(screen.getByText("Panduan A")).toBeInTheDocument();
    expect(screen.getByText("Deskripsi")).toBeInTheDocument();
  });

  it("tidak menampilkan description saat kosong", () => {
    renderShow({ description: undefined });
    expect(screen.queryByText("Deskripsi")).not.toBeInTheDocument();
  });

  it("tombol print disabled selama isReady=false (belum dipanggil onReadyChange)", () => {
    renderShow();
    const printButtons = screen.getAllByText(/Menyiapkan diagram/);
    expect(printButtons.length).toBeGreaterThan(0);
  });

  it("tombol print aktif setelah MarkdownMermaidRenderer memanggil onReadyChange(true)", async () => {
    const user = userEvent.setup({ delay: null });
    renderShow();

    const { onReadyChange } = mmrProps.mock.calls[0][0];
    onReadyChange(true);

    const printButton = await screen.findAllByText("Cetak");
    expect(printButton.length).toBeGreaterThan(0);

    await user.click(printButton[0]);
    expect(window.print).toHaveBeenCalled();
  });

  it("klik print saat belum ready tidak memanggil window.print (tombol disabled)", async () => {
    const user = userEvent.setup({ delay: null });
    renderShow();

    const desktopPrintButton = screen
      .getAllByText(/Menyiapkan diagram/)[0]
      .closest("button");
    expect(desktopPrintButton).toBeDisabled();
    await user.click(desktopPrintButton);

    expect(window.print).not.toHaveBeenCalled();
  });

  it("MarkdownMermaidRenderer memanggil onHeadingsChange meneruskan headings ke ManualBookToc", () => {
    renderShow();

    const { onHeadingsChange } = mmrProps.mock.calls[0][0];
    act(() => {
      onHeadingsChange([{ id: "a", text: "A", level: 2 }]);
    });

    // ManualBookToc di-re-render setelah setHeadings -- cek panggilan terakhir.
    expect(tocHeadings).toHaveBeenLastCalledWith([
      { id: "a", text: "A", level: 2 },
    ]);
  });

  it("MarkdownMermaidRenderer menerima content_html sebagai prop html", () => {
    renderShow({ content_html: "<h2>Custom</h2>" });

    expect(mmrProps.mock.calls[0][0].html).toBe("<h2>Custom</h2>");
  });
});
