import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

// Show.jsx (Inventory/Items) compose <FormPage><Form/></FormPage> +
// ItemImageUploader (avatar item). Logic UNIK yang jadi fokus:
// - avatar: null jika !imageId, else AvatarImage src=resolveImageSrc(imageId)
// - imageId: isCreate ? null : item?.image (create mode SELALU tanpa avatar existing)
// - alias fallback: 2 huruf pertama dari 2 kata pertama item.code (fallback item.name)
// - hasImage: isCreate ? !!bufferedImage(data.image[0]) : !!imageId
// - tombol hapus: create mode -> setData("image", []) lokal (TIDAK router.delete);
//   edit mode -> router.delete ke `${basePath}${currentQueryString}` dgn
//   options { reset: ["item"], preserveScroll, preserveState }
// - UploadDialog: create mode -> onBuffer=setData("image", items), options=undefined;
//   edit mode -> onBuffer=null, options={ route: basePath+qs, reset: ["item"] }
//
// FormPage di-stub sebagai wrapper render sidebarContent(defaultComp) + children.
// Form di-stub black-box. UploadDialog di-stub black-box (sudah ada test sendiri).
// AvatarImage di-mock jadi <img> polos (Radix Avatar load/error event tak
// pernah fire di jsdom) -- pola sama seperti ManageUsers/Show.rtl.test.jsx.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerDelete = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { delete: (...a) => routerDelete(...a) },
}));

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
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

vi.mock("@/Components/ui/avatar", async () => {
  const actual = await vi.importActual("@/Components/ui/avatar");
  return {
    ...actual,
    AvatarImage: ({ src, alt, className }) => (
      <img src={src} alt={alt} className={className} />
    ),
  };
});

let formPageState = {};
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => formPageState,
  FormPage: (props) => (
    <div data-testid="form-page-stub">
      <div data-testid="form-page-sidebar">
        {props.sidebarContent?.(<div data-testid="default-sidebar-comp" />)}
      </div>
      {props.children}
    </div>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

function findButtonByIconClass(iconClass) {
  return screen
    .queryAllByRole("button")
    .find((b) => b.querySelector(`svg.${iconClass}`));
}

import Show from "./Show";

function renderShow({
  item,
  isCreate = false,
  data = {},
  setData = vi.fn(),
  pathname = "/inventory/items/1",
  search = "",
} = {}) {
  formPageState = { isCreate, data, setData };

  delete window.location;
  window.location = new URL(`https://example.test${pathname}${search}`);

  return render(
    <TooltipProvider>
      <Show item={item} />
    </TooltipProvider>,
  );
}

describe("Show (Inventory/Items)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("avatar: resolveImageSrc & alias fallback", () => {
    it("edit mode, item tanpa image: AvatarImage tidak dirender (fallback alias muncul)", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: null },
      });

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText("I")).toBeInTheDocument();
    });

    it("edit mode, item dengan image: AvatarImage src via resolveImageSrc", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: "abc123" },
      });

      const img = screen.getByRole("img", { hidden: true });
      expect(img).toHaveAttribute(
        "src",
        `files.preview/${JSON.stringify("abc123")}?v=${encodeURIComponent("abc123")}`,
      );
    });

    it("create mode: imageId selalu null walau item.image ada (avatar existing tidak dipakai)", () => {
      renderShow({
        isCreate: true,
        item: { id: 1, code: "ITM01", name: "Kabel", image: "abc123" },
        data: {},
      });

      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("alias: dari code, ambil huruf pertama 2 kata pertama", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITEM UTAMA BARU", name: "Kabel", image: null },
      });

      expect(screen.getByText("IU")).toBeInTheDocument();
    });

    it("alias: fallback ke name saat code null/undefined (bukan string kosong -- '??' hanya menangkap nullish)", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: undefined, name: "Kabel Listrik", image: null },
      });

      expect(screen.getByText("KL")).toBeInTheDocument();
    });
  });

  describe("create mode: buffered image lokal (tanpa item)", () => {
    it("tanpa buffered image: nama file tidak muncul, tombol hapus tidak ada", () => {
      renderShow({ isCreate: true, item: null, data: {} });

      expect(findButtonByIconClass("lucide-trash2")).toBeUndefined();
    });

    it("dengan buffered image (data.image[0]): nama file ditampilkan & tombol hapus muncul", () => {
      renderShow({
        isCreate: true,
        item: null,
        data: { image: [{ name: "foto-item.png" }] },
      });

      expect(screen.getByText("foto-item.png")).toBeInTheDocument();
      expect(findButtonByIconClass("lucide-trash2")).toBeTruthy();
    });

    it("klik hapus di create mode memanggil setData('image', []) TANPA router.delete", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      renderShow({
        isCreate: true,
        item: null,
        data: { image: [{ name: "foto-item.png" }] },
        setData,
      });

      await user.click(findButtonByIconClass("lucide-trash2"));

      expect(setData).toHaveBeenCalledWith("image", []);
      expect(routerDelete).not.toHaveBeenCalled();
    });
  });

  describe("edit mode: hapus image via router.delete", () => {
    it("item.image truthy: tombol hapus muncul", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: "abc" },
      });

      expect(findButtonByIconClass("lucide-trash2")).toBeTruthy();
    });

    it("item.image falsy: tombol hapus tidak muncul", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: null },
      });

      expect(findButtonByIconClass("lucide-trash2")).toBeUndefined();
    });

    it("klik hapus memanggil router.delete ke basePath + currentQueryString dengan options benar", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: "abc" },
        pathname: "/inventory/items/1",
        search: "?tab=detail",
      });

      await user.click(findButtonByIconClass("lucide-trash2"));

      expect(routerDelete).toHaveBeenCalledWith(
        "/inventory/items/1/image?tab=detail",
        {
          reset: ["item"],
          preserveScroll: true,
          preserveState: true,
        },
      );
    });

    it("currentPath dengan trailing slash di-strip sebelum dipakai sebagai basePath", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: "abc" },
        pathname: "/inventory/items/1/",
        search: "",
      });

      await user.click(findButtonByIconClass("lucide-trash2"));

      expect(routerDelete).toHaveBeenCalledWith(
        "/inventory/items/1/image",
        expect.any(Object),
      );
    });
  });

  describe("upload dialog: options berbeda antara create dan edit mode", () => {
    it("create mode: options undefined, onBuffer diteruskan", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      renderShow({ isCreate: true, item: null, data: {}, setData });

      await user.click(findButtonByIconClass("lucide-upload"));

      const lastCallProps =
        uploadDialogPropsSpy.mock.calls[
          uploadDialogPropsSpy.mock.calls.length - 1
        ][0];
      expect(lastCallProps.options).toBeUndefined();
      expect(typeof lastCallProps.onBuffer).toBe("function");

      lastCallProps.onBuffer([{ name: "new.png" }]);
      expect(setData).toHaveBeenCalledWith("image", [{ name: "new.png" }]);
    });

    it("edit mode: options.route ke basePath+qs, onBuffer null", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: "abc" },
        pathname: "/inventory/items/1",
        search: "?tab=detail",
      });

      await user.click(findButtonByIconClass("lucide-upload"));

      const lastCallProps =
        uploadDialogPropsSpy.mock.calls[
          uploadDialogPropsSpy.mock.calls.length - 1
        ][0];
      expect(lastCallProps.options).toEqual({
        route: "/inventory/items/1/image?tab=detail",
        reset: ["item"],
      });
      expect(lastCallProps.onBuffer).toBeNull();
    });

    it("onClose dari UploadDialog menutup dialog", async () => {
      const user = userEvent.setup({ delay: null });
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: null },
      });

      await user.click(findButtonByIconClass("lucide-upload"));
      expect(screen.getByTestId("upload-dialog-stub")).toBeInTheDocument();

      await user.click(screen.getByText("close-upload-dialog"));

      expect(
        screen.queryByTestId("upload-dialog-stub"),
      ).not.toBeInTheDocument();
    });
  });

  describe("compose FormPage + Form", () => {
    it("merender Form (black-box) di dalam FormPage", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: null },
      });

      expect(screen.getByTestId("form-stub")).toBeInTheDocument();
    });

    it("meneruskan defaultComp sidebar bawaan FormPage di bawah avatar", () => {
      renderShow({
        isCreate: false,
        item: { id: 1, code: "ITM01", name: "Kabel", image: null },
      });

      const sidebar = screen.getByTestId("form-page-sidebar");
      expect(
        within(sidebar).getByTestId("default-sidebar-comp"),
      ).toBeInTheDocument();
    });
  });
});
