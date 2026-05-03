import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./utils";
import MobileTopBar from "../src/components/MobileTopBar";

describe("MobileTopBar", () => {
  it("renders a hamburger button with an accessible label", () => {
    renderWithProviders(<MobileTopBar onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: /open navigation menu/i })).toBeInTheDocument();
  });

  it("calls onOpen when the hamburger button is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderWithProviders(<MobileTopBar onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: /open navigation menu/i }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders a Timemaxx wordmark linking to the dashboard", () => {
    renderWithProviders(<MobileTopBar onOpen={vi.fn()} />);
    const link = screen.getByRole("link", { name: /timemaxx/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/dashboard");
  });
});
