import { fireEvent, render, screen } from "@testing-library/react";
import DueTimeField from "../src/components/DueTimeField";

describe("DueTimeField", () => {
  it("renders a label associated with a time input", () => {
    render(
      <DueTimeField
        variant="modal"
        id="due-time"
        label="Due time"
        value="09:30"
        onChange={vi.fn()}
      />
    );
    const input = screen.getByLabelText("Due time") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("time");
    expect(input.value).toBe("09:30");
  });

  it("calls onChange with the new time when the value is changed", () => {
    const onChange = vi.fn();
    render(
      <DueTimeField variant="modal" id="due-time" label="Due time" value="" onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText("Due time"), { target: { value: "14:45" } });

    expect(onChange).toHaveBeenCalledWith("14:45");
  });

  it("invokes onValueChange in addition to onChange when provided", () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <DueTimeField
        variant="compact"
        id="due-time-compact"
        label="Time"
        value=""
        onChange={onChange}
        onValueChange={onValueChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "08:00" } });

    expect(onChange).toHaveBeenCalledWith("08:00");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("does not call a missing onValueChange (no crash when omitted)", () => {
    const onChange = vi.fn();
    render(
      <DueTimeField
        variant="compact"
        id="due-time-compact"
        label="Time"
        value=""
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "08:00" } });

    expect(onChange).toHaveBeenCalledWith("08:00");
  });

  it("uses different layout classes for modal vs compact variants", () => {
    const { container: modalContainer } = render(
      <DueTimeField variant="modal" id="modal-id" label="Modal" value="" onChange={vi.fn()} />
    );
    const modalInput = modalContainer.querySelector("input")!;
    expect(modalInput.className).toContain("h-11");

    const { container: compactContainer } = render(
      <DueTimeField variant="compact" id="compact-id" label="Compact" value="" onChange={vi.fn()} />
    );
    const compactInput = compactContainer.querySelector("input")!;
    expect(compactInput.className).toContain("h-8");
  });
});
