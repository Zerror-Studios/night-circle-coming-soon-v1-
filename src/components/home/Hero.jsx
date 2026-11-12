"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { marbleConfig } from "./marble/config";
import FilmGrain from "./grain/FilmGrain";
import FluidBackground from "./fluid/FluidBackground";
import ComingSoon from "./coming-soon/ComingSoon";
import SignupForm from "./signup/SignupForm";
import LogoDraw from "./logo/LogoDraw";
import Stardust from "./stardust/Stardust";

// All settings (grain, reveal, fluid, stardust, colors, comingSoon, signup, logo, corner) live in ./marble/config.js
const { grain, reveal, fluid, stardust, colors, comingSoon, signup, logo, corner } = marbleConfig;

// WebGL marble reveal: only downloaded (with three.js) when `reveal.enabled` is true
const MarbleBackground = dynamic(() => import("./marble/MarbleBackground"), { ssr: false });

const Hero = () => {
  return (
    <section
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: colors.bg }}
    >
      {/* Fluid smoke that follows the mouse (moves only on mouse movement) */}
      {fluid.enabled && (
        <FluidBackground
          {...fluid}
          background={colors.bg}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      )}

      {reveal.enabled ? (
        // marble reveal on mouse move (its shader also draws the grain)
        <MarbleBackground reveal={reveal} colors={colors} grain={grain} />
      ) : (
        // marble off → plain background with a light, static film grain
        <FilmGrain
          amount={grain.amount}
          size={grain.size}
          className="pointer-events-none absolute inset-0 z-[50]"
        />
      )}

      {/* Stardust trail behind the mouse (above the background, below the content) */}
      {stardust.enabled && (
        <Stardust {...stardust} className="pointer-events-none absolute inset-0 z-[55] h-full w-full" />
      )}

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
          {/* "Night Circle" logo, drawn left to right, sitting just above the moons.
              It is the page's main heading: the text is there for search engines and screen readers. */}
          <h1
            className="absolute bottom-full left-1/2 -translate-x-1/2"
            style={{ marginBottom: logo.gap }}
          >
            <span className="sr-only">Night Circle</span>
            <LogoDraw {...logo} decorative />
          </h1>
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
