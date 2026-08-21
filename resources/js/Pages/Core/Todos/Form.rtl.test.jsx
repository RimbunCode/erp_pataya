import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, id) => `${name}/${id}`;

const formTransform = vi.fn();
const formPut = vi.fn();
let formPageSeed = {};
let formPageErrors = {};
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: (defaultValue) => {
      const [data, setDataState] = React.useState({
        ...defaultValue,
        ...formPageSeed,
      });
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return {
        data,
        setData,
        errors: formPageErrors,
        form: { transform: formTransform, put: formPut },
      };
    },
    FormPageContent: ({ children }) => <div>{children}</div>,
  };
});

vi.mock("./AssignedToFields", () => ({
  default: ({ value, onChange }) => (
    <div data-testid="assigned-to-fields">
      allocated_to:{value?.allocated_to?.name ?? "none"}
      <button
        type="button"
        onClick={() => onChange({ allocated_to: { id: 1, name: "Budi" } })}
      >
        change-allocated-to
      </button>
    </div>
  ),
}));

import Form from "./Form";

describe("Core Todos Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    formPageErrors = {};
    formTransform.mockReset();
    formPut.mockReset();
  });

  it("AssignedToFields menerima data dan meneruskan perubahan via setData", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Form />);

    await user.click(screen.getByText("change-allocated-to"));

    expect(screen.getByTestId("assigned-to-fields")).toHaveTextContent(
      "allocated_to:Budi",
    );
  });

  it("dialog konfirmasi TIDAK terbuka saat tidak ada error allocated_to", () => {
    formPageErrors = {};
    render(<Form />);

    expect(
      screen.queryByText("core.todo.confirm.reassign_to_self"),
    ).not.toBeInTheDocument();
  });

  it("dialog konfirmasi TIDAK terbuka untuk error allocated_to yang berbeda pesan", () => {
    formPageErrors = { allocated_to: "Some other validation error" };
    render(<Form />);

    expect(
      screen.queryByText("core.todo.confirm.reassign_to_self_description"),
    ).not.toBeInTheDocument();
  });

  it("dialog konfirmasi terbuka saat error allocated_to cocok dengan pesan reassign_to_self", () => {
    formPageErrors = {
      allocated_to: "core.todo.confirm.reassign_to_self",
    };
    render(<Form />);

    expect(
      screen.getByText("core.todo.confirm.reassign_to_self_description"),
    ).toBeInTheDocument();
  });

  it("klik submit pada dialog memanggil form.transform dan form.put ke todos.update", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { id: 42 };
    formPageErrors = {
      allocated_to: "core.todo.confirm.reassign_to_self",
    };
    render(<Form />);

    await user.click(
      screen.getByRole("button", { name: "core.form.submit" }),
    );

    expect(formTransform).toHaveBeenCalled();
    // Verifikasi transformer menyisipkan confirm_reassign: true.
    const transformer = formTransform.mock.calls[0][0];
    expect(transformer({ foo: "bar" })).toEqual({
      foo: "bar",
      confirm_reassign: true,
    });
    expect(formPut).toHaveBeenCalledWith("todos.update/42");
  });

  it("klik cancel pada dialog menutup dialog tanpa memanggil form.put", async () => {
    const user = userEvent.setup({ delay: null });
    formPageErrors = {
      allocated_to: "core.todo.confirm.reassign_to_self",
    };
    render(<Form />);

    await user.click(
      screen.getByRole("button", { name: "core.form.cancel" }),
    );

    expect(formPut).not.toHaveBeenCalled();
  });
});
