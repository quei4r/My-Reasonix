import { useEffect } from "react";

export function useViewportHeightVar() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let frame = 0;
    const root = document.documentElement;
    const setHeight = () => {
      frame = 0;
      const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
      if (height > 0) root.style.setProperty("--app-viewport-height", `${height}px`);
    };
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(setHeight);
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    document.addEventListener("fullscreenchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("fullscreenchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, []);
}
