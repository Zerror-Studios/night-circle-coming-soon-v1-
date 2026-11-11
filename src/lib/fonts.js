import { Cinzel, Cormorant_Garamond } from "next/font/google";

// Cinzel = free Roman-capitals face, the closest match to Trajan.
// Shared so every component uses the same font instance.
export const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap" });

// Elegant serif WITH lowercase — used where people type (Cinzel is capitals-only,
// so an email address would otherwise turn into ALL CAPS).
export const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500"], display: "swap" });
