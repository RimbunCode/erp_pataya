import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// AssignedToFields adalah form kompleks (banyak field, Select berbasis
// Popover/Command) dengan test-nya sendiri -- stub di sini agar test
// AssignDialog fokus ke wrapper: dialog title, cancel, submit, reset value
// saat initialValue berubah. Pola sama seperti FilterTable2.rtl.test.jsx
// men-stub FilterBuilderBody.
const assignedToFieldsProps = vi.fn();
vi.mock("@/Pages/Core/Todos/AssignedToFields", () => ({
  default: (props) => {
    assignedToFieldsProps(props);
    return <div data-testid="stub-assigned-to-fields" />;
  },
}));

import { Dialog } from "@/Components/ui/dialog";
import AssignDialog from "./AssignDialog";

// AssignDialog hanya me-render <DialogContent> (bukan <Dialog> root), jadi
// dibungkus <Dialog open> manual saat test -- sama seperti pemakaian nyata
// di AssignedTo.jsx.
const renderDialog = (props) =>
  render(
    <Dialog open>
      <AssignDialog {...props} />
    </Dialog>,
  );

describe("AssignDialog", () => {
  beforeEach(() => {
    assignedToFieldsProps.mockClear();
  });

  it("menampilkan judul dialog dan tombol cancel/assign", () => {
    renderDialog({ initialValue: null, onSubmit: vi.fn(), onClose: vi.fn() });

    expect(screen.getByText("TR:core.form.assigned_to")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TR:core.form.cancel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TR:core.form.assign" }),
    ).toBeInTheDocument();
  });

  it("tanpa initialValue, AssignedToFields menerima DEFAULT_VALUE", () => {
    renderDialog({ initialValue: null, onSubmit: vi.fn(), onClose: vi.fn() });

    expect(assignedToFieldsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        value: expect.objectContaining({
          allocated_to: null,
          type: "task",
          priority: "medium",
        }),
        layout: "grid",
        disableStatus: true,
      }),
    );
  });

  it("dengan initialValue, AssignedToFields menerima value tersebut", () => {
    const initialValue = {
      allocated_to: { id: 5, name: "User A" },
      type: "event",
      priority: "high",
      date: null,
      due_date: null,
      reminder_lead_days: [],
      description: "desk",
    };
    renderDialog({ initialValue, onSubmit: vi.fn(), onClose: vi.fn() });

    expect(assignedToFieldsProps).toHaveBeenCalledWith(
      expect.objectContaining({ value: initialValue }),
    );
  });

  it("activeAssigneeIds dikecualikan dari allocated_to milik value saat ini", () => {
    const initialValue = {
      allocated_to: { id: 5, name: "User A" },
      type: "task",
      priority: "medium",
      date: null,
      due_date: null,
      reminder_lead_days: [],
      description: null,
    };
    renderDialog({
      initialValue,
      activeAssigneeIds: [5, 6, 7],
      onSubmit: vi.fn(),
      onClose: vi.fn(),
    });

    // id 5 (allocated_to saat ini) tidak boleh ikut dikecualikan dari daftar
    // pilihan assignee -- kalau tidak, user tidak bisa reassign ke diri
    // sendiri semula.
    expect(assignedToFieldsProps).toHaveBeenCalledWith(
      expect.objectContaining({ excludeAssigneeIds: [6, 7] }),
    );
  });

  it("klik cancel memanggil onClose", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    renderDialog({ initialValue: null, onSubmit: vi.fn(), onClose });

    await user.click(
      screen.getByRole("button", { name: "TR:core.form.cancel" }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("klik assign memanggil onSubmit dengan value saat ini", async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    const initialValue = {
      allocated_to: { id: 5, name: "User A" },
      type: "meeting",
      priority: "low",
      date: null,
      due_date: null,
      reminder_lead_days: [],
      description: null,
    };
    renderDialog({ initialValue, onSubmit, onClose: vi.fn() });

    await user.click(
      screen.getByRole("button", { name: "TR:core.form.assign" }),
    );

    expect(onSubmit).toHaveBeenCalledWith(initialValue);
  });

  it("onChange dari AssignedToFields memperbarui value yang dikirim ke onSubmit", async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    renderDialog({ initialValue: null, onSubmit, onClose: vi.fn() });

    const { onChange } = assignedToFieldsProps.mock.calls.at(-1)[0];
    act(() => {
      onChange("priority", "high");
    });

    await user.click(
      screen.getByRole("button", { name: "TR:core.form.assign" }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "high" }),
    );
  });

  it("value direset saat initialValue berubah (rerender)", () => {
    const initialA = {
      allocated_to: null,
      type: "task",
      priority: "medium",
      date: null,
      due_date: null,
      reminder_lead_days: [],
      description: null,
    };
    const initialB = { ...initialA, type: "deadline", priority: "high" };

    const { rerender } = render(
      <Dialog open>
        <AssignDialog
          initialValue={initialA}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      </Dialog>,
    );
    expect(assignedToFieldsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: initialA }),
    );

    rerender(
      <Dialog open>
        <AssignDialog
          initialValue={initialB}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      </Dialog>,
    );

    expect(assignedToFieldsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: initialB }),
    );
  });
});
