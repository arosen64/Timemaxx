import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toggle from "../src/components/ui/Toggle";

const OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

describe("Toggle", () => {
  it("renders one button per option", () => {
    render(<Toggle options={[...OPTIONS]} value="day" onChange={vi.fn()} />);
    OPTIONS.forEach((opt) => {
      expect(screen.getByRole("button", { name: opt.label })).toBeInTheDocument();
    });
  });

  it("highlights the active option with the navy background", () => {
    render(<Toggle options={[...OPTIONS]} value="week" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Week" })).toHaveClass("bg-navy");
    expect(screen.getByRole("button", { name: "Day" })).not.toHaveClass("bg-navy");
  });

  it("calls onChange with the option's value when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle options={[...OPTIONS]} value="day" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Month" }));

    expect(onChange).toHaveBeenCalledWith("month");
  });

  it("still fires onChange when the active option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle options={[...OPTIONS]} value="day" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Day" }));

    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("renders nothing besides the buttons when given an empty options list", () => {
    const { container } = render(<Toggle options={[]} value="day" onChange={vi.fn()} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
