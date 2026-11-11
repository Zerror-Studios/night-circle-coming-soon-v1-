"use client";

import { Canvas } from "@react-three/fiber";
import MarbleReveal from "./MarbleReveal";

// The WebGL marble reveal + grain. Loaded lazily by Hero only when
// `reveal.enabled` is true in config.js, so three.js isn't downloaded otherwise.
export default function MarbleBackground({ reveal, colors, grain }) {
  return (
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
  );
}
