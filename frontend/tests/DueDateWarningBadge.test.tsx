import { render, screen } from "@testing-library/react";
import DueDateWarningBadge from "../src/components/dashboard/DueDateWarningBadge";

describe("DueDateWarningBadge", () => {
  it("renders the 'At Risk' label", () => {
    render(<DueDateWarningBadge />);
    expect(screen.getByText("At Risk")).toBeInTheDocument();
  });

  it("exposes an accessible explanation via aria-label", () => {
    render(<DueDateWarningBadge />);
    expect(
      screen.getByLabelText("Not enough available time before this task is due")
    ).toBeInTheDocument();
  });

  it("uses the urgent-red color tokens", () => {
    render(<DueDateWarningBadge />);
    const badge = screen.getByText("At Risk");
    expect(badge.className).toContain("text-urgent-red");
    expect(badge.className).toContain("bg-urgent-red-light");
  });
});
