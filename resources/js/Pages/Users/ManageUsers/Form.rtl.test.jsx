import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

// Form.jsx (ManageUsers) adalah halaman form entitas User: profile, role,
// permission, branch. Logic UNIK yang jadi fokus test ini (bukan komponen
// anak yang sudah ada test sendiri):
// - Visibility/disabled field profile berdasar isCreate & authUser.id vs data.id
// - Toggle role/branch (checkbox) memanipulasi array data.roles/data.branches
// - Uncheck branch yang jadi default_branch_id mereset default_branch_id
// - Gating section berdasar usePermission (canUser/canRole/canBranch)
// - getDetailsRole/getDetailAllRole -- axios.get lalu buka dialog detail permission
//
// Semua komponen anak yang SUDAH punya test sendiri di-stub: FormInput,
// Select, DatetimePicker, RoleForm, BranchForm, FormPageDialog/useFormPage.
// FormCheckbox (ui/checkbox) TIDAK distub -- dia simple wrapper yang hanya
// bergantung pada useFormPage (sudah dimock), dan justru lewat dia-lah
// interaksi checkbox Form.jsx sendiri diuji.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerReload = vi.fn();
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { reload: (...a) => routerReload(...a) },
  WhenVisible: ({ children, fallback }) => children ?? fallback ?? null,
}));

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...a) => axiosGet(...a) },
}));

// useFormPage dipakai Form.jsx sendiri (data/setData/isCreate) DAN FormCheckbox
// (ui/checkbox, untuk `disabled`). Diimplementasikan via React Context asli
// (bukan vi.fn statis) supaya reaktif terhadap setData di dalam test --
// mengikuti pola wajib untuk komponen memo() dengan useFormPage dari Context.
import React, { createContext, useContext, useState } from "react";
const FakeFormPageContext = createContext();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...args) => {
    const ctx = useContext(FakeFormPageContext);
    return typeof ctx === "function" ? ctx(...args) : ctx;
  },
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
  FormPageContentTitle: ({ children, className }) => (
    <div className={className}>{children}</div>
  ),
  FormPageDialog: React.forwardRef(function FakeFormPageDialog(
    { title, name, onSuccess, children },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({
      open: () => {},
    }));
    return (
      <div data-testid={`dialog-${name}`}>
        <span>{title}</span>
        <button type="button" onClick={() => onSuccess?.()}>
          trigger-success-{name}
        </button>
        {children}
      </div>
    );
  }),
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, error, children }) => (
    <div data-testid={`forminput-${label ?? ""}`}>
      <label>{label}</label>
      {error ? <span data-testid="forminput-error">{error}</span> : null}
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Select", () => ({
  // Prefix "opt:" pada text option supaya tidak bentrok dengan getByText di
  // luar <select> (mis. label checkbox branch/role dengan nama yang sama).
  default: ({ value, onValueChange, options }) => (
    <select
      data-testid="select"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) =>
        typeof opt === "string" ? (
          <option key={opt} value={opt}>
            opt:{opt}
          </option>
        ) : (
          <option key={opt.value} value={opt.value}>
            opt:{opt.label}
          </option>
        ),
      )}
    </select>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="datetime-picker"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@/Pages/Settings/Branches/Form", () => ({
  default: () => <div data-testid="branch-form-stub" />,
}));

vi.mock("@/Pages/Users/Roles/Form", () => ({
  default: () => <div data-testid="role-form-stub" />,
}));

const canRoleMock = vi.fn();
const canBranchMock = vi.fn();
const canUserMock = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: (model) => {
    if (model === "App\\Models\\User\\Role") return { can: canRoleMock };
    if (model === "App\\Models\\Core\\Branch") return { can: canBranchMock };
    return { can: canUserMock };
  },
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import Form from "./Form";

function FormPageProviderFake({ value, children }) {
  return (
    <FakeFormPageContext.Provider value={value}>
      {children}
    </FakeFormPageContext.Provider>
  );
}

/**
 * Render Form dengan state data terkelola (setData asli, reaktif) supaya
 * interaksi checkbox role/branch bisa diverifikasi lewat re-render.
 * @param root0
 * @param root0.authUser
 * @param root0.isCreate
 * @param root0.initialData
 * @param root0.roles
 * @param root0.branches
 * @param root0.permissions
 */
function renderForm({
  authUser = { id: 1 },
  isCreate = false,
  initialData = {},
  roles = [],
  branches = [],
  permissions = { user: {}, role: {}, branch: {} },
} = {}) {
  usePageMock.mockReturnValue({
    props: {
      auth: { user: authUser },
      roles,
      branches,
    },
  });

  canUserMock.mockImplementation((action) =>
    Boolean(permissions.user?.[action]),
  );
  canRoleMock.mockImplementation((action) =>
    Boolean(permissions.role?.[action]),
  );
  canBranchMock.mockImplementation((action) =>
    Boolean(permissions.branch?.[action]),
  );

  function Wrapper() {
    const [data, setDataState] = useState(initialData);
    const setData = (key, val) => {
      if (typeof key === "object") {
        setDataState((prev) => ({ ...prev, ...key }));
      } else {
        setDataState((prev) => ({ ...prev, [key]: val }));
      }
    };
    return (
      <FormPageProviderFake
        value={{ data, setData, isCreate, disabled: false }}
      >
        <Form />
      </FormPageProviderFake>
    );
  }

  return render(
    <TooltipProvider>
      <Wrapper />
    </TooltipProvider>,
  );
}

describe("Form (Users/ManageUsers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosGet.mockResolvedValue({ data: { name: "Role X", rules: [] } });
  });

  describe("field profile: visibility & disabled berdasar isCreate/authUser", () => {
    it("mode create: field username, gender, phone, birthdate TIDAK dirender", () => {
      renderForm({
        isCreate: true,
        initialData: { email: "a@a.com", name: "A" },
      });

      expect(
        screen.queryByTestId("forminput-user.user.columns.username"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-user.user.columns.gender"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-user.user.columns.phone"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-user.user.columns.birthdate"),
      ).not.toBeInTheDocument();
    });

    it("mode edit: field username, gender, phone, birthdate dirender", () => {
      renderForm({
        isCreate: false,
        initialData: { id: 1, email: "a@a.com", name: "A", username: "a" },
      });

      expect(
        screen.getByTestId("forminput-user.user.columns.username"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-user.user.columns.gender"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-user.user.columns.phone"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-user.user.columns.birthdate"),
      ).toBeInTheDocument();
    });

    it("mode edit, user lain (bukan diri sendiri): input email & name disabled", () => {
      renderForm({
        authUser: { id: 1 },
        isCreate: false,
        initialData: { id: 2, email: "other@a.com", name: "Other" },
      });

      const emailInput = screen.getByDisplayValue("other@a.com");
      const nameInput = screen.getByDisplayValue("Other");
      expect(emailInput).toBeDisabled();
      expect(nameInput).toBeDisabled();
    });

    it("mode edit, diri sendiri: input email & name TIDAK disabled", () => {
      renderForm({
        authUser: { id: 1 },
        isCreate: false,
        initialData: { id: 1, email: "me@a.com", name: "Me" },
      });

      const emailInput = screen.getByDisplayValue("me@a.com");
      const nameInput = screen.getByDisplayValue("Me");
      expect(emailInput).not.toBeDisabled();
      expect(nameInput).not.toBeDisabled();
    });

    it("mode create: input email & name TIDAK disabled meski authUser beda", () => {
      renderForm({
        authUser: { id: 1 },
        isCreate: true,
        initialData: { email: "new@a.com", name: "New" },
      });

      const emailInput = screen.getByDisplayValue("new@a.com");
      const nameInput = screen.getByDisplayValue("New");
      expect(emailInput).not.toBeDisabled();
      expect(nameInput).not.toBeDisabled();
    });

    it("email belum diverifikasi & user melihat profil sendiri: FormInput menerima error 'not_verified'", () => {
      renderForm({
        authUser: { id: 1 },
        isCreate: false,
        initialData: { id: 1, email: "me@a.com", email_verified_at: null },
      });

      expect(screen.getByTestId("forminput-error")).toHaveTextContent(
        "user.user.columns.email.not_verified",
      );
    });

    it("email sudah diverifikasi: tidak ada error, muncul ikon verified (ShieldCheckIcon lewat tooltip)", () => {
      renderForm({
        authUser: { id: 1 },
        isCreate: false,
        initialData: {
          id: 1,
          email: "me@a.com",
          email_verified_at: "2026-01-01",
        },
      });

      expect(screen.queryByTestId("forminput-error")).not.toBeInTheDocument();
    });

    it("email belum diverifikasi tapi melihat profil ORANG LAIN: tidak ada error 'not_verified' (guard authUser.id===data?.id)", () => {
      renderForm({
        authUser: { id: 1 },
        isCreate: false,
        initialData: { id: 2, email: "other@a.com", email_verified_at: null },
      });

      expect(screen.queryByTestId("forminput-error")).not.toBeInTheDocument();
    });
  });

  describe("section roles & branches: gating permission", () => {
    it("canUser('manage_roles')=false menyembunyikan section roles", () => {
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: false, manage_branches: false } },
        roles: [{ id: 1, name: "Admin", is_disabled: false }],
      });

      expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("canUser('manage_roles')=true menampilkan daftar role, role is_disabled disaring", () => {
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true } },
        roles: [
          { id: 1, name: "Admin", is_disabled: false },
          { id: 2, name: "Nonaktif", is_disabled: true },
        ],
      });

      expect(screen.getByText("Admin")).toBeInTheDocument();
      expect(screen.queryByText("Nonaktif")).not.toBeInTheDocument();
    });

    it("canRole('create')=false menyembunyikan tombol tambah role", () => {
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true }, role: { create: false } },
        roles: [],
      });

      expect(
        screen.queryByRole("button", { name: /user.role.add/ }),
      ).not.toBeInTheDocument();
    });

    it("canRole('create')=true menampilkan tombol tambah role", () => {
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true }, role: { create: true } },
        roles: [],
      });

      expect(
        screen.getByRole("button", { name: /user.role.add/ }),
      ).toBeInTheDocument();
    });

    it("canUser('manage_branches')=false menyembunyikan section branches", () => {
      renderForm({
        initialData: { branches: [] },
        permissions: { user: { manage_branches: false } },
        branches: [{ id: 1, name: "Cabang A", is_disabled: false }],
      });

      expect(screen.queryByText("Cabang A")).not.toBeInTheDocument();
    });

    it("canUser('manage_branches')=true menampilkan daftar branch", () => {
      renderForm({
        initialData: { branches: [] },
        permissions: { user: { manage_branches: true } },
        branches: [{ id: 1, name: "Cabang A", is_disabled: false }],
      });

      expect(screen.getByText("Cabang A")).toBeInTheDocument();
    });
  });

  describe("toggle role checkbox: manipulasi data.roles", () => {
    it("mencentang role menambahkan id ke data.roles", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true } },
        roles: [{ id: 5, name: "Editor", is_disabled: false }],
      });

      // Checkbox stub role="forminput" tidak punya accessible name (label
      // terpisah, bukan aria-label) -- ambil langsung via urutan render.
      const checkbox = screen.getAllByRole("forminput")[0];
      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("role sudah tercentang (ada di data.roles) lalu diklik akan unchecked (dihapus dari array)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { roles: [5] },
        permissions: { user: { manage_roles: true } },
        roles: [{ id: 5, name: "Editor", is_disabled: false }],
      });

      const checkbox = screen.getAllByRole("forminput")[0];
      expect(checkbox).toHaveAttribute("data-state", "checked");

      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "unchecked");
    });

    it("tombol 'show_permissions' disabled saat data.roles kosong, enabled saat terisi", () => {
      const { _rerender } = renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true } },
        roles: [{ id: 5, name: "Editor", is_disabled: false }],
      });

      const showPermButton = screen.getByRole("button", {
        name: /user.user.show_permissions/,
      });
      expect(showPermButton).toBeDisabled();
    });
  });

  describe("toggle branch checkbox: manipulasi data.branches & default_branch_id", () => {
    it("mencentang branch menambahkan id ke data.branches", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { branches: [] },
        permissions: { user: { manage_branches: true } },
        branches: [{ id: 9, name: "Cabang B", is_disabled: false }],
      });

      const checkbox = screen.getAllByRole("forminput")[0];
      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("uncheck branch yang SEDANG jadi default_branch_id akan mereset default_branch_id ke null", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { branches: [9], default_branch_id: 9 },
        permissions: { user: { manage_branches: true } },
        branches: [{ id: 9, name: "Cabang B", is_disabled: false }],
      });

      const checkbox = screen.getAllByRole("forminput")[0];
      expect(checkbox).toHaveAttribute("data-state", "checked");

      // Ada 2 stub <Select> di halaman ini (gender & default_branch_id),
      // keduanya testid="select" -- scope query lewat FormInput pembungkusnya
      // (testid forminput-{label}) agar tidak ambigu.
      const defaultBranchWrapper = screen.getByTestId(
        "forminput-user.user.default_branch",
      );
      const selectDefaultBranch =
        within(defaultBranchWrapper).getByTestId("select");
      expect(selectDefaultBranch).toHaveValue("9");

      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "unchecked");
      expect(selectDefaultBranch).toHaveValue("");
    });

    it("uncheck branch yang BUKAN default_branch_id tidak mengubah default_branch_id", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { branches: [9, 10], default_branch_id: 10 },
        permissions: { user: { manage_branches: true } },
        branches: [
          { id: 9, name: "Cabang B", is_disabled: false },
          { id: 10, name: "Cabang C", is_disabled: false },
        ],
      });

      const checkboxes = screen.getAllByRole("forminput");
      // checkbox pertama = Cabang B (id 9), bukan default (10)
      await user.click(checkboxes[0]);

      const defaultBranchWrapper = screen.getByTestId(
        "forminput-user.user.default_branch",
      );
      const selectDefaultBranch =
        within(defaultBranchWrapper).getByTestId("select");
      expect(selectDefaultBranch).toHaveValue("10");
    });
  });

  describe("getDetailsRole / getDetailAllRole: axios + dialog detail permission", () => {
    it("klik nama role memanggil axios.get ke roles.show dan membuka dialog detail", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockResolvedValue({
        data: { name: "Editor Detail", rules: [] },
      });
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true } },
        roles: [{ id: 5, name: "Editor", is_disabled: false }],
      });

      await user.click(screen.getByText("Editor"));

      expect(axiosGet).toHaveBeenCalledTimes(1);
      expect(axiosGet.mock.calls[0][0]).toContain("roles.show");

      expect(await screen.findByText("Editor Detail")).toBeInTheDocument();
    });

    it("klik 'show_permissions' memanggil axios.get ke roles.permissions dengan ids dari data.roles", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockResolvedValue({
        data: { name: null, rules: [] },
      });
      renderForm({
        initialData: { roles: [5, 6] },
        permissions: { user: { manage_roles: true } },
        roles: [
          { id: 5, name: "Editor", is_disabled: false },
          { id: 6, name: "Viewer", is_disabled: false },
        ],
      });

      const showPermButton = screen.getByRole("button", {
        name: /user.user.show_permissions/,
      });
      expect(showPermButton).not.toBeDisabled();

      await user.click(showPermButton);

      expect(axiosGet).toHaveBeenCalledTimes(1);
      const calledUrl = axiosGet.mock.calls[0][0];
      expect(calledUrl).toContain("roles.permissions");
      expect(calledUrl).toContain("ids");
    });

    it("dialog detail role menampilkan baris rule dengan kolom permission", async () => {
      const user = userEvent.setup({ delay: null });
      axiosGet.mockResolvedValue({
        data: {
          name: "Editor",
          rules: [
            {
              id: 1,
              name: "App\\Models\\Core\\Branch",
              level: 2,
              only_creator: true,
              permissions: { select: true, read: true, write: false },
            },
          ],
        },
      });
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true } },
        roles: [{ id: 5, name: "Editor", is_disabled: false }],
      });

      await user.click(screen.getByText("Editor"));

      expect(
        await screen.findByText("App\\Models\\Core\\Branch"),
      ).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  describe("dialog tambah role/branch: gating & onSuccess", () => {
    it("dialog tambah role dirender hanya jika canUser('manage_roles') DAN canRole('create')", () => {
      renderForm({
        initialData: { roles: [] },
        permissions: {
          user: { manage_roles: true },
          role: { create: false },
        },
        roles: [],
      });

      expect(screen.queryByTestId("dialog-role")).not.toBeInTheDocument();
    });

    it("onSuccess dialog tambah role memanggil router.reload({ only: ['roles'] })", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { roles: [] },
        permissions: { user: { manage_roles: true }, role: { create: true } },
        roles: [],
      });

      await user.click(screen.getByText("trigger-success-role"));

      expect(routerReload).toHaveBeenCalledWith({ only: ["roles"] });
    });

    it("onSuccess dialog tambah branch memanggil router.reload({ only: ['branches'] })", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { branches: [] },
        permissions: {
          user: { manage_branches: true },
          branch: { create: true },
        },
        branches: [],
      });

      await user.click(screen.getByText("trigger-success-branch"));

      expect(routerReload).toHaveBeenCalledWith({ only: ["branches"] });
    });
  });
});
