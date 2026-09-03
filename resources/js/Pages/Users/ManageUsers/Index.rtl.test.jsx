import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// AvatarImage (Radix Avatar) hanya merender <img> setelah status loading
// internalnya mencapai 'loaded', yang di-drive lewat event load/error pada
// objek `window.Image()` buatan Radix -- event itu TIDAK PERNAH terpicu
// otomatis di jsdom. Stub jadi <img> polos agar `src` yang dihitung Index.jsx
// sendiri (resolveImageSrc) bisa diverifikasi -- pola sama seperti
// resources/js/Pages/Users/ManageUsers/Show.rtl.test.jsx dan
// resources/js/Components/ui/avatar.rtl.test.jsx.
vi.mock("@/Components/ui/avatar", async () => {
  const actual = await vi.importActual("@/Components/ui/avatar");
  return {
    ...actual,
    AvatarImage: ({ src, alt, className }) => (
      <img src={src} alt={alt} className={className} />
    ),
  };
});

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("ManageUsers Index", () => {
  it("meneruskan usePasswordConfirmationForDelete, templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(capturedProps.usePasswordConfirmationForDelete).toBe(true);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender name dan email dataRow (tanpa picture: img tidak muncul, fallback alias tampil)", () => {
    render(<Index />);
    const dataRow = { id: 1, name: "Budi Santoso", email: "budi@example.test" };
    const { container, queryByRole, getByText } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(getByText("Budi Santoso")).toBeInTheDocument();
    expect(getByText("budi@example.test")).toBeInTheDocument();
    expect(queryByRole("img")).not.toBeInTheDocument();
    expect(getByText("BS")).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it("alias: hanya mengambil huruf pertama dari 2 kata pertama nama (nama 3 kata)", () => {
    render(<Index />);
    const dataRow = { id: 2, name: "Budi Santoso Wijaya", email: "a@b.test" };
    const { getByText } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(getByText("BS")).toBeInTheDocument();
  });

  it("alias: nama satu kata menghasilkan 1 huruf", () => {
    render(<Index />);
    const dataRow = { id: 3, name: "Budi", email: "a@b.test" };
    const { getByText } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(getByText("B")).toBeInTheDocument();
  });

  it("dataRow.picture truthy: AvatarImage src via resolveImageSrc (route files.preview + cache-bust)", () => {
    render(<Index />);
    const dataRow = {
      id: 4,
      name: "Budi Santoso",
      email: "budi@example.test",
      picture: "abc123",
    };
    const { getByRole } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const img = getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      `files.preview/abc123?v=${encodeURIComponent("abc123")}`,
    );
    expect(img).toHaveAttribute("alt", "Budi Santoso");
  });

  it('Link (as="button") memicu router.visit ke route users.show dengan id dataRow', async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, name: "Budi Santoso", email: "budi@example.test" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith("users.show/7", expect.anything());
    visitSpy.mockRestore();
  });

  it("mengklik Link tidak melempar error (tidak ada tombol hapus di templateItem ini)", async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 9, name: "Orang Lain", email: "lain@example.test" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    await user.click(button);
    expect(button).toBeInTheDocument();
    visitSpy.mockRestore();
  });
});
