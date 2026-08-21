import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Settings/Currencies) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate derivation dari !currency, dan
// primaryKey="code" statis (currency pakai code sebagai primary key).

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, primaryKey, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, primaryKey })}
      </div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

describe("Show (Settings/Currencies)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show currency={{ code: "IDR" }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat currency tidak ada", () => {
    render(<Show currency={null} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: true, primaryKey: "code" }),
    );
  });

  it("isCreate false saat currency ada, primaryKey tetap 'code'", () => {
    render(<Show currency={{ code: "IDR" }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: false, primaryKey: "code" }),
    );
  });
});
