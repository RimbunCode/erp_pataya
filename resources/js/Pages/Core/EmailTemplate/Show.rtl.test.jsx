import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Show.jsx (Core/EmailTemplate) thin wrapper <FormPage><Form/></FormPage>.
// Logic yang diverifikasi: isCreate dari !emailTemplate, ignoreDraft dari
// usePage().props.loadFrom.

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, ignoreDraft, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, ignoreDraft: !!ignoreDraft })}
      </div>
      {children}
    </div>
  ),
}));

import Show from "./Show";

function renderShow(emailTemplate, loadFrom) {
  usePageMock.mockReturnValue({ props: { loadFrom } });
  return render(<Show emailTemplate={emailTemplate} />);
}

describe("Show (Core/EmailTemplate)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    renderShow({ id: 1 });

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  it("isCreate true saat emailTemplate tidak ada", () => {
    renderShow(null);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":true',
    );
  });

  it("isCreate false saat emailTemplate ada", () => {
    renderShow({ id: 1 });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"isCreate":false',
    );
  });

  it("ignoreDraft diteruskan dari usePage().props.loadFrom", () => {
    renderShow({ id: 1 }, { id: 5 });

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"ignoreDraft":true',
    );
  });

  it("ignoreDraft false saat loadFrom tidak ada", () => {
    renderShow({ id: 1 }, undefined);

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      '"ignoreDraft":false',
    );
  });
});
