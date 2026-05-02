import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./utils";
import Sidebar from "../src/components/Sidebar";

vi.mock("../../backend/convex/_generated/api", () => ({
  api: {
    queries: {
      users: { getCurrUser: "getCurrUser" },
      studyBlocks: { getAllStudyBlocksWithTasks: "getAllStudyBlocksWithTasks" },
    },
  },
}));

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

function withQueries({
  user,
  blocks,
}: {
  user?: { name?: string; email?: string; image?: string | null } | null;
  blocks?: Array<{ isConflicted?: boolean }>;
}) {
  mockUseQuery.mockImplementation((key: string) => {
    if (key === "getCurrUser") return user;
    if (key === "getAllStudyBlocksWithTasks") return blocks;
    return undefined;
  });
}

describe("Sidebar", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("renders all primary navigation links", () => {
    withQueries({ user: { name: "Alex", email: "a@example.com" }, blocks: [] });
    renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /classes/i })).toHaveAttribute("href", "/classes");
    expect(screen.getByRole("link", { name: /schedule/i })).toHaveAttribute("href", "/schedule");
    expect(screen.getByRole("link", { name: /preferences/i })).toHaveAttribute(
      "href",
      "/preferences"
    );
  });

  it("renders the user's name and email when the user query has resolved", () => {
    withQueries({ user: { name: "Alex Doe", email: "alex@example.com" }, blocks: [] });
    renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(screen.getByText("Alex Doe")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
  });

  it("shows a skeleton placeholder while the user query is loading", () => {
    withQueries({ user: undefined, blocks: [] });
    const { container } = renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("falls back to the user's first initial when no profile image is set", () => {
    withQueries({ user: { name: "Riley", email: "r@x.com", image: null }, blocks: [] });
    renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(screen.getByText("R")).toBeInTheDocument();
  });

  it("shows '?' when the user has no name and no image", () => {
    withQueries({ user: { email: "noone@example.com" }, blocks: [] });
    renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders the conflict badge on Schedule when any block is conflicted", () => {
    withQueries({
      user: { name: "Riley", email: "r@x.com" },
      blocks: [{ isConflicted: false }, { isConflicted: true }],
    });
    const { container } = renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(container.querySelector(".bg-urgent-red")).toBeInTheDocument();
  });

  it("does not render the conflict badge when no block is conflicted", () => {
    withQueries({
      user: { name: "Riley", email: "r@x.com" },
      blocks: [{ isConflicted: false }],
    });
    const { container } = renderWithProviders(<Sidebar />, { initialEntries: ["/dashboard"] });

    expect(container.querySelector(".bg-urgent-red")).not.toBeInTheDocument();
  });

  it("calls onNavigate when a nav link is clicked", async () => {
    withQueries({ user: { name: "Alex", email: "a@x.com" }, blocks: [] });
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Sidebar onNavigate={onNavigate} />, { initialEntries: ["/dashboard"] });

    await user.click(screen.getByRole("link", { name: /classes/i }));

    expect(onNavigate).toHaveBeenCalled();
  });
});
