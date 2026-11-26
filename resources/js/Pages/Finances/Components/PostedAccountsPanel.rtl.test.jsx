import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  // Deferred menampilkan fallback selama prop belum ada, lalu children setelah prop terisi.
  Deferred: ({ data, fallback, children }) => {
    const props = usePageMock().props;
    const loaded = data.every((key) => props[key] !== undefined);
    return loaded ? children : fallback;
  },
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// FormPageContent butuh konteks FormPage penuh (tab). Test ini hanya menguji isi panel.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

window.route = (name) => `/${name}`;

import PostedAccountsPanel from "./PostedAccountsPanel";

const rows = [
  {
    role: "receivable",
    label: "Piutang",
    lines: 0,
    account: { id: "a1", number: "1200", name: "Piutang Usaha" },
  },
  {
    role: "revenue",
    label: "Pendapatan",
    lines: 3,
    account: { id: "a2", number: "4000", name: "Penjualan Barang" },
  },
];

function renderWith(postedAccounts, props = {}) {
  usePageMock.mockReturnValue({ props: { postedAccounts } });
  return render(<PostedAccountsPanel {...props} />);
}

describe("PostedAccountsPanel", () => {
  beforeEach(() => {
    usePageMock.mockReset();
  });

  it("menampilkan skeleton selama prop postedAccounts belum dimuat", () => {
    const { container } = renderWith(undefined);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("menampilkan pratinjau sebelum approve dengan peran, akun, dan jumlah baris", () => {
    renderWith({
      state: "preview",
      estimated: false,
      message: null,
      fixable: false,
      rows,
    });

    const region = screen.getByRole("region", {
      name: "finances.postedAccounts.title",
    });
    expect(
      within(region).getByText("finances.postedAccounts.states.preview"),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("1200 - Piutang Usaha"),
    ).toBeInTheDocument();
    expect(within(region).getByText("Pendapatan")).toBeInTheDocument();
    expect(within(region).getByText("3")).toBeInTheDocument();
    expect(
      screen.queryByText("finances.postedAccounts.states.estimated"),
    ).not.toBeInTheDocument();
  });

  it("menandai pratinjau perkiraan", () => {
    renderWith({
      state: "preview",
      estimated: true,
      message: null,
      fixable: false,
      rows,
    });

    expect(
      screen.getByText("finances.postedAccounts.states.estimated"),
    ).toBeInTheDocument();
  });

  it("menampilkan akun tercatat sesudah approve", () => {
    renderWith({
      state: "recorded",
      estimated: false,
      message: null,
      fixable: false,
      rows,
    });

    expect(
      screen.getByText("finances.postedAccounts.states.recorded"),
    ).toBeInTheDocument();
    expect(screen.getByText("4000 - Penjualan Barang")).toBeInTheDocument();
  });

  it.each(["pending_approval", "pending_posting", "unavailable"])(
    "menampilkan catatan untuk state %s tanpa tabel",
    (state) => {
      renderWith({
        state,
        estimated: false,
        message: null,
        fixable: false,
        rows: [],
      });

      expect(
        screen.getByText(`finances.postedAccounts.states.${state}`),
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    },
  );

  it("menampilkan pesan peran tak ter-resolve beserta tautan ke Posting Profile", () => {
    renderWith({
      state: "error",
      estimated: false,
      message: 'Peran akun "revenue" tidak dapat ditentukan.',
      fixable: true,
      rows: [],
    });

    expect(screen.getByRole("alert")).toHaveTextContent('Peran akun "revenue"');
    expect(
      screen.getByRole("link", { name: "finances.postedAccounts.fix_profile" }),
    ).toHaveAttribute("href", "/postingProfiles.index");
  });

  it("tidak menampilkan tautan perbaikan untuk galat umum", () => {
    renderWith({
      state: "error",
      estimated: false,
      message: "Gagal.",
      fixable: false,
      rows: [],
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Gagal.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("dokumen baru hanya menampilkan catatan tanpa menunggu data", () => {
    renderWith(undefined, { isNew: true });

    expect(
      screen.getByText("finances.postedAccounts.states.new"),
    ).toBeInTheDocument();
  });

  it("hanya-baca: tidak ada kontrol input sama sekali (P-14)", () => {
    renderWith({
      state: "preview",
      estimated: false,
      message: null,
      fixable: false,
      rows,
    });

    const region = screen.getByRole("region", {
      name: "finances.postedAccounts.title",
    });
    expect(within(region).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(region).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(region).queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(within(region).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(region.querySelector("input, select, textarea")).toBeNull();
  });
});
