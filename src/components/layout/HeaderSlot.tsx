"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import TopBarOffset from "./TopBarOffset";

export default function HeaderSlot() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/") {
      document.documentElement.style.setProperty("--topbar-height", "0px");
    }
  }, [pathname]);

  if (pathname === "/") {
    return null;
  }

  return (
    <>
      <Header />
      <TopBarOffset />
    </>
  );
}
