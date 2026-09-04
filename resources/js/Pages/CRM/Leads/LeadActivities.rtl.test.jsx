import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

// FormPageContent hanya wrapper tab/collapsible -- disederhanakan jadi <div>
// agar children (baris aktivitas) tetap dirender tanpa perlu Tabs provider
// asli. useFormPageMeta di-stub undefined & FormPageContext dibiarkan context
// React sungguhan supaya FormInput (dipakai apa adanya, TIDAK di-mock, karena
// ringan & memberi label<->id association asli utk query getByLabelText) dan
// useCanUpdate di dalamnya tidak error walau tanpa provider (pola sama dgn
// Finances/Components/AdditionalDiscount.rtl.test.jsx & PaymentSchedule.rtl.test.jsx).
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ title, children }) => (
      <div>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    ),
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// Select (Command+Popover) sudah punya test sendiri di Select.rtl.test.jsx --
// distub jadi <select> asli, meneruskan `id` supaya label FormInput tetap
// ter-asosiasi (pola sama dgn ./Form.rtl.test.jsx & Components/LinkPicker.rtl.test.jsx).
vi.mock("@/Components/Select", () => ({
  default: ({ id, value, onValueChange, options, disabled }) => (
    <select
      id={id}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value || undefined)}
    >
      <option value="" />
      {(options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ),
}));

// DatetimePicker adalah komponen berat (Popover + day-picker calendar) yang
// bukan concern LeadActivities -- distub jadi input text sederhana yang tetap
// memanggil onValueChange (pola sama dgn PaymentSchedule.rtl.test.jsx).
vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ id, value, onValueChange, disabled }) => (
    <input
      id={id}
      type="text"
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value || null)}
    />
  ),
}));

// UserLinkModel membungkus LinkModel (dialog CRUD berat) -- distub jadi
// tombol pilih value tetap (pola sama dgn ./Form.rtl.test.jsx).
vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onValueChange?.({ id: 7, name: "Budi" })}
    >
      assigned-to:{value?.name ?? "none"}
    </button>
  ),
}));

import LeadActivities from "./LeadActivities";

const L = {
  title: "crm.lead_activity.title",
  add: "crm.lead_activity.add",
  type: "crm.lead_activity.columns.type",
  subject: "crm.lead_activity.columns.subject",
  scheduledAt: "crm.lead_activity.columns.scheduled_at",
  status: "crm.lead_activity.columns.status",
  description: "crm.lead_activity.columns.description",
};

// Harness terkontrol -- menyimpan value di state lokal supaya interaksi user
// (ketik/pilih) tereflesikan balik ke prop `value`, sekaligus merekam tiap
// pemanggilan lewat onChangeSpy (pola sama dgn Components/LinkPicker.rtl.test.jsx).
function Harness({ initialValue = [], onChangeSpy, readOnly }) {
  const [value, setValue] = useState(initialValue);
  return (
    <LeadActivities
      value={value}
      readOnly={readOnly}
      onValueChange={(next) => {
        onChangeSpy?.(next);
        setValue(next);
      }}
    />
  );
}

// Trash2 (tombol hapus baris) icon-only tanpa aria-label -- satu-satunya
// tombol dgn accessible name kosong di antara tombol lain (Tambah & mocked
// UserLinkModel yang punya teks). Dipakai utk menemukan tombol hapus per
// baris tanpa bergantung pada testid buatan / class Tailwind yang rapuh.
const getTrashButtons = () =>
  screen.getAllByRole("button").filter((btn) => btn.textContent.trim() === "");

describe("CRM Leads LeadActivities", () => {
  it("merender kosong: tidak ada baris, judul & tombol tambah tampil", () => {
    render(<LeadActivities value={[]} onValueChange={vi.fn()} />);

    expect(screen.getByText(L.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.add })).toBeInTheDocument();
    expect(
      screen.queryAllByLabelText(L.subject, { exact: false }),
    ).toHaveLength(0);
  });

  it("klik tombol tambah menambah 1 aktivitas baru (id 8 karakter, type task, status open)", async () => {
    const user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    await user.click(screen.getByRole("button", { name: L.add }));

    expect(onChangeSpy).toHaveBeenCalledTimes(1);
    const activities = onChangeSpy.mock.calls[0][0];
    expect(activities).toHaveLength(1);
    expect(activities[0]).toEqual(
      expect.objectContaining({ type: "task", status: "open" }),
    );
    expect(activities[0].id).toMatch(/^[A-Za-z0-9]{8}$/);

    // baris baru ikut dirender (subject input muncul).
    expect(screen.getAllByLabelText(L.subject, { exact: false })).toHaveLength(
      1,
    );
  });

  it("mengetik subject memanggil onValueChange dengan field lain tetap sama", async () => {
    const user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[{ id: "a1", type: "task", status: "open", subject: "" }]}
      />,
    );

    const subjectInput = screen.getByLabelText(L.subject, { exact: false });
    await user.type(subjectInput, "Follow up");

    expect(subjectInput).toHaveValue("Follow up");
    const last = onChangeSpy.mock.calls.at(-1)[0];
    expect(last).toEqual([
      expect.objectContaining({
        id: "a1",
        type: "task",
        status: "open",
        subject: "Follow up",
      }),
    ]);
  });

  it("mengubah Select type memanggil onValueChange dengan activities[index].type baru", async () => {
    const user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[
          { id: "a1", type: "task", status: "open", subject: "S" },
        ]}
      />,
    );

    const typeSelect = screen.getByLabelText(L.type, { exact: false });
    await user.selectOptions(typeSelect, "call");

    expect(onChangeSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a1", type: "call", subject: "S" }),
    ]);
  });

  it("mengubah Select status memanggil onValueChange dengan status baru", async () => {
    const user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[
          { id: "a1", type: "task", status: "open", subject: "S" },
        ]}
      />,
    );

    const statusSelect = screen.getByLabelText(L.status, { exact: false });
    await user.selectOptions(statusSelect, "closed");

    expect(onChangeSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a1", status: "closed" }),
    ]);
  });

  it("mengubah scheduled_at (DatetimePicker stub) memanggil onValueChange dengan nilai baru", () => {
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[
          { id: "a1", type: "task", status: "open", subject: "S" },
        ]}
      />,
    );

    const scheduledInput = screen.getByLabelText(L.scheduledAt, {
      exact: false,
    });
    // fireEvent.change (bukan user.type per-karakter) -- stub DatetimePicker
    // menerima string utuh, cukup satu perubahan nilai penuh (pola sama dgn
    // Finances/Components/PaymentSchedule.rtl.test.jsx).
    fireEvent.change(scheduledInput, {
      target: { value: "2026-05-01T10:00" },
    });

    expect(onChangeSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: "a1",
        scheduled_at: "2026-05-01T10:00",
      }),
    ]);
  });

  it("memilih assigned_to (UserLinkModel stub) memanggil onValueChange dengan user terpilih", async () => {
    const user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[
          { id: "a1", type: "task", status: "open", subject: "S" },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /assigned-to/ }));

    expect(onChangeSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: "a1",
        assigned_to: { id: 7, name: "Budi" },
      }),
    ]);
  });

  it("mengetik description (Textarea) memanggil onValueChange dengan description baru", async () => {
    const user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[
          { id: "a1", type: "task", status: "open", subject: "S" },
        ]}
      />,
    );

    const descTextarea = screen.getByLabelText(L.description, {
      exact: false,
    });
    await user.type(descTextarea, "Catatan");

    expect(descTextarea).toHaveValue("Catatan");
    expect(onChangeSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a1", description: "Catatan" }),
    ]);
  });

  it("klik tombol hapus menghapus baris yang sesuai, baris lain tetap", async () => {
    const user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[
          { id: "a1", type: "task", status: "open", subject: "First" },
          { id: "a2", type: "call", status: "closed", subject: "Second" },
        ]}
      />,
    );

    const trashButtons = getTrashButtons();
    expect(trashButtons).toHaveLength(2);
    await user.click(trashButtons[0]);

    expect(onChangeSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a2", subject: "Second" }),
    ]);
    expect(screen.getAllByLabelText(L.subject, { exact: false })).toHaveLength(
      1,
    );
    expect(screen.getByLabelText(L.subject, { exact: false })).toHaveValue(
      "Second",
    );
  });

  it("banyak baris: mengedit baris kedua tidak mengubah baris pertama", async () => {
    const _user = userEvent.setup({ delay: null });
    const onChangeSpy = vi.fn();
    render(
      <Harness
        onChangeSpy={onChangeSpy}
        initialValue={[
          { id: "a1", type: "task", status: "open", subject: "Row1" },
          { id: "a2", type: "call", status: "closed", subject: "Row2" },
        ]}
      />,
    );

    const subjectInputs = screen.getAllByLabelText(L.subject, {
      exact: false,
    });
    expect(subjectInputs).toHaveLength(2);
    fireEvent.change(subjectInputs[1], { target: { value: "Row2 edited" } });

    expect(onChangeSpy).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "a1", subject: "Row1" }),
      expect.objectContaining({ id: "a2", subject: "Row2 edited" }),
    ]);
  });

  it("readOnly=true: tombol tambah & hapus tidak dirender, semua field disabled", () => {
    render(
      <LeadActivities
        value={[{ id: "a1", type: "task", status: "open", subject: "S" }]}
        onValueChange={vi.fn()}
        readOnly={true}
      />,
    );

    expect(
      screen.queryByRole("button", { name: L.add }),
    ).not.toBeInTheDocument();
    expect(getTrashButtons()).toHaveLength(0);

    expect(screen.getByLabelText(L.type, { exact: false })).toBeDisabled();
    expect(screen.getByLabelText(L.subject, { exact: false })).toBeDisabled();
    expect(
      screen.getByLabelText(L.scheduledAt, { exact: false }),
    ).toBeDisabled();
    expect(screen.getByLabelText(L.status, { exact: false })).toBeDisabled();
    expect(
      screen.getByLabelText(L.description, { exact: false }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /assigned-to/ })).toBeDisabled();
  });
});
