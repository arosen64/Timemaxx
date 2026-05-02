import { renderHook, act, fireEvent } from "@testing-library/react";
import { useResizable } from "../src/hooks/useResizable";

function attachContainer(ref: React.RefObject<HTMLDivElement>, width: number, height: number) {
  const div = document.createElement("div");
  Object.defineProperty(div, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(div, "offsetHeight", { value: height, configurable: true });
  // Simulate React assigning the ref to a real element.
  (ref as { current: HTMLDivElement | null }).current = div;
}

describe("useResizable", () => {
  it("returns null size before any resize happens", () => {
    const { result } = renderHook(() => useResizable());
    expect(result.current.size).toBeNull();
  });

  it("does nothing when startResize is called without a container ref", () => {
    const { result } = renderHook(() => useResizable());
    const event = new MouseEvent("mousedown", { clientX: 0, clientY: 0 });
    Object.assign(event, { preventDefault: vi.fn() });

    act(() => {
      result.current.startResize(event as unknown as React.MouseEvent, "nw");
    });

    expect(result.current.size).toBeNull();
  });

  it("updates size as the mouse moves with a 'w' direction (grows leftward)", () => {
    const { result } = renderHook(() => useResizable());
    attachContainer(result.current.containerRef, 300, 200);

    const startEvent = {
      preventDefault: vi.fn(),
      clientX: 500,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.startResize(startEvent, "w");
    });

    act(() => {
      // Drag 50px to the left → width grows by 50
      fireEvent.mouseMove(document, { clientX: 450, clientY: 100 });
    });

    expect(result.current.size).toEqual({ width: 350, height: 200 });
  });

  it("updates size as the mouse moves with an 'n' direction (grows upward)", () => {
    const { result } = renderHook(() => useResizable());
    attachContainer(result.current.containerRef, 300, 200);

    act(() => {
      result.current.startResize(
        { preventDefault: vi.fn(), clientX: 0, clientY: 500 } as unknown as React.MouseEvent,
        "n"
      );
    });

    act(() => {
      // Drag 30px up → height grows by 30
      fireEvent.mouseMove(document, { clientX: 0, clientY: 470 });
    });

    expect(result.current.size).toEqual({ width: 300, height: 230 });
  });

  it("clamps size to viewport minus 48px", () => {
    Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });

    const { result } = renderHook(() => useResizable());
    attachContainer(result.current.containerRef, 300, 200);

    act(() => {
      result.current.startResize(
        { preventDefault: vi.fn(), clientX: 1000, clientY: 1000 } as unknown as React.MouseEvent,
        "nw"
      );
    });

    act(() => {
      fireEvent.mouseMove(document, { clientX: 0, clientY: 0 });
    });

    expect(result.current.size?.width).toBe(800 - 48);
    expect(result.current.size?.height).toBe(600 - 48);
  });

  it("clamps size to a minimum of 0", () => {
    const { result } = renderHook(() => useResizable());
    attachContainer(result.current.containerRef, 100, 100);

    act(() => {
      result.current.startResize(
        { preventDefault: vi.fn(), clientX: 0, clientY: 0 } as unknown as React.MouseEvent,
        "nw"
      );
    });

    act(() => {
      fireEvent.mouseMove(document, { clientX: 1000, clientY: 1000 });
    });

    expect(result.current.size).toEqual({ width: 0, height: 0 });
  });

  it("reset() clears the stored size", () => {
    const { result } = renderHook(() => useResizable());
    attachContainer(result.current.containerRef, 300, 200);

    act(() => {
      result.current.startResize(
        { preventDefault: vi.fn(), clientX: 100, clientY: 100 } as unknown as React.MouseEvent,
        "w"
      );
    });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 90, clientY: 100 });
    });
    expect(result.current.size).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.size).toBeNull();
  });

  it("stops listening to mouse moves after mouse up", () => {
    const { result } = renderHook(() => useResizable());
    attachContainer(result.current.containerRef, 300, 200);

    act(() => {
      result.current.startResize(
        { preventDefault: vi.fn(), clientX: 100, clientY: 100 } as unknown as React.MouseEvent,
        "w"
      );
    });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 90, clientY: 100 });
    });
    const sizeAfterFirstMove = result.current.size;

    act(() => {
      fireEvent.mouseUp(document);
    });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 50, clientY: 100 });
    });

    expect(result.current.size).toEqual(sizeAfterFirstMove);
  });
});
