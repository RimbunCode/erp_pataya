import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => key;
let mockLoading = false;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT, loading: mockLoading }),
}));

// FormCheckbox (dipakai untuk "remember me") memanggil useFormPage() secara
// internal. Modul asli @/Pages/Core/FormPage menyeret banyak import berat
// (AppLayout, dst) yang tidak relevan untuk halaman Login -- stub minimal
// mengikuti pola Pages/Core/Todos/Form.rtl.test.jsx.
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => ({ disabled: false }),
}));

// GuestLayout & ToggleTheme adalah dependency layout yang tidak terkait bug
// yang diuji (FormCheckbox label dibungkus Fragment) -- stub passthrough
// mengikuti pola Layouts/GuestLayout.rtl.test.jsx yang men-stub MasterLayout.
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/Components/ToggleTheme", () => ({
  default: () => <div data-testid="toggle-theme-stub" />,
}));

const useFormMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  Head: () => null,
  useForm: (...args) => useFormMock(...args),
}));

window.route = (name) => name;

import Login from "./Login";

function setupUseForm(overrides = {}) {
  const setData = vi.fn();
  const post = vi.fn();
  const reset = vi.fn();
  useFormMock.mockReturnValue({
    data: {
      usernameOrEmail: "",
      password: "",
      remember: false,
      ...overrides,
    },
    setData,
    post,
    processing: false,
    reset,
  });
  return { setData, post, reset };
}

describe("Auth Login", () => {
  beforeEach(() => {
    mockLoading = false;
    useFormMock.mockReset();
    setupUseForm();
  });

  it("tidak memicu console.error 'Invalid prop'/React.Fragment saat render (regresi label FormCheckbox dibungkus Fragment)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Login errors={{}} />);

    const hasFragmentPropError = errorSpy.mock.calls.some((callArgs) =>
      callArgs.some(
        (arg) =>
          typeof arg === "string" &&
          (arg.includes("Invalid prop") || arg.includes("React.Fragment")),
      ),
    );
    expect(hasFragmentPropError).toBe(false);

    errorSpy.mockRestore();
  });

  it("checkbox remember tetap ter-render dengan label & bisa dicentang", async () => {
    const user = userEvent.setup({ delay: null });
    const { setData } = setupUseForm();
    render(<Login errors={{}} />);

    const checkbox = screen.getByRole("forminput", {
      name: "auth.login.remember",
    });
    expect(checkbox).toBeInTheDocument();

    await user.click(checkbox);

    expect(setData).toHaveBeenCalledWith("remember", true);
  });
});
