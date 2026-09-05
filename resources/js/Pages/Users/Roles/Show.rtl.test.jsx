import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Users/Roles) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate derivation dari !role, dan
// fieldNameTrans="user.role.columns" statis.

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, fieldNameTrans, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, fieldNameTrans })}
      </div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

describe("Show (Users/Roles)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show role={{ id: 1 }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true dan fieldNameTrans 'user.role.columns' saat role tidak ada", () => {
    render(<Show role={null} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: true, fieldNameTrans: "user.role.columns" }),
    );
  });

  it("isCreate false saat role ada", () => {
    render(<Show role={{ id: 1 }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: false, fieldNameTrans: "user.role.columns" }),
    );
  });
});
