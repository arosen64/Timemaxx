import { render, screen } from "@testing-library/react";
import EstimateBadge from "../src/components/dashboard/EstimateBadge";

describe("EstimateBadge", () => {
  it("renders the 'Manual' label when isManual is true", () => {
    render(<EstimateBadge isManual />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
  });

  it("renders the 'AI' label when isManual is false", () => {
    render(<EstimateBadge isManual={false} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.queryByText("Manual")).not.toBeInTheDocument();
  });

  it("uses distinct styling for manual vs AI estimates", () => {
    const { rerender } = render(<EstimateBadge isManual />);
    const manualBadge = screen.getByText("Manual");
    expect(manualBadge.className).toContain("bg-info-bg");

    rerender(<EstimateBadge isManual={false} />);
    const aiBadge = screen.getByText("AI");
    expect(aiBadge.className).toContain("bg-success-light");
  });
});
