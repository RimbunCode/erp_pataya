import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const usePageMock = vi.fn();
const routerVisit = vi.fn();
const routerPost = vi.fn();
const routerDelete = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: {
    visit: (...a) => routerVisit(...a),
    post: (...a) => routerPost(...a),
    delete: (...a) => routerDelete(...a),
  },
  // Deferred hanya membungkus fallback/children berdasar kesiapan data --
  // di test ini data (assignees) selalu langsung tersedia lewat usePage,
  // jadi cukup render children secara langsung (mirroring perilaku "loaded").
  Deferred: ({ children }) => children,
}));

// useFormPage datang dari FormPage.jsx (file besar, banyak dependency lain)
// -- mock modulnya langsung agar AssignedTo bisa diuji dalam mode create
// (dengan context) maupun mode edit (context undefined, fallback `?? {}`).
const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...a) => useFormPageMock(...a),
}));

// AssignDialog (berisi AssignedToFields, form kompleks) sudah punya test
// sendiri -- stub di sini agar test AssignedTo fokus ke: render daftar
// assignee, buka dialog, submit (create vs edit mode), remove assignee.
const assignDialogProps = vi.fn();
vi.mock("./AssignDialog", () => ({
  default: (props) => {
    assignDialogProps(props);
    return (
      <div data-testid="stub-assign-dialog">
        <button
          onClick={() => props.onSubmit({ allocated_to: null, type: "task" })}
        >
          submit-dialog
        </button>
        <button onClick={props.onClose}>close-dialog</button>
      </div>
    );
  },
}));

window.route = (name, id) => (id ? `${name}/${id}` : name);

import AssignedTo from "./AssignedTo";

const setUrl = (pathname, search = "") => {
  window.history.pushState({}, "", `${pathname}${search}`);
};

describe("AssignedTo", () => {
  beforeEach(() => {
    routerVisit.mockReset();
    routerPost.mockReset();
    routerDelete.mockReset();
    assignDialogProps.mockClear();
    useFormPageMock.mockReset();
    useFormPageMock.mockReturnValue(undefined);
    setUrl("/todos/5");
    usePageMock.mockReturnValue({
      props: {
        assignees: [],
        auth: { user: { id: 1, name: "Aku" } },
      },
    });
  });

  it("mode edit (bukan create): menampilkan daftar assignees dari shared props", () => {
    usePageMock.mockReturnValue({
      props: {
        assignees: [
          {
            id: 1,
            allocated_to_id: 9,
            name: "Budi",
            type: "task",
            status: "open",
          },
        ],
        auth: { user: { id: 1, name: "Aku" } },
      },
    });

    render(<AssignedTo />);

    expect(screen.getByText("Budi")).toBeInTheDocument();
    expect(screen.getByText("TR:core.form.assigned_to")).toBeInTheDocument();
  });

  it("mode create: menampilkan buffered_assignees dari form data, bukan shared props assignees", () => {
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: {
        buffered_assignees: [
          {
            id: "buf1",
            allocated_to_id: 3,
            name: "Citra",
            type: "event",
            status: "open",
          },
        ],
      },
      setData: vi.fn(),
    });
    usePageMock.mockReturnValue({
      props: {
        assignees: [
          {
            id: 999,
            allocated_to_id: 1,
            name: "Harus Diabaikan",
            status: "open",
          },
        ],
        auth: { user: { id: 1, name: "Aku" } },
      },
    });

    render(<AssignedTo />);

    expect(screen.getByText("Citra")).toBeInTheDocument();
    expect(screen.queryByText("Harus Diabaikan")).not.toBeInTheDocument();
  });

  it("klik tombol Plus membuka AssignDialog dengan initialValue null (mode tambah baru)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AssignedTo />);

    // Tombol "Plus" adalah satu-satunya button di header sebelum dialog dibuka.
    await user.click(screen.getByRole("button"));

    expect(screen.getByTestId("stub-assign-dialog")).toBeInTheDocument();
    expect(assignDialogProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialValue: null }),
    );
  });

  it("mode edit: submit dialog memanggil router.post ke {path}/assignee", async () => {
    const user = userEvent.setup({ delay: null });
    setUrl("/todos/5");
    render(<AssignedTo />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("submit-dialog"));

    expect(routerPost).toHaveBeenCalledWith(
      "/todos/5/assignee",
      { allocated_to: null, type: "task" },
      expect.objectContaining({ reset: ["assignees"], preserveState: true }),
    );
  });

  it("mode create: submit dialog menyimpan ke buffered_assignees via setData, tanpa router.post", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: { buffered_assignees: [] },
      setData,
    });

    render(<AssignedTo />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("submit-dialog"));

    expect(setData).toHaveBeenCalledWith(
      "buffered_assignees",
      expect.arrayContaining([
        expect.objectContaining({
          allocated_to_id: 1, // fallback ke auth.user karena allocated_to null
          name: "Aku",
          type: "task",
        }),
      ]),
    );
    expect(routerPost).not.toHaveBeenCalled();
  });

  it("klik close pada dialog menutupnya tanpa submit", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AssignedTo />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByTestId("stub-assign-dialog")).toBeInTheDocument();

    await user.click(screen.getByText("close-dialog"));

    expect(screen.queryByTestId("stub-assign-dialog")).not.toBeInTheDocument();
    expect(routerPost).not.toHaveBeenCalled();
  });

  it("klik baris assignee (mode edit) navigasi ke todos.show via router.visit", async () => {
    const user = userEvent.setup({ delay: null });
    usePageMock.mockReturnValue({
      props: {
        assignees: [
          {
            id: 42,
            allocated_to_id: 9,
            name: "Budi",
            type: "task",
            status: "open",
          },
        ],
        auth: { user: { id: 1, name: "Aku" } },
      },
    });

    render(<AssignedTo />);
    await user.click(screen.getByText("Budi"));

    expect(routerVisit).toHaveBeenCalledWith("todos.show/42");
  });

  it("klik tombol hapus (X) pada assignee status open memanggil router.delete", async () => {
    const user = userEvent.setup({ delay: null });
    setUrl("/todos/5");
    usePageMock.mockReturnValue({
      props: {
        assignees: [
          {
            id: 42,
            allocated_to_id: 9,
            name: "Budi",
            type: "task",
            status: "open",
          },
        ],
        auth: { user: { id: 1, name: "Aku" } },
      },
    });

    render(<AssignedTo />);

    // Header (Plus) + baris assignee (nama) + tombol hapus (X) -- ambil
    // button terakhir yang bukan trigger baris (button tanpa accessible name lain).
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(routerDelete).toHaveBeenCalledWith(
      "/todos/5/assignee/42",
      expect.objectContaining({ reset: ["assignees"], preserveState: true }),
    );
  });

  it("assignee berstatus closed/canceled tidak menampilkan tombol hapus", () => {
    usePageMock.mockReturnValue({
      props: {
        assignees: [
          {
            id: 1,
            allocated_to_id: 9,
            name: "Budi",
            type: "task",
            status: "closed",
          },
          {
            id: 2,
            allocated_to_id: 8,
            name: "Citra",
            type: "task",
            status: "canceled",
          },
        ],
        auth: { user: { id: 1, name: "Aku" } },
      },
    });

    render(<AssignedTo />);

    // Tiap baris assignee selalu punya 1 button (baris itu sendiri, utk
    // navigasi) -- tombol hapus (X) HANYA muncul bila status bukan
    // closed/canceled. Header (Plus) + 2 baris = 3 button totalnya, tanpa
    // tombol hapus tambahan.
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("mode create: hapus assignee memperbarui buffered_assignees via setData tanpa router.delete", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: {
        buffered_assignees: [
          {
            id: "buf1",
            allocated_to_id: 3,
            name: "Citra",
            type: "task",
            status: "open",
          },
        ],
      },
      setData,
    });

    render(<AssignedTo />);

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(setData).toHaveBeenCalledWith("buffered_assignees", []);
    expect(routerDelete).not.toHaveBeenCalled();
  });
});
