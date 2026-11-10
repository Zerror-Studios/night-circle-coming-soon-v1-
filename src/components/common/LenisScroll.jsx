"use client";
import React, { useEffect, useRef } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

export default function LenisScroll({ children }) {
  const lenis = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true });
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // if (window.innerWidth < 1024) return

    const instance = new Lenis({
      smooth: !0,
      lerp: .1,
      wheelMultiplier: .7,
      gestureOrientation: "vertical",
      normalizeWheel: !1,
      smoothTouch: !1
    });

    lenis.current = instance;
    window.lenis = instance;

    let frame;
    const raf = (time) => {
      instance.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    const handleResize = () => {
      instance.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      instance.destroy();
      lenis.current = null;
      window.lenis = null;
    };
  }, []);

  return <>{children}</>;
}
