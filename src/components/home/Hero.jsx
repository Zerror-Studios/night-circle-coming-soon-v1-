"use client";

import dynamic from "next/dynamic";
import { marbleConfig } from "./marble/config";
import FilmGrain from "./grain/FilmGrain";
import FluidBackground from "./fluid/FluidBackground";
import ComingSoon from "./coming-soon/ComingSoon";
import MoonPhases from "./coming-soon/MoonPhases";
import SignupForm from "./signup/SignupForm";
import LogoDraw from "./logo/LogoDraw";
import Stardust from "./stardust/Stardust";

// All settings (grain, reveal, fluid, stardust, colors, moons, appear, comingSoon, signup, logo) live in ./marble/config.js
const { grain, reveal, fluid, stardust, colors, moons, appear, comingSoon, signup, logo } = marbleConfig;

// WebGL marble reveal: only downloaded (with three.js) when `reveal.enabled` is true
const MarbleBackground = dynamic(() => import("./marble/MarbleBackground"), { ssr: false });

// the moons, "COMING SOON" and the sign-up form appear together as the logo finishes drawing
// (timed from the logo's own settings, so they stay in step if the logo gets faster or slower)
const appearDelay = Math.max(0, logo.delay + logo.duration - appear.overlap);

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
          {/* moon phases: a still graphic that fades in with "COMING SOON" */}
          <MoonPhases size={moons.size} delay={appearDelay} duration={appear.duration} />
        </div>
      </div>

      {/* "COMING SOON" + sign-up form, bottom centre, above everything */}
      <div
        className="absolute left-1/2 z-[70] -translate-x-1/2"
        style={{ bottom: signup.bottom }}
      >
        {/* hidden at first, then fades up into focus (keyframes: nc-rise-in in globals.css) */}
        <div
          className="flex flex-col items-center"
          style={{
            animation: `nc-rise-in ${appear.duration}s cubic-bezier(0.22, 1, 0.36, 1) ${appearDelay}s both`,
          }}
        >
          <ComingSoon {...comingSoon} />
          <SignupForm {...signup} />
        </div>
      </div>
    </section>
  );
};

export default Hero;
