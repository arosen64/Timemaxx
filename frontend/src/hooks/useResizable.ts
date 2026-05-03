import { useEffect, useRef, useState } from "react";

type ResizeDirection = "nw" | "n" | "ne" | "w" | "sw";

export function useResizable() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const moveHandlerRef = useRef<((ev: MouseEvent) => void) | null>(null);
  const upHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (moveHandlerRef.current) document.removeEventListener("mousemove", moveHandlerRef.current);
      if (upHandlerRef.current) document.removeEventListener("mouseup", upHandlerRef.current);
    };
  }, []);

  function reset() {
    setSize(null);
  }

  function startResize(e: React.MouseEvent, dir: ResizeDirection) {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;

    const startWidth = el.offsetWidth;
    const startHeight = el.offsetHeight;
    const startX = e.clientX;
    const startY = e.clientY;
    const maxW = window.innerWidth - 48;
    const maxH = window.innerHeight - 48;

    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      // Box is anchored bottom-right: leftward drag grows width, upward drag grows height
      if (dir.includes("w")) newWidth = Math.min(maxW, Math.max(0, startWidth - dx));
      if (dir.includes("n")) newHeight = Math.min(maxH, Math.max(0, startHeight - dy));
      setSize({ width: newWidth, height: newHeight });
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      moveHandlerRef.current = null;
      upHandlerRef.current = null;
    }

    moveHandlerRef.current = onMouseMove;
    upHandlerRef.current = onMouseUp;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  return { containerRef, size, startResize, reset };
}
