import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// FormPageDiff sudah ditest sendiri (FormPageDiff.rtl.test.jsx) -- stub di
// sini, cukup ekspos title & children untuk verifikasi ShowLog meneruskannya.
vi.mock("./FormPage", () => ({
  FormPageDiff: ({ title, disabled, children }) => (
    <div
      data-testid="stub-form-page-diff"
      data-title={title}
      data-disabled={disabled}
    >
      {children}
    </div>
  ),
}));

import ShowLog from "./ShowLog";

describe("ShowLog", () => {
  it("formPathname yang tidak ditemukan menampilkan pesan 'Form tidak ditemukan'", () => {
    render(<ShowLog title="Log Judul" formPathname="Pages/TidakAda/Form" />);
    expect(screen.getByText("Form tidak ditemukan")).toBeInTheDocument();
  });

  it("meneruskan title dan disabled=true ke FormPageDiff", () => {
    render(<ShowLog title="Log Judul" formPathname="Pages/TidakAda/Form" />);
    const stub = screen.getByTestId("stub-form-page-diff");
    expect(stub).toHaveAttribute("data-title", "Log Judul");
    expect(stub).toHaveAttribute("data-disabled", "true");
  });

  // Skenario formPathname valid (lazy-load komponen Form asli via
  // import.meta.glob) sengaja tidak ditest render penuhnya di sini --
  // komponen Form target butuh rantai dependency (usePage/useForm/dst) yang
  // tidak relevan dengan tanggung jawab ShowLog sendiri (resolusi path +
  // Suspense fallback), dan membuatnya rapuh/lambat tanpa nilai tambah nyata.
});
