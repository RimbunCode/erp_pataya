import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ModuleSettingsPage from "./ModuleSettingsPage";

const putMock = vi.fn();
let formState = {
  data: {},
  setData: vi.fn(),
  put: putMock,
  processing: false,
  isDirty: false,
  errors: {},
};

vi.mock("@inertiajs/react", async (importOriginal) => ({
  ...(await importOriginal()),
  Head: ({ title }) => <title>{title}</title>,
  useForm: (initial) => ({
    ...formState,
    data: formState.data || initial,
  }),
  usePage: () => ({
    props: {
      auth: { user: { id: "01TEST" } },
      flash: {},
      preferences: {},
    },
  }),
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children, className }) => (
    <div data-testid="app-layout" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ModuleSettingsPage RTL Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.route = vi.fn(
      (name) => `http://localhost/${name.replace(/\./g, "/")}`,
    );
    formState = {
      data: { field_a: "val_a" },
      setData: vi.fn(),
      put: putMock,
      processing: false,
      isDirty: false,
      errors: {},
    };
  });

  it("renders page title and save button in write mode", () => {
    render(
      <ModuleSettingsPage
        title="Finance Settings"
        name="finances"
        canWrite={true}
        setting={{ field_a: "val_a" }}
      >
        <div>Content Children</div>
      </ModuleSettingsPage>,
    );

    expect(screen.getByText("Finance Settings")).toBeInTheDocument();
    expect(screen.getByTestId("save-button")).toBeInTheDocument();
    expect(screen.queryByTestId("readonly-badge")).toBeNull();
    expect(screen.getByText("Content Children")).toBeInTheDocument();
  });

  it("hides save button and displays read-only badge when canWrite is false", () => {
    render(
      <ModuleSettingsPage
        title="Sales Settings"
        name="sales"
        canWrite={false}
        setting={{}}
      >
        <div>Read-Only Content</div>
      </ModuleSettingsPage>,
    );

    expect(screen.queryByTestId("save-button")).toBeNull();
    expect(screen.getByTestId("readonly-badge")).toBeInTheDocument();
  });

  it("displays unsaved changes badge when form is dirty", () => {
    formState.isDirty = true;

    render(
      <ModuleSettingsPage
        title="Finance Settings"
        name="finances"
        canWrite={true}
        setting={{}}
      >
        <div>Content</div>
      </ModuleSettingsPage>,
    );

    expect(screen.getByTestId("unsaved-badge")).toBeInTheDocument();
  });

  it("calls form put on save submit", () => {
    render(
      <ModuleSettingsPage
        title="Finance Settings"
        name="finances"
        canWrite={true}
        setting={{}}
      >
        <div>Content</div>
      </ModuleSettingsPage>,
    );

    fireEvent.click(screen.getByTestId("save-button"));
    expect(putMock).toHaveBeenCalledTimes(1);
  });
});
