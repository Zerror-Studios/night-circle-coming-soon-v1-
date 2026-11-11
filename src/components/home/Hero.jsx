"use client";

import Image from "next/image";
import { Canvas } from "@react-three/fiber";
import MarbleReveal from "./marble/MarbleReveal";
import { marbleConfig } from "./marble/config";
import ComingSoon from "./coming-soon/ComingSoon";
import SignupForm from "./signup/SignupForm";
import Handwriting from "./handwriting/Handwriting";

// All settings (grain, reveal, colors, comingSoon, signup, handwriting, corner) live in ./marble/config.js
const { grain, reveal, colors, comingSoon, signup, handwriting, corner } = marbleConfig;

const Hero = () => {
  return (
    <section
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: colors.bg }}
    >
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        flat
        linear
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <MarbleReveal {...reveal} colors={colors} grain={grain} />
      </Canvas>

      {/* Floral ornament, top-left corner with a small gap (decorative; ignores the mouse) */}
      <Image
        src="/images/corner-flower.png"
        alt=""
        aria-hidden="true"
        width={229}
        height={272}
        priority
        unoptimized // tiny 17 KB PNG: serve it as-is, no image-optimizer round trip
        className="pointer-events-none absolute z-[60] h-auto select-none"
        style={{
          top: corner.gap,
          left: corner.gap,
          width: corner.width,
          animation: `nc-fade-in ${corner.fadeIn}s ease-out ${corner.fadeDelay}s both`,
        }}
      />

      {/* Centered on top of the marble; ignores the mouse so the reveal still works under it */}
      <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
        <div className="relative">
          {/* "Night Circle" handwriting, sitting just above the moons */}
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2"
            style={{ marginBottom: handwriting.gap }}
          >
            <Handwriting {...handwriting} />
          </div>
          <ComingSoon {...comingSoon} />
        </div>
      </div>

      {/* Sign-up form, bottom centre, above everything */}
      <div
        className="absolute left-1/2 z-[70] -translate-x-1/2"
        style={{ bottom: signup.bottom }}
      >
        <SignupForm {...signup} />
      </div>
    </section>
  );
};

export default Hero;
