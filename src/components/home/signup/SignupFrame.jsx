// Ornamental silver frame for the sign-up form.
// Drawn on the same 587 × 95 grid as the reference design so every ornament,
// bar and divider lands exactly where it is in the artwork.
//
//   bars:     top y = 17.5, bottom y = 73.5
//   sides:    x = 26 (left) … 565 (right), scrollwork columns (no straight lines)
//   divider:  x = 428  (EMAIL | SIGN UP)
//   crests:   centred at x = 295.5 on both bars

export const FRAME = {
  W: 587,
  H: 95,
  top: 17.5,
  bottom: 73.5,
  left: 26,
  right: 565,
  divider: 428,
};

// Mirror helpers (left/right about x = 295.5, top/bottom about y = 45.5)
const MX = 591; // x' = 591 - x
const MY = 91; // y' = 91 - y

// ── Top-left corner piece (mirrored to the other three corners) ──
function Corner() {
  return (
    <>
      {/* cross-star at the very corner */}
      <path
        d="M29.5,11.8 Q30.5,16.5 35.2,17.5 Q30.5,18.5 29.5,23.2 Q28.5,18.5 23.8,17.5 Q28.5,16.5 29.5,11.8 Z"
        transform="rotate(45 29.5 17.5)"
        fill="url(#sf-orn)"
      />
      <circle cx="29.5" cy="17.5" r="1.4" fill="#d4d3cd" />

      {/* C-scroll curling along the top bar */}
      <path
        d="M32,16.4 C36,12.4 42,11.9 46.5,13.5 C49.7,14.7 49.9,18.8 47.2,19.8 C45.4,20.5 43.8,19.2 44.6,17.8"
        fill="none"
        stroke="url(#sf-orn)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* little curl where the scroll hands over to the bar */}
      <path
        d="M49.2,17.6 C50.6,14.2 53.8,12.9 55.8,14.5 C57.1,15.6 56.3,17.2 54.9,16.8"
        fill="none"
        stroke="url(#sf-orn)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="40.4" cy="21" r="0.95" fill="url(#sf-orn)" />

      {/* diagonal stem into an inward-pointing fleur-de-lis */}
      <path
        d="M31.6,20.2 C34,22.6 35.6,24.6 37.4,26.4"
        fill="none"
        stroke="url(#sf-orn)"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <g transform="translate(37.4 26.4) rotate(135) scale(1.25)">
        <path d="M0,0 C-2.4,-1.6 -2.6,-4.6 0,-7.4 C2.6,-4.6 2.4,-1.6 0,0 Z" fill="url(#sf-orn)" />
        <path d="M0,-1 C-2,-1.2 -3.9,-2.6 -4.3,-4.9 C-2.6,-4.3 -1.2,-3 0,-1 Z" fill="url(#sf-orn)" />
        <path d="M0,-1 C2,-1.2 3.9,-2.6 4.3,-4.9 C2.6,-4.3 1.2,-3 0,-1 Z" fill="url(#sf-orn)" />
        <rect x="-1.8" y="-1.6" width="3.6" height="1" rx="0.4" fill="#d4d3cd" />
      </g>

      {/* leafy vine running down the side (top half; mirrored for the bottom) */}
      <path
        d="M28.6,22.4 C30.8,26.6 26.8,30.8 29,35 C30.6,38.6 27.8,41.6 29,45.5"
        fill="none"
        stroke="url(#sf-orn)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* acanthus leaves on both sides of the vine → dense, bushy column like the reference */}
      {[
        { x: 30.4, y: 26.8, r: 62, s: 1.2 },
        { x: 27.4, y: 26.2, r: -48, s: 0.85 },
        { x: 27.2, y: 31.4, r: -62, s: 1.2 },
        { x: 30.8, y: 32.2, r: 50, s: 0.85 },
        { x: 30.6, y: 36.2, r: 62, s: 1.2 },
        { x: 27.6, y: 36.8, r: -50, s: 0.85 },
        { x: 27.4, y: 40.6, r: -62, s: 1.2 },
        { x: 30.6, y: 41.4, r: 52, s: 0.85 },
      ].map((l, i) => (
        <path
          key={i}
          d="M0,0 C-1.5,-1.1 -1.6,-3 0,-4.6 C1.6,-3 1.5,-1.1 0,0 Z"
          transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`}
          fill="url(#sf-orn)"
        />
      ))}
      <circle cx="32.6" cy="29.6" r="0.75" fill="url(#sf-orn)" />
      <circle cx="25.6" cy="38.6" r="0.75" fill="url(#sf-orn)" />
      {/* tiny tendrils between the leaves */}
      <path d="M29.6,29.4 C31.6,29.6 32.4,31.4 31.2,32.4" fill="none" stroke="url(#sf-orn)" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M28.4,38.4 C26.4,38.6 25.6,40.4 26.8,41.4" fill="none" stroke="url(#sf-orn)" strokeWidth="1.1" strokeLinecap="round" />
      {/* knot at the centre of the side */}
      <path d="M29,42 L31.2,45.5 L29,49 L26.8,45.5 Z" fill="url(#sf-orn)" />
    </>
  );
}

// ── Top crest: upward fleur-de-lis with curled scrolls (centred at 0,0 on the bar) ──
function TopCrest() {
  const half = (
    <>
      <path d="M0,-2.5 C-2.2,-3 -4.8,-4.8 -5.4,-8.6 C-3.2,-7.8 -1.4,-5.8 0,-2.5 Z" fill="url(#sf-orn)" />
      <path
        d="M-3,-1.2 C-6,-1 -8,-3.5 -10,-6.5 C-11.5,-9 -14.5,-9 -15,-6.8 C-15.4,-5 -13.6,-4.2 -12.8,-5.4"
        fill="none"
        stroke="url(#sf-orn)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M-9,-1.4 C-13,-0.6 -17,-2 -20,-3.6 C-21.4,-4.3 -22.6,-3.2 -21.8,-2.2"
        fill="none"
        stroke="url(#sf-orn)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="-22.6" cy="-1.5" r="0.95" fill="url(#sf-orn)" />
      <circle cx="-17.6" cy="-6.6" r="0.75" fill="url(#sf-orn)" />
    </>
  );
  return (
    <g transform={`translate(295.5 ${FRAME.top})`}>
      {half}
      <g transform="scale(-1 1)">{half}</g>
      <path d="M0,-1.5 C-2.3,-4 -2.4,-8.5 0,-13 C2.4,-8.5 2.3,-4 0,-1.5 Z" fill="url(#sf-orn)" />
      <rect x="-3" y="-2.7" width="6" height="1.3" rx="0.5" fill="#d4d3cd" />
      {/* small drop under the bar */}
      <path d="M0,1 C-1.4,2.2 -1.2,3.6 0,5.4 C1.2,3.6 1.4,2.2 0,1 Z" fill="url(#sf-orn)" />
    </g>
  );
}

// ── Bottom crest: downward fleur with star-leaves (centred at 0,0 on the bar) ──
function BottomCrest() {
  const half = (
    <>
      <path d="M0,2 C-2.4,2.6 -4.6,4.6 -5,7.8 C-3,6.8 -1.4,4.8 0,2 Z" fill="url(#sf-orn)" />
      <path d="M-3,1.2 C-5.5,2.6 -7,3.6 -8.2,4.6" fill="none" stroke="url(#sf-orn)" strokeWidth="1.35" strokeLinecap="round" />
      <path
        d="M-10,2.2 Q-9.6,5.1 -7,5.5 Q-9.6,5.9 -10,8.8 Q-10.4,5.9 -13,5.5 Q-10.4,5.1 -10,2.2 Z"
        transform="rotate(45 -10 5.5)"
        fill="url(#sf-orn)"
      />
      <circle cx="-10" cy="5.5" r="0.8" fill="#d4d3cd" />
      <path
        d="M-12.8,4.2 C-15,3.4 -17.5,3 -19.5,3.3"
        fill="none"
        stroke="url(#sf-orn)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="-20.5" cy="3.2" r="0.95" fill="url(#sf-orn)" />
    </>
  );
  return (
    <g transform={`translate(295.5 ${FRAME.bottom})`}>
      {half}
      <g transform="scale(-1 1)">{half}</g>
      <path d="M0,1 C-2.3,3.6 -2.2,8 0,12.6 C2.2,8 2.3,3.6 0,1 Z" fill="url(#sf-orn)" />
      {/* small peak above the bar */}
      <path d="M-2.8,-0.9 Q-0.6,-1.6 0,-4.4 Q0.6,-1.6 2.8,-0.9 Z" fill="url(#sf-orn)" />
    </g>
  );
}

export default function SignupFrame({ className, style }) {
  const barH = 2.6;
  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${FRAME.W} ${FRAME.H}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* polished silver for the bars: bright top edge → darker bottom edge */}
        {/* muted antique silver, matched to the reference */}
        <linearGradient id="sf-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d6d5cf" />
          <stop offset="0.45" stopColor="#aeaca5" />
          <stop offset="1" stopColor="#64625d" />
        </linearGradient>
        <linearGradient id="sf-bar-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfcec8" />
          <stop offset="0.5" stopColor="#a7a59e" />
          <stop offset="1" stopColor="#64625d" />
        </linearGradient>
        {/* ornaments: lit from the upper left */}
        <linearGradient id="sf-orn" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dedcd6" />
          <stop offset="0.5" stopColor="#adaba4" />
          <stop offset="1" stopColor="#6e6c67" />
        </linearGradient>
        {/* raised-metal depth: dark drop + faint sheen */}
        <filter id="sf-depth" x="-5%" y="-30%" width="110%" height="160%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="0.9" floodColor="#000" floodOpacity="0.85" />
          <feDropShadow dx="0" dy="0" stdDeviation="1.6" floodColor="#e8e6df" floodOpacity="0.08" />
        </filter>
      </defs>

      <g filter="url(#sf-depth)">
        {/* bars */}
        <rect x="51" y={FRAME.top - barH / 2} width={540 - 51} height={barH} fill="url(#sf-bar)" />
        <rect x="51" y={FRAME.bottom - barH / 2} width={540 - 51} height={barH} fill="url(#sf-bar)" />
        {/* divider between EMAIL and SIGN UP */}
        <rect
          x={FRAME.divider - 0.9}
          y={FRAME.top}
          width="1.8"
          height={FRAME.bottom - FRAME.top}
          fill="url(#sf-bar-v)"
        />

        {/* four corners: one drawing, mirrored */}
        <g>
          <Corner />
        </g>
        <g transform={`matrix(1 0 0 -1 0 ${MY})`}>
          <Corner />
        </g>
        <g transform={`matrix(-1 0 0 1 ${MX} 0)`}>
          <Corner />
        </g>
        <g transform={`matrix(-1 0 0 -1 ${MX} ${MY})`}>
          <Corner />
        </g>

        <TopCrest />
        <BottomCrest />
      </g>
    </svg>
  );
}
