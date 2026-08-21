import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Settings/Countries) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate derivation dari !country, dan
// primaryKey="code" statis (country pakai code sebagai primary key, bukan id).

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

describe("Show (Settings/Countries)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show country={{ code: "ID" }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat country tidak ada", () => {
    render(<Show country={null} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: true, primaryKey: "code" }),
    );
  });

  it("isCreate false saat country ada, primaryKey tetap 'code'", () => {
    render(<Show country={{ code: "ID" }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: false, primaryKey: "code" }),
    );
  });
});
