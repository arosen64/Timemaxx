import { render, screen } from "@testing-library/react";
import WeightBadge from "../src/components/dashboard/WeightBadge";

describe("WeightBadge", () => {
  it("renders nothing when weight is undefined", () => {
    const { container } = render(<WeightBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the integer weight as a percentage", () => {
    render(<WeightBadge weight={25} />);
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("rounds fractional weights", () => {
    render(<WeightBadge weight={33.4} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("clamps weights above 100", () => {
    render(<WeightBadge weight={200} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("clamps negative weights to 0", () => {
    render(<WeightBadge weight={-10} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("exposes the weight via aria-label for assistive tech", () => {
    render(<WeightBadge weight={42} />);
    expect(screen.getByLabelText("Assignment weight: 42%")).toBeInTheDocument();
  });

  it("renders 0 for an explicit zero weight (not undefined)", () => {
    render(<WeightBadge weight={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
