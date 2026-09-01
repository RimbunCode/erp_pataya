import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";
import React from "react";

// Show.jsx (ManageUsers) adalah halaman detail/profil User: compose
// <FormPage><Form/></FormPage> + UploadDialog (foto profil) +
// FormChangePassword (dialog ganti password). Logic UNIK yang jadi fokus
// test ini (bukan komponen anak yang sudah/akan ditest sendiri):
// - avatar: null jika !user.picture, else AvatarImage src=resolveImageSrc(user.picture)
// - alias fallback: 2 huruf pertama dari 2 kata pertama user.name
// - authUser.id === user.id menggerbang: area upload/hapus foto, tombol
//   hapus foto (butuh user.image truthy juga), class blur-on-hover avatar,
//   dan `controls` (connect google + ganti password) -- profil ORANG LAIN
//   tidak menampilkan semua itu
// - tombol hapus foto memanggil router.delete ke `${currentPath}/image${currentQueryString}`
//   dengan options { reset: ["user","auth"], preserveScroll, preserveState }
// - UploadDialog options.route sama persis, options.reset sama
// - tombol "ganti password" memanggil ref.current.open() -> FormPageDialog dibuka
//
// FormPage & FormPageDialog (Core/FormPage) di-stub sebagai wrapper render
// children/render-prop (logic form generik sudah bukan concern file ini).
// Form & FormChangePassword di-stub sebagai black-box (test-nya sendiri
// sudah/akan ada terpisah). UploadDialog di-stub sebagai black-box (sudah
// ada UploadDialog.rtl.test.jsx). Dialog/DialogTrigger/Avatar/Tooltip/Button
// TIDAK distub -- dipakai asli (pola sama seperti UploadDialog.rtl.test.jsx
// yang membungkus dengan <Dialog> asli).

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerDelete = vi.fn();
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { delete: (...a) => routerDelete(...a) },
}));

vi.mock("@/Pages/Users/ManageUsers/Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Users/ManageUsers/FormChangePassword", () => ({
  default: () => <div data-testid="form-change-password-stub" />,
}));

const uploadDialogPropsSpy = vi.fn();
vi.mock("@/Pages/Core/Components/UploadDialog", () => ({
  default: (props) => {
    uploadDialogPropsSpy(props);
    return props.open ? (
      <div data-testid="upload-dialog-stub">
        <button type="button" onClick={() => props.onClose?.()}>
          close-upload-dialog
        </button>
      </div>
    ) : null;
  },
}));

// AvatarImage (Radix Avatar) mendeteksi keberhasilan load gambar lewat
// event `load`/`error` pada <img> yang tidak pernah terpicu di jsdom --
// <img> asli tidak pernah dirender (stuck di status "idle"/"loading"), jadi
// getByRole("img") selalu gagal walau src valid. Stub jadi <img> polos
// murni untuk memverifikasi `src` yang dihitung Show.jsx sendiri
// (resolveImageSrc) -- bukan perilaku loading-state Radix.
vi.mock("@/Components/ui/avatar", async () => {
  const actual = await vi.importActual("@/Components/ui/avatar");
  return {
    ...actual,
    AvatarImage: ({ src, alt, className }) => (
      <img src={src} alt={alt} className={className} />
    ),
  };
});

// FormPage & FormPageDialog di-stub sebagai wrapper: FormPage merender
// sidebarContent(defaultComp) + controls() + children apa adanya supaya
// interaksi Show.jsx sendiri (bukan detail internal FormPage) yang diuji.
// FormPageDialog di-stub forwardRef dengan imperative handle open/close
// asli (React state), supaya klik tombol "ganti password" -> ref.open()
// benar-benar membuka dialog dan children (FormChangePassword stub) muncul.
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: (props) => (
    <div data-testid="form-page-stub">
      <div data-testid="form-page-sidebar">
        {props.sidebarContent?.(<div data-testid="default-sidebar-comp" />)}
      </div>
      <div data-testid="form-page-controls">{props.controls?.()}</div>
      {props.children}
    </div>
  ),
  FormPageDialog: React.forwardRef(function FakeFormPageDialog(
    { title, name, children },
    ref,
  ) {
    const [open, setOpen] = React.useState(false);
    React.useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }));
    if (!open) {
      return <div data-testid={`dialog-${name}-closed`} />;
    }
    return (
      <div data-testid={`dialog-${name}`}>
        <span>{title}</span>
        {children}
      </div>
    );
  }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Show from "./Show";

// Tombol upload/hapus foto adalah icon-only button di dalam <TooltipTrigger>
// -- teks labelnya cuma ada di <TooltipContent>, yang (mengikuti perilaku
// asli Radix Tooltip) TIDAK dirender ke DOM sampai tooltip benar-benar
// terbuka (hover/focus). Alih-alih memicu hover (rapuh & tidak perlu),
// temukan tombol lewat class svg lucide-nya -- pola yang sama dipakai
// UploadDialog.rtl.test.jsx untuk tombol hapus file (Trash2 tanpa teks).
function findButtonByIconClass(iconClass) {
  return screen
    .queryAllByRole("button")
    .find((b) => b.querySelector(`svg.${iconClass}`));
}

function renderShow({
  user,
  authUser = { id: 1 },
  pathname = "/users/1",
  search = "",
} = {}) {
  usePageMock.mockReturnValue({
    props: { auth: { user: authUser } },
  });

  delete window.location;
  window.location = new URL(`https://example.test${pathname}${search}`);

  return render(
    <TooltipProvider>
      <Show user={user} />
    </TooltipProvider>,
  );
}

describe("Show (Users/ManageUsers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("avatar: resolveImageSrc & alias fallback", () => {
    it("user tanpa picture: AvatarImage tidak dirender (fallback alias muncul)", () => {
      renderShow({
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText("BS")).toBeInTheDocument();
    });

    it("user dengan picture: AvatarImage src via resolveImageSrc (route files.preview + cache-bust)", () => {
      renderShow({
        user: { id: 1, name: "Budi Santoso", picture: "abc123" },
      });

      const img = screen.getByRole("img", { hidden: true });
      expect(img).toHaveAttribute(
        "src",
        `files.preview/${JSON.stringify("abc123")}?v=${encodeURIComponent("abc123")}`,
      );
    });

    it("user dengan picture berupa URL absolut: dipakai apa adanya (+ cache-bust), tidak lewat route files.preview", () => {
      renderShow({
        user: {
          id: 1,
          name: "Budi Santoso",
          picture: "https://cdn.test/avatar.png",
        },
      });

      const img = screen.getByRole("img", { hidden: true });
      expect(img).toHaveAttribute(
        "src",
        `https://cdn.test/avatar.png?v=${encodeURIComponent("https://cdn.test/avatar.png")}`,
      );
    });

    it("alias: hanya mengambil huruf pertama dari 2 kata pertama nama (nama 3 kata)", () => {
      renderShow({
        user: { id: 1, name: "Budi Santoso Wijaya", picture: null },
      });

      expect(screen.getByText("BS")).toBeInTheDocument();
    });

    it("alias: nama satu kata menghasilkan 1 huruf", () => {
      renderShow({
        user: { id: 1, name: "Budi", picture: null },
      });

      expect(screen.getByText("B")).toBeInTheDocument();
    });
  });

  describe("authUser.id === user.id: gating area upload/hapus foto & controls", () => {
    it("profil sendiri (authUser.id === user.id): tombol upload foto muncul", () => {
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      expect(findButtonByIconClass("lucide-upload")).toBeTruthy();
    });

    it("profil orang lain (authUser.id !== user.id): tombol upload foto TIDAK muncul", () => {
      renderShow({
        authUser: { id: 1 },
        user: { id: 2, name: "Orang Lain", picture: null, image: true },
      });

      expect(findButtonByIconClass("lucide-upload")).toBeUndefined();
      expect(findButtonByIconClass("lucide-trash2")).toBeUndefined();
    });

    it("profil sendiri & user.image truthy: tombol hapus foto muncul", () => {
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: "abc", image: true },
      });

      expect(findButtonByIconClass("lucide-trash2")).toBeTruthy();
    });

    it("profil sendiri tapi user.image falsy: tombol hapus foto TIDAK muncul", () => {
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: "abc", image: false },
      });

      expect(findButtonByIconClass("lucide-trash2")).toBeUndefined();
    });

    it("profil sendiri: controls (connect google + ganti password) dirender", () => {
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      expect(
        screen.getByText("user.user.connect_provider.connect_google"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("user.user.manage_password.change_password"),
      ).toBeInTheDocument();
    });

    it("profil orang lain: controls (connect google + ganti password) TIDAK dirender", () => {
      renderShow({
        authUser: { id: 1 },
        user: { id: 2, name: "Orang Lain", picture: null },
      });

      expect(
        screen.queryByText("user.user.connect_provider.connect_google"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("user.user.manage_password.change_password"),
      ).not.toBeInTheDocument();
    });
  });

  describe("tombol hapus foto: router.delete ke basePath + currentQueryString", () => {
    it("klik hapus foto memanggil router.delete dengan path & options yang benar", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: "abc", image: true },
        pathname: "/users/1",
        search: "?tab=profile",
      });

      await user.click(findButtonByIconClass("lucide-trash2"));

      expect(routerDelete).toHaveBeenCalledTimes(1);
      expect(routerDelete).toHaveBeenCalledWith("/users/1/image?tab=profile", {
        reset: ["user", "auth"],
        preserveScroll: true,
        preserveState: true,
      });
    });

    it("currentPath dengan trailing slash di-strip sebelum dipakai sebagai basePath", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: "abc", image: true },
        pathname: "/users/1/",
        search: "",
      });

      await user.click(findButtonByIconClass("lucide-trash2"));

      expect(routerDelete).toHaveBeenCalledWith(
        "/users/1/image",
        expect.any(Object),
      );
    });
  });

  describe("upload dialog: open/close & options.route", () => {
    it("klik tombol upload membuka UploadDialog (open=true) dengan options.route & reset yang benar", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: null },
        pathname: "/users/1",
        search: "?tab=profile",
      });

      // Sebelum diklik: UploadDialog stub dirender dengan open=false -> null
      expect(
        screen.queryByTestId("upload-dialog-stub"),
      ).not.toBeInTheDocument();

      await user.click(findButtonByIconClass("lucide-upload"));

      expect(screen.getByTestId("upload-dialog-stub")).toBeInTheDocument();
      const lastCallProps =
        uploadDialogPropsSpy.mock.calls[
          uploadDialogPropsSpy.mock.calls.length - 1
        ][0];
      expect(lastCallProps.imageOnly).toBe(true);
      expect(lastCallProps.options).toEqual({
        route: "/users/1/image?tab=profile",
        reset: ["user", "auth"],
      });
    });

    it("onClose dari UploadDialog menutup dialog (openAttachment kembali false)", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      await user.click(findButtonByIconClass("lucide-upload"));
      expect(screen.getByTestId("upload-dialog-stub")).toBeInTheDocument();

      await user.click(screen.getByText("close-upload-dialog"));

      expect(
        screen.queryByTestId("upload-dialog-stub"),
      ).not.toBeInTheDocument();
    });
  });

  describe("tombol ganti password: membuka FormPageDialog change_password", () => {
    it("dialog change_password tertutup secara default", () => {
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      expect(
        screen.getByTestId("dialog-change_password-closed"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("form-change-password-stub"),
      ).not.toBeInTheDocument();
    });

    it("klik tombol ganti password membuka dialog change_password (berisi FormChangePassword)", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        authUser: { id: 1 },
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      await user.click(
        screen.getByText("user.user.manage_password.change_password"),
      );

      expect(screen.getByTestId("dialog-change_password")).toBeInTheDocument();
      expect(
        screen.getByTestId("form-change-password-stub"),
      ).toBeInTheDocument();
    });
  });

  describe("compose FormPage + Form", () => {
    it("merender Form (black-box) di dalam FormPage", () => {
      renderShow({
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      expect(screen.getByTestId("form-stub")).toBeInTheDocument();
    });

    it("meneruskan defaultComp sidebar bawaan FormPage di bawah avatar", () => {
      renderShow({
        user: { id: 1, name: "Budi Santoso", picture: null },
      });

      const sidebar = screen.getByTestId("form-page-sidebar");
      expect(
        within(sidebar).getByTestId("default-sidebar-comp"),
      ).toBeInTheDocument();
    });
  });
});
