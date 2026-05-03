import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route, MemoryRouter } from "react-router-dom";
import AppLayout from "../src/components/AppLayout";

vi.mock("../src/components/Sidebar", () => ({
  default: ({ onNavigate }: { onNavigate?: () => void }) => (
    <div data-testid="sidebar">
      <button onClick={onNavigate}>nav-link</button>
    </div>
  ),
}));

vi.mock("../src/components/ChatBot", () => ({
  default: () => <div data-testid="chatbot" />,
}));

vi.mock("../src/components/MobileTopBar", () => ({
  default: ({ onOpen }: { onOpen: () => void }) => (
    <button data-testid="mobile-open" onClick={onOpen}>
      open
    </button>
  ),
}));

function renderLayout(initialPath = "/dashboard") {
  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<div data-testid="page">dashboard</div>} />
          <Route path="/classes" element={<div data-testid="page">classes</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppLayout", () => {
  it("renders the sidebar, chatbot, mobile top bar, and the routed page", () => {
    renderLayout("/dashboard");

    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("chatbot")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-open")).toBeInTheDocument();
    expect(screen.getByTestId("page")).toHaveTextContent("dashboard");
  });

  it("opens the mobile drawer (renders the backdrop) when the hamburger is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderLayout("/dashboard");

    expect(container.querySelector(".bg-black\\/50")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("mobile-open"));

    expect(container.querySelector(".bg-black\\/50")).toBeInTheDocument();
  });

  it("closes the drawer when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderLayout("/dashboard");

    await user.click(screen.getByTestId("mobile-open"));
    const backdrop = container.querySelector(".bg-black\\/50") as HTMLElement;
    expect(backdrop).toBeInTheDocument();

    await user.click(backdrop);

    expect(container.querySelector(".bg-black\\/50")).not.toBeInTheDocument();
  });

  it("closes the drawer when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { container } = renderLayout("/dashboard");

    await user.click(screen.getByTestId("mobile-open"));
    expect(container.querySelector(".bg-black\\/50")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector(".bg-black\\/50")).not.toBeInTheDocument();
  });

  it("closes the drawer when sidebar onNavigate fires", async () => {
    const user = userEvent.setup();
    const { container } = renderLayout("/dashboard");

    await user.click(screen.getByTestId("mobile-open"));
    expect(container.querySelector(".bg-black\\/50")).toBeInTheDocument();

    await user.click(screen.getByText("nav-link"));

    expect(container.querySelector(".bg-black\\/50")).not.toBeInTheDocument();
  });

  it("ignores Escape when the drawer is already closed", () => {
    const { container } = renderLayout("/dashboard");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector(".bg-black\\/50")).not.toBeInTheDocument();
  });
});
