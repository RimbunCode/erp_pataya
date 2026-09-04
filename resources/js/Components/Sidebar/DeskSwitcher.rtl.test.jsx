import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const usePageMock = vi.fn();
const routerPost = vi.fn();
const routerReload = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: {
    post: (...args) => routerPost(...args),
    reload: (...args) => routerReload(...args),
  },
}));

window.route = (name) => name;

import DeskSwitcher from "./DeskSwitcher";

// Icon lucide-react asli (bukan di-mock) supaya integrasi dgn resolveIcon()
// (lib/deskIcons.jsx) ikut teruji — sama seperti pola BranchSwitcher.jsx yg
// juga memakai icon lucide-react langsung tanpa mock.
const desks = [
  { id: "s2", name: "Zebra Desk", type: "system", icon: null },
  { id: "s1", name: "Apple Desk", type: "system", icon: "Building2Icon" },
  { id: "c2", name: "Zeta Custom", type: "custom", icon: null },
  { id: "c1", name: "Beta Custom", type: "custom", icon: "Building2Icon" },
];

function setPageProps({ activeDesk, deskList }) {
  usePageMock.mockReturnValue({ props: { activeDesk, deskList } });
}

describe("DeskSwitcher", () => {
  beforeEach(() => {
    routerPost.mockReset();
    routerReload.mockReset();
    usePageMock.mockReset();
    window.history.pushState({}, "", "/original-page");
  });

  describe("render dasar", () => {
    it("tidak merender apapun kalau activeDesk belum ada (falsy)", () => {
      setPageProps({ activeDesk: null, deskList: desks });
      const { container } = render(<DeskSwitcher />);

      expect(container).toBeEmptyDOMElement();
    });

    it("menampilkan nama activeDesk pada trigger", () => {
      setPageProps({ activeDesk: desks[1], deskList: desks });
      render(<DeskSwitcher />);

      expect(
        screen.getByRole("button", { name: "Apple Desk" }),
      ).toBeInTheDocument();
    });

    it("menampilkan icon activeDesk kalau resolveIcon() mengembalikan komponen", () => {
      setPageProps({ activeDesk: desks[1], deskList: desks });
      render(<DeskSwitcher />);

      const trigger = screen.getByRole("button", { name: "Apple Desk" });
      expect(trigger.querySelector("svg")).toBeInTheDocument();
    });

    it("tidak menampilkan icon kalau activeDesk.icon tidak resolve ke komponen manapun", () => {
      setPageProps({ activeDesk: desks[0], deskList: desks });
      render(<DeskSwitcher />);

      const trigger = screen.getByRole("button", { name: "Zebra Desk" });
      expect(trigger.querySelector("svg")).not.toBeInTheDocument();
    });

    it("deskList undefined tidak membuat crash, dropdown tetap bisa dibuka tanpa item desk", async () => {
      const user = userEvent.setup();
      setPageProps({ activeDesk: desks[0], deskList: undefined });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));

      expect(screen.getByText("Desks")).toBeInTheDocument();
      expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    });
  });

  describe("urutan & pengelompokan desk di dropdown (sortDesks)", () => {
    it("desk system tampil lebih dulu (diurutkan alfabetis), lalu desk custom (diurutkan alfabetis)", async () => {
      const user = userEvent.setup();
      setPageProps({ activeDesk: desks[0], deskList: desks });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));
      const menu = screen.getByRole("menu");
      const itemNames = within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(itemNames).toEqual([
        "Apple Desk",
        "Zebra Desk",
        "Beta Custom",
        "Zeta Custom",
      ]);
    });

    it("separator hanya muncul sekali, tepat di transisi grup system ke custom", async () => {
      const user = userEvent.setup();
      setPageProps({ activeDesk: desks[0], deskList: desks });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));
      const menu = screen.getByRole("menu");
      const children = Array.from(menu.children);
      const separatorIndex = children.findIndex(
        (el) => el.getAttribute("role") === "separator",
      );
      const beforeSeparator = children[separatorIndex - 1];
      const afterSeparator = children[separatorIndex + 1];

      expect(within(menu).getAllByRole("separator")).toHaveLength(1);
      expect(beforeSeparator).toHaveTextContent("Zebra Desk");
      expect(afterSeparator).toHaveTextContent("Beta Custom");
    });

    it("tidak ada separator kalau semua desk satu type saja (tidak ada transisi grup)", async () => {
      const user = userEvent.setup();
      const onlySystem = [desks[0], desks[1]];
      setPageProps({ activeDesk: desks[0], deskList: onlySystem });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));

      expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    });
  });

  describe("switchDesk() - klik item desk memicu router.post", () => {
    it("klik desk item memanggil router.post ke route desk.switch dengan desk_id yang benar", async () => {
      const user = userEvent.setup();
      setPageProps({ activeDesk: desks[0], deskList: desks });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));
      await user.click(screen.getByRole("menuitem", { name: "Beta Custom" }));

      expect(routerPost).toHaveBeenCalledTimes(1);
      expect(routerPost).toHaveBeenCalledWith(
        "desk.switch",
        { desk_id: "c1" },
        expect.objectContaining({
          preserveScroll: true,
          preserveState: true,
          onSuccess: expect.any(Function),
        }),
      );
    });

    it("dropdown tertutup setelah desk item diklik", async () => {
      const user = userEvent.setup();
      setPageProps({ activeDesk: desks[0], deskList: desks });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));
      await user.click(screen.getByRole("menuitem", { name: "Beta Custom" }));

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  describe("onSuccess switchDesk() - partial reload hanya kalau bukan hasil redirect server", () => {
    it("pathname tidak berubah (bukan redirect) -> router.reload dipanggil dgn only activeDesk/deskList/menuItems", async () => {
      const user = userEvent.setup();
      setPageProps({ activeDesk: desks[0], deskList: desks });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));
      await user.click(screen.getByRole("menuitem", { name: "Beta Custom" }));

      const { onSuccess } = routerPost.mock.calls[0][2];
      // Simulasikan respons Inertia yang TIDAK redirect: pathname tetap sama
      // dgn sebelum request (masih "/original-page" dari beforeEach).
      onSuccess();

      expect(routerReload).toHaveBeenCalledTimes(1);
      expect(routerReload).toHaveBeenCalledWith({
        only: ["activeDesk", "deskList", "menuItems"],
      });
    });

    it("pathname berubah (server redirect ke halaman lain) -> router.reload TIDAK dipanggil", async () => {
      const user = userEvent.setup();
      setPageProps({ activeDesk: desks[0], deskList: desks });
      render(<DeskSwitcher />);

      await user.click(screen.getByRole("button", { name: "Zebra Desk" }));
      await user.click(screen.getByRole("menuitem", { name: "Beta Custom" }));

      const { onSuccess } = routerPost.mock.calls[0][2];
      // Simulasikan Inertia sudah redirect ke halaman baru sebelum onSuccess
      // jalan -- partial reload manual harus di-skip (Requirement 6 AC 4).
      window.history.pushState({}, "", "/halaman-baru-setelah-redirect");
      onSuccess();

      expect(routerReload).not.toHaveBeenCalled();
    });
  });
});
