import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerVisit = vi.fn();
const routerPrefetch = vi.fn();
vi.mock("@inertiajs/core", async () => {
  const actual = await vi.importActual("@inertiajs/core");
  return {
    ...actual,
    router: {
      visit: (...a) => routerVisit(...a),
      prefetch: (...a) => routerPrefetch(...a),
    },
  };
});

import Link from "./Link";
import { useIsDirtyForm } from "@/Hooks/useIsDirtyForm";

describe("Link", () => {
  beforeEach(() => {
    routerVisit.mockReset();
    routerPrefetch.mockReset();
    useIsDirtyForm.setState({
      isDirty: false,
      showAlert: false,
      keepDraftOnClean: {},
    });
    vi.useRealTimers();
  });

  it("default as='a' merender <a> dengan href", () => {
    render(<Link href="/dashboard">Dashboard</Link>);
    expect(screen.getByText("Dashboard").tagName).toBe("A");
    expect(screen.getByText("Dashboard")).toHaveAttribute("href", "/dashboard");
  });

  it("method!=='get' otomatis merender <button>, bukan <a>", () => {
    render(
      <Link href="/logout" method="post">
        Logout
      </Link>,
    );
    expect(screen.getByText("Logout").tagName).toBe("BUTTON");
    expect(screen.getByText("Logout")).not.toHaveAttribute("href");
  });

  it("as='button' eksplisit merender <button> walau method='get'", () => {
    render(
      <Link href="/x" as="button">
        Klik
      </Link>,
    );
    expect(screen.getByText("Klik").tagName).toBe("BUTTON");
  });

  it("klik link (form tidak dirty) langsung memanggil router.visit", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Link href="/dashboard">Dashboard</Link>);

    await user.click(screen.getByText("Dashboard"));

    expect(routerVisit).toHaveBeenCalledWith(
      "/dashboard",
      expect.objectContaining({ method: "get" }),
    );
  });

  it("klik link saat form dirty menunda visit dan menampilkan alert (bukan langsung visit)", async () => {
    const user = userEvent.setup({ delay: null });
    useIsDirtyForm.setState({ isDirty: true });

    render(<Link href="/dashboard">Dashboard</Link>);
    await user.click(screen.getByText("Dashboard"));

    // onVisit membaca isDirty & setShowAlert dari useIsDirtyForm (bukan
    // useAlertDraftForm -- itu store terpisah utk alert "lanjutkan draft").
    expect(routerVisit).not.toHaveBeenCalled();
    expect(useIsDirtyForm.getState().showAlert).toBe(true);
  });

  it("onClick custom tetap dipanggil sebelum intercept diproses", async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();
    render(
      <Link href="/dashboard" onClick={onClick}>
        Dashboard
      </Link>,
    );

    await user.click(screen.getByText("Dashboard"));

    expect(onClick).toHaveBeenCalled();
  });

  it("prefetch='hover' memicu router.prefetch setelah hover", async () => {
    vi.useFakeTimers();
    render(
      <Link href="/dashboard" prefetch>
        Dashboard
      </Link>,
    );

    const link = screen.getByText("Dashboard");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.mouseEnter(link);
    vi.advanceTimersByTime(75);

    expect(routerPrefetch).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("data-loading muncul hanya selama request in-flight (onStart..onFinish)", async () => {
    routerVisit.mockImplementation((_href, params) => {
      params.onStart?.({});
    });
    const user = userEvent.setup({ delay: null });
    render(<Link href="/dashboard">Dashboard</Link>);

    await user.click(screen.getByText("Dashboard"));

    expect(screen.getByText("Dashboard")).toHaveAttribute("data-loading", "");
  });
});
