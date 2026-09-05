import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Checkbox, FormCheckbox } from "./checkbox";
import { TooltipProvider } from "./tooltip";
import { FormPageContext } from "@/Pages/Core/FormPage";

const renderWithTooltip = (ui) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe("Checkbox", () => {
  it("render tanpa crash dengan role 'forminput' (dioverride dari role 'checkbox' default Radix)", () => {
    render(<Checkbox />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.tagName).toBe("BUTTON");
  });

  it("default unchecked: data-state='unchecked', aria-checked='false'", () => {
    render(<Checkbox checked={false} />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("checked=true: data-state='checked', aria-checked='true'", () => {
    render(<Checkbox checked={true} />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toHaveAttribute("data-state", "checked");
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("checked='indeterminate': data-state='indeterminate', aria-checked='mixed'", () => {
    render(<Checkbox checked="indeterminate" />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toHaveAttribute("data-state", "indeterminate");
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
  });

  it("menggabungkan className custom dengan className default (bukan menggantikan)", () => {
    render(<Checkbox className="custom-class" />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox.className).toContain("custom-class");
    expect(checkbox.className).toContain("border-primary");
  });

  it("readOnly=true menambahkan className literal 'pointer-events-none'", () => {
    render(<Checkbox readOnly />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox.className.split(/\s+/)).toContain("pointer-events-none");
  });

  it("tanpa prop readOnly, className 'pointer-events-none' TIDAK ditambahkan", () => {
    render(<Checkbox />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox.className.split(/\s+/)).not.toContain(
      "pointer-events-none",
    );
  });

  it("prop readOnly TIDAK ikut ter-spread sebagai atribut DOM (bukan atribut valid pada <button>)", () => {
    render(<Checkbox readOnly />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).not.toHaveAttribute("readonly");
  });

  it("forwardRef meneruskan ref ke elemen <button> asli", () => {
    const ref = createRef();
    render(<Checkbox ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("forminput"));
    expect(ref.current.tagName).toBe("BUTTON");
  });

  it("klik memicu onCheckedChange dengan nilai toggle yang benar", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("forminput"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("disabled=true mencegah interaksi klik memicu onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Checkbox checked={false} disabled onCheckedChange={onCheckedChange} />,
    );
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("meneruskan props lain (aria-label, data-testid) ke elemen asli", () => {
    render(<Checkbox aria-label="Setuju" data-testid="my-checkbox" />);
    const checkbox = screen.getByTestId("my-checkbox");
    expect(checkbox).toHaveAttribute("aria-label", "Setuju");
  });

  it("render icon Check & MinusIcon di dalam indicator dengan className toggle group-data per state", () => {
    const { container } = render(<Checkbox checked />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    expect(svgs[0].getAttribute("class")).toContain(
      "group-data-[state=checked]:block",
    );
    expect(svgs[1].getAttribute("class")).toContain(
      "group-data-[state=indeterminate]:block",
    );
  });
});

describe("FormCheckbox", () => {
  it("render dengan label string -- id checkbox otomatis (useId) sama dengan htmlFor pada <label>", () => {
    render(<FormCheckbox label="Setuju" />);
    const checkbox = screen.getByRole("forminput");
    const label = screen.getByText("Setuju").closest("label");
    expect(checkbox.id).toBeTruthy();
    expect(label).toHaveAttribute("for", checkbox.id);
  });

  it("prop id custom dipakai sbg id checkbox & htmlFor label (bukan id otomatis)", () => {
    render(<FormCheckbox id="custom-id" label="Setuju" />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toHaveAttribute("id", "custom-id");
    expect(screen.getByText("Setuju").closest("label")).toHaveAttribute(
      "for",
      "custom-id",
    );
  });

  it("description dirender sbg teks tambahan & container memakai className items-start", () => {
    const { container } = render(
      <FormCheckbox label="Setuju" description="Keterangan tambahan" />,
    );
    expect(screen.getByText("Keterangan tambahan")).toBeInTheDocument();
    expect(container.firstChild.className).toContain("items-start");
    expect(container.firstChild.className).not.toContain("items-center");
  });

  it("tanpa description, container memakai className items-center", () => {
    const { container } = render(<FormCheckbox label="Setuju" />);
    expect(container.firstChild.className).toContain("items-center");
  });

  it("prop children (string) menggantikan prop label (precedence)", () => {
    render(<FormCheckbox label="Label lama">Label baru</FormCheckbox>);
    expect(screen.getByText("Label baru")).toBeInTheDocument();
    expect(screen.queryByText("Label lama")).not.toBeInTheDocument();
  });

  it("children berupa elemen JSX (bukan string/number) -- TIDAK dibungkus elemen <label>, dirender apa adanya", () => {
    render(
      <FormCheckbox label="Label string">
        <span data-testid="custom-label">Custom Node</span>
      </FormCheckbox>,
    );
    const customLabel = screen.getByTestId("custom-label");
    expect(customLabel).toBeInTheDocument();
    expect(customLabel.closest("label")).toBeNull();
  });

  it("klik pada checkbox memicu onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <FormCheckbox
        label="Setuju"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );
    await user.click(screen.getByRole("forminput"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("checked tidak diberikan -> checkbox default unchecked (checked ?? false)", () => {
    render(<FormCheckbox label="Setuju" />);
    expect(screen.getByRole("forminput")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  });

  it("valueBefore sama dengan checked -> TIDAK dianggap changed, className diff TIDAK ditambahkan", () => {
    renderWithTooltip(
      <FormCheckbox label="Setuju" checked={true} valueBefore={true} />,
    );
    const checkbox = screen.getByRole("forminput");
    expect(checkbox.className).not.toContain("bg-yellow-200");
  });

  it("valueBefore berbeda dari checked -> dianggap changed, checkbox mendapat className diff highlight (bg-yellow-200 dark:bg-yellow-900)", () => {
    renderWithTooltip(
      <FormCheckbox label="Setuju" checked={false} valueBefore={true} />,
    );
    const checkbox = screen.getByRole("forminput");
    expect(checkbox.className).toContain("bg-yellow-200");
    expect(checkbox.className).toContain("dark:bg-yellow-900");
  });

  it("valueBefore tidak diberikan sama sekali (undefined) -> TIDAK pernah dianggap changed walau checked truthy", () => {
    render(<FormCheckbox label="Setuju" checked={true} />);
    const checkbox = screen.getByRole("forminput");
    expect(checkbox.className).not.toContain("bg-yellow-200");
  });

  it("classNameCheckbox diteruskan ke elemen checkbox", () => {
    render(
      <FormCheckbox label="Setuju" classNameCheckbox="custom-checkbox-cls" />,
    );
    expect(screen.getByRole("forminput").className).toContain(
      "custom-checkbox-cls",
    );
  });

  it("className diteruskan ke container div terluar", () => {
    const { container } = render(
      <FormCheckbox label="Setuju" className="my-container-cls" />,
    );
    expect(container.firstChild.className).toContain("my-container-cls");
  });

  it("classNameLabel diteruskan hingga ke elemen <label>", () => {
    render(<FormCheckbox label="Setuju" classNameLabel="my-label-cls" />);
    const label = screen.getByText("Setuju").closest("label");
    expect(label.className).toContain("my-label-cls");
  });

  it("forwardRef diteruskan hingga ke elemen <button> checkbox asli", () => {
    const ref = createRef();
    render(<FormCheckbox ref={ref} label="Setuju" />);
    expect(ref.current).toBe(screen.getByRole("forminput"));
  });

  it("props tambahan (mis. disabled) diteruskan ke Checkbox internal", () => {
    render(<FormCheckbox label="Setuju" disabled />);
    expect(screen.getByRole("forminput")).toBeDisabled();
  });

  it("tanpa context FormPage & tanpa prop readOnly -> checkbox TIDAK mendapat className pointer-events-none", () => {
    render(<FormCheckbox label="Setuju" />);
    expect(screen.getByRole("forminput").className.split(/\s+/)).not.toContain(
      "pointer-events-none",
    );
  });

  it("disabled=true dari useFormPage() context (walau prop readOnly tidak diberikan) membuat checkbox pointer-events-none", () => {
    render(
      <FormPageContext.Provider value={{ disabled: true }}>
        <FormCheckbox label="Setuju" />
      </FormPageContext.Provider>,
    );
    expect(screen.getByRole("forminput").className.split(/\s+/)).toContain(
      "pointer-events-none",
    );
  });

  it("prop readOnly=true tetap membuat checkbox pointer-events-none walau context disabled=false", () => {
    render(
      <FormPageContext.Provider value={{ disabled: false }}>
        <FormCheckbox label="Setuju" readOnly />
      </FormPageContext.Provider>,
    );
    expect(screen.getByRole("forminput").className.split(/\s+/)).toContain(
      "pointer-events-none",
    );
  });
});
