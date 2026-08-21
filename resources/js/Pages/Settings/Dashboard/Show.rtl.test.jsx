import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Settings/Dashboard) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate dari !dashboard, ignoreDraft &
// defaultValues diteruskan dari defaultData.

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, ignoreDraft, defaultValues, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({
          isCreate: !!isCreate,
          ignoreDraft: !!ignoreDraft,
          defaultValues: defaultValues ?? null,
        })}
      </div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

describe("Show (Settings/Dashboard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show dashboard={{ id: 1 }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat dashboard tidak ada", () => {
    render(<Show dashboard={null} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":true',
    );
  });

  it("isCreate false saat dashboard ada", () => {
    render(<Show dashboard={{ id: 1 }} />);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":false',
    );
  });

  it("ignoreDraft dan defaultValues diteruskan dari defaultData", () => {
    render(
      <Show dashboard={null} defaultData={{ name: "Dashboard Baru" }} />,
    );

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({
        isCreate: true,
        ignoreDraft: true,
        defaultValues: { name: "Dashboard Baru" },
      }),
    );
  });
});
