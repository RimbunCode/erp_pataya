import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...a) => toastError(...a) },
}));

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: () => {
      const [data, setDataState] = React.useState(formPageSeed);
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return { data, setData };
    },
    FormPageContent: ({ title, children }) => (
      <div data-testid={`form-page-content-${title ?? "untitled"}`}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

// FormNewRule adalah dialog imperative (ruleRef.current.open()) -- stub
// sebagai tombol yang langsung memanggil onApply dengan payload rule.
// onAddPermission (Form.jsx) baca rule.model/rule.level/rule.only_creator --
// default level=0, only_creator=false di sini (bisa dioverride per test).
let nextRule = { model: null, level: 0, only_creator: false };
vi.mock("./FormNewRule", () => ({
  default: ({ onApply }) => (
    <button
      type="button"
      data-testid="stub-form-new-rule"
      onClick={() => onApply(nextRule)}
    >
      add-rule
    </button>
  ),
}));

import Form from "./Form";

const submitableModel = {
  id: 1,
  module: "Sales",
  name: "SalesOrder",
  is_submitable: true,
  allow_only_creator: true,
  permissions: ["select", "read", "write"],
};

const nonSubmitableModel = {
  id: 2,
  module: "Inventory",
  name: "Item",
  is_submitable: false,
  permissions: ["select", "read", "write", "create", "delete", "import"],
};

// Section "general" (is_disabled) juga merender checkbox role="forminput"
// SEBELUM section permission_manager -- scope query ke section permission
// manager saja agar index checkbox tidak tergeser oleh is_disabled.
const getPermissionCheckboxes = () =>
  within(
    screen.getByTestId("form-page-content-user.role.permission_manager"),
  ).getAllByRole("forminput");

describe("Roles Form", () => {
  beforeEach(() => {
    formPageSeed = { rules: [] };
    toastError.mockReset();
    nextRule = { model: null, level: 0, only_creator: false };
  });

  it("mengetik name/description memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { rules: [], name: "" };
    render(<Form />);

    const nameInput = screen
      .getByTestId("forminput-name")
      .querySelector("input");
    await user.type(nameInput, "Editor");

    expect(nameInput).toHaveValue("Editor");
  });

  it("tanpa rules menampilkan 'No rules found'", () => {
    render(<Form />);
    expect(screen.getByText("No rules found")).toBeInTheDocument();
  });

  it("menambah rule submitable (level>0): permissionKeys hanya read+write, level dari rule.level", async () => {
    const user = userEvent.setup({ delay: null });
    nextRule = { model: submitableModel, level: 2, only_creator: true };
    render(<Form />);

    await user.click(screen.getByTestId("stub-form-new-rule"));

    expect(screen.getByText("SalesOrder")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // rule.level ditampilkan
    // Submitable (level>0): permissionKeys hanya read+write -> 1 "all" + 2 key.
    expect(getPermissionCheckboxes()).toHaveLength(3);
  });

  it("menambah rule non-submitable: permissionKeys dari model.permissions penuh", async () => {
    const user = userEvent.setup({ delay: null });
    nextRule = { model: nonSubmitableModel, level: 0, only_creator: false };
    render(<Form />);

    await user.click(screen.getByTestId("stub-form-new-rule"));

    // 6 permission key (select/read/write/create/delete/import) + 1 checkbox "all".
    expect(getPermissionCheckboxes()).toHaveLength(7);
  });

  it("menambah rule duplikat (permission_id+level+only_creator sama) menampilkan toast error, tidak menambah rule baru", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: { select: false },
          permissionKeys: ["select"],
        },
      ],
    };
    nextRule = { model: nonSubmitableModel, level: 0, only_creator: false };
    render(<Form />);

    await user.click(screen.getByTestId("stub-form-new-rule"));

    expect(toastError).toHaveBeenCalledWith(
      "user.role.errors.alert_already_exists",
    );
    // Tetap 1 rule (tidak bertambah).
    expect(screen.getAllByText("Item")).toHaveLength(1);
  });

  it("toggle 'all' checkbox mengaktifkan semua permission rule tsb (toggleAllPermissions)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: { select: false, read: false, write: false },
          permissionKeys: ["select", "read", "write"],
        },
      ],
    };
    render(<Form />);

    // checkboxes[0] = "all" (tri-state dari getCheckState).
    await user.click(getPermissionCheckboxes()[0]);

    getPermissionCheckboxes()
      .slice(1)
      .forEach((cb) => {
        expect(cb).toHaveAttribute("data-state", "checked");
      });
  });

  it("checkbox 'select'=false mereset SEMUA flag lain jadi false (RULE 1)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: { select: true, read: true, write: true },
          permissionKeys: ["select", "read", "write"],
        },
      ],
    };
    render(<Form />);

    // index: 0=all, 1=select, 2=read, 3=write.
    await user.click(getPermissionCheckboxes()[1]);

    const after = getPermissionCheckboxes();
    expect(after[1]).toHaveAttribute("data-state", "unchecked");
    expect(after[2]).toHaveAttribute("data-state", "unchecked"); // read
    expect(after[3]).toHaveAttribute("data-state", "unchecked"); // write
  });

  it("checkbox 'read'=false mereset write & (level 0) create/delete/dst jadi false, select TETAP apa adanya (RULE 2)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: {
            select: true,
            read: true,
            write: true,
            create: true,
          },
          permissionKeys: ["select", "read", "write", "create"],
        },
      ],
    };
    render(<Form />);

    // index: 0=all, 1=select, 2=read, 3=write, 4=create
    await user.click(getPermissionCheckboxes()[2]);

    const after = getPermissionCheckboxes();
    expect(after[1]).toHaveAttribute("data-state", "checked"); // select tetap
    expect(after[2]).toHaveAttribute("data-state", "unchecked"); // read
    expect(after[3]).toHaveAttribute("data-state", "unchecked"); // write
    expect(after[4]).toHaveAttribute("data-state", "unchecked"); // create
  });

  it("checkbox selain read/select yang di-true-kan otomatis mengaktifkan read & select (RULE 3)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: {
            select: false,
            read: false,
            write: false,
          },
          permissionKeys: ["select", "read", "write"],
        },
      ],
    };
    render(<Form />);

    // index: 0=all, 1=select, 2=read, 3=write
    await user.click(getPermissionCheckboxes()[3]); // aktifkan "write"

    const after = getPermissionCheckboxes();
    expect(after[3]).toHaveAttribute("data-state", "checked");
    expect(after[2]).toHaveAttribute("data-state", "checked"); // read ikut true
    expect(after[1]).toHaveAttribute("data-state", "checked"); // select ikut true
  });

  it("checkbox 'import'=true otomatis mengaktifkan 'create' juga (RULE 3 khusus import)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: {
            select: false,
            read: false,
            create: false,
            import: false,
          },
          permissionKeys: ["select", "read", "create", "import"],
        },
      ],
    };
    render(<Form />);

    // index: 0=all, 1=select, 2=read, 3=create, 4=import
    await user.click(getPermissionCheckboxes()[4]); // aktifkan "import"

    const after = getPermissionCheckboxes();
    expect(after[4]).toHaveAttribute("data-state", "checked");
    expect(after[3]).toHaveAttribute("data-state", "checked"); // create ikut true
  });

  it("checkbox 'read'=true otomatis mengaktifkan 'select' (RULE 4)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: { select: false, read: false },
          permissionKeys: ["select", "read"],
        },
      ],
    };
    render(<Form />);

    await user.click(getPermissionCheckboxes()[2]); // read

    expect(getPermissionCheckboxes()[1]).toHaveAttribute(
      "data-state",
      "checked",
    ); // select
  });

  it("klik tombol hapus rule menghapus rule dari data.rules", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      rules: [
        {
          id: "r1",
          permission_id: 2,
          module: "Inventory",
          name: "Item",
          level: 0,
          only_creator: false,
          permission: nonSubmitableModel,
          permissions: { select: true },
          permissionKeys: ["select"],
        },
      ],
    };
    render(<Form />);

    expect(screen.getByText("Item")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "" }));

    expect(screen.queryByText("Item")).not.toBeInTheDocument();
    expect(screen.getByText("No rules found")).toBeInTheDocument();
  });
});
