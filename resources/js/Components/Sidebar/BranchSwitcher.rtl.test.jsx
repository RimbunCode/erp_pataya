import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const usePageMock = vi.fn();
const routerPut = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { put: (...a) => routerPut(...a) },
  Link: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

window.route = (name, id) => (id ? `${name}/${id}` : name);

import BranchSwitcher from "./BranchSwitcher";
import { SidebarProvider } from "@/Components/ui/sidebar";

// SidebarMenuButton (dipakai BranchSwitcher) memanggil useSidebar() sebagai
// referensi INTRA-MODUL di sidebar.jsx sendiri -- vi.mock hanya bisa override
// binding yang di-export, bukan pemanggilan lokal semacam ini. Maka wrapper
// SidebarProvider ASLI dipakai di sini, bukan mock useSidebar parsial.
const renderWithSidebar = (ui) => render(<SidebarProvider>{ui}</SidebarProvider>);

const branches = [
  { id: 1, name: "Jakarta" },
  { id: 2, name: "Surabaya" },
];

describe("BranchSwitcher", () => {
  beforeEach(() => {
    routerPut.mockReset();
    usePageMock.mockReturnValue({
      props: {
        branchSettings: { branches, currentBranch: branches[0] },
      },
    });
  });

  it("menampilkan nama currentBranch pada trigger", () => {
    renderWithSidebar(<BranchSwitcher />);
    expect(screen.getByText("Jakarta")).toBeInTheDocument();
  });

  it("klik trigger membuka dropdown berisi daftar semua branch", async () => {
    const user = userEvent.setup({ delay: null });
    renderWithSidebar(<BranchSwitcher />);

    await user.click(screen.getAllByText("Jakarta")[0]);

    expect(await screen.findByText("Surabaya")).toBeInTheDocument();
  });

  it("link tiap branch mengarah ke route branch.switch dengan id-nya", async () => {
    const user = userEvent.setup({ delay: null });
    renderWithSidebar(<BranchSwitcher />);

    await user.click(screen.getAllByText("Jakarta")[0]);
    await screen.findByText("Surabaya");

    expect(screen.getByText("Surabaya").closest("a")).toHaveAttribute(
      "href",
      "branch.switch/2",
    );
  });

  it("Ctrl+<n> memicu router.put ke branch ke-n", () => {
    renderWithSidebar(<BranchSwitcher />);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "2", ctrlKey: true }),
    );

    expect(routerPut).toHaveBeenCalledWith(
      "branch.switch/2",
      {},
      expect.objectContaining({ replace: true }),
    );
  });
});
