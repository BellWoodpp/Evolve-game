"use client";

import { useEffect } from "react";

export default function TopBarOffset() {
  useEffect(() => {
    const header = document.getElementById("topbar");
    if (!header) {
      document.documentElement.style.setProperty("--topbar-height", "0px");
      return;
    }

    const setOffset = () => {
      const height = header.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--topbar-height",
        `${height}px`
      );
    };

    setOffset();
    const resizeObserver = new ResizeObserver(setOffset);
    resizeObserver.observe(header);
    window.addEventListener("resize", setOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", setOffset);
    };
  }, []);

  return null;
}
