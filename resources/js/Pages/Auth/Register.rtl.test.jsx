import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";

// Fokus test: memastikan Label field "Nama" htmlFor="name" (bukan
// "username" -- copy-paste leftover dari Label Username persis di
// bawahnya), sehingga getByLabelText("Nama") resolve ke <input id="name">
// dan bukan ke <input id="username"> (regresi WCAG label-for-input).
const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT, loading: false }),
}));

// GuestLayout membungkus MasterLayout + usePage + route("company-logo")
// yang tidak relevan untuk perilaku Label/Input Register sendiri -- stub
// jadi passthrough (pola sama dgn AppLayout stub di FormPage.rtl.test.jsx).
vi.mock("@/Layouts/GuestLayout", () => ({
  default: ({ children }) => (
    <div data-testid="stub-guest-layout">{children}</div>
  ),
}));

function makeFakeUseForm(seed) {
  return function useFormFake() {
    const [data, setDataState] = useState(seed);
    const setData = (key, value) => {
      setDataState((prev) => ({ ...prev, [key]: value }));
    };
    return {
      data,
      setData,
      errors: {},
      processing: false,
      reset: () => {},
      post: vi.fn(),
    };
  };
}

vi.mock("@inertiajs/react", () => ({
  useForm: (seed) => makeFakeUseForm(seed)(),
  Head: ({ title }) => <title>{title}</title>,
}));

window.route = (name) => name;

import Register from "./Register";

describe("Register — Label htmlFor field Nama & Username", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getByLabelText(\'auth.register.name\') resolve ke <input id="name">, BUKAN id="username"', () => {
    render(<Register />);

    const nameInput = screen.getByLabelText("auth.register.name");
    expect(nameInput).toHaveAttribute("id", "name");
    expect(nameInput).not.toHaveAttribute("id", "username");
  });

  it("getByLabelText('auth.register.username') tetap resolve ke <input id=\"username\"> (regresi)", () => {
    render(<Register />);

    const usernameInput = screen.getByLabelText("auth.register.username");
    expect(usernameInput).toHaveAttribute("id", "username");
  });

  it("input Nama & Username adalah elemen yang BERBEDA (bukan sama-sama resolve ke satu input)", () => {
    render(<Register />);

    const nameInput = screen.getByLabelText("auth.register.name");
    const usernameInput = screen.getByLabelText("auth.register.username");
    expect(nameInput).not.toBe(usernameInput);
  });
});
