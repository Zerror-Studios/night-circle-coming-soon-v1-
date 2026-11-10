"use client";

import { Canvas } from "@react-three/fiber";
import MarbleReveal from "./marble/MarbleReveal";
import { marbleConfig } from "./marble/config";
import ComingSoon from "./coming-soon/ComingSoon";

// All settings (grain, reveal, colors, comingSoon) live in ./marble/config.js
const { grain, reveal, colors, comingSoon } = marbleConfig;

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

      {/* Centered on top of the marble; ignores the mouse so the reveal still works under it */}
      <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
        <ComingSoon {...comingSoon} />
      </div>
    </section>
  );
};

export default Hero;
