import type { Pose } from "@/lib/types";

/**
 * Stylised stand-in for the advisor's uploaded headshot. A real build would
 * composite the actual photo; poses here just vary arm/head placement.
 */
export function Headshot({ pose = "center", className }: { pose?: Pose; className?: string }) {
  const skin = "#E2B999";
  const skinShade = "#C99877";
  const hair = "#3B2A22";
  const jacket = "#1B2B45";
  const jacketShade = "#13203A";
  const flip = pose === "left";
  const tilt = pose === "think" ? -5 : pose === "right" ? 4 : pose === "left" ? -4 : 0;

  return (
    <svg viewBox="0 0 200 240" className={className} aria-hidden preserveAspectRatio="xMidYMax meet">
      <g transform={flip ? "translate(200,0) scale(-1,1)" : undefined}>
        {/* torso */}
        <path d="M20 240c4-46 26-70 80-76 54 6 76 30 80 76z" fill={jacket} />
        <path d="M100 164l-18 6 18 52 18-52z" fill="#F4F1EA" />
        <path d="M100 172l-6 6 6 30 6-30z" fill="#B08D57" />
        <path d="M82 170l18 52-30-44zM118 170l-18 52 30-44z" fill={jacketShade} />
        {/* neck */}
        <path d="M86 132h28v34l-14 8-14-8z" fill={skinShade} />
        {/* head */}
        <g transform={`rotate(${tilt} 100 100)`}>
          <ellipse cx="100" cy="98" rx="33" ry="40" fill={skin} />
          <path d="M66 94c-4-34 18-52 38-52 26 0 42 18 36 52-4-14-10-24-22-28-12 10-34 14-52 28z" fill={hair} />
          <path d="M66 94c-2 16 0 34 6 46-10-6-14-24-12-40z" fill={hair} />
          <path d="M134 94c2 16 0 34-6 46 10-6 14-24 12-40z" fill={hair} />
          <ellipse cx="88" cy="100" rx="3" ry="3.4" fill="#2A1E19" />
          <ellipse cx="112" cy="100" rx="3" ry="3.4" fill="#2A1E19" />
          <path d="M84 91q4-3 9 0M107 91q5-3 9 0" stroke="#3B2A22" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M90 120q10 7 20 0" stroke="#9C5B4C" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>
        {/* arms */}
        {pose === "point" && (
          <g>
            <path d="M160 240c0-30 6-60 12-84l14 4c-2 30-6 58-8 80z" fill={jacket} />
            <path d="M170 160l4-36 10 2-2 36z" fill={skin} />
            <rect x="172" y="104" width="7" height="24" rx="3.5" fill={skin} />
          </g>
        )}
        {pose === "think" && (
          <g>
            <path d="M36 240c6-30 30-52 52-74l14 10c-20 22-36 46-44 64z" fill={jacket} />
            <path d="M84 150c4-8 14-14 22-12l2 12c-8 2-14 6-18 10z" fill={skin} />
          </g>
        )}
        {pose === "crossed" && (
          <g>
            <path d="M34 214c30-12 92-12 132 0v18c-40-10-102-10-132 0z" fill={jacketShade} />
            <path d="M44 206c34-10 80-10 112 0l-4 14c-30-8-74-8-104 0z" fill={jacket} />
            <ellipse cx="48" cy="214" rx="9" ry="7" fill={skin} />
            <ellipse cx="152" cy="214" rx="9" ry="7" fill={skin} />
          </g>
        )}
      </g>
    </svg>
  );
}
