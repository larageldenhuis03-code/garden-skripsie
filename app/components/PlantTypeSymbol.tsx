import type { ReactNode } from "react";

/**
 * Plant-type symbols for the sketchbook layout (the owner's symbol sheet).
 * Each is drawn in a -50..50 box; the plant's own circle is the outer ring,
 * so only the inner mark is drawn here. Lines keep a constant thin weight
 * whatever the circle's size.
 */

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

const polar = (radius: (angle: number) => number, steps = 96) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius(angle);
    return `${i === 0 ? "M" : "L"}${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ") + " Z";

const star = (points: number, outer: number, inner: number) =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    return `${i === 0 ? "M" : "L"}${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
  }).join(" ") + " Z";

const wave = (x0: number, x1: number, y: number, amplitude: number, periods: number) =>
  Array.from({ length: 61 }, (_, i) => {
    const t = i / 60;
    return `${i === 0 ? "M" : "L"}${(x0 + (x1 - x0) * t).toFixed(2)},${(y + amplitude * Math.sin(t * periods * Math.PI * 2)).toFixed(2)}`;
  }).join(" ");

const verticalWave = (y0: number, y1: number, amplitude: number, periods: number, phase = 0) =>
  Array.from({ length: 61 }, (_, i) => {
    const t = i / 60;
    return `${i === 0 ? "M" : "L"}${(amplitude * Math.sin(t * periods * Math.PI * 2 + phase)).toFixed(2)},${(y0 + (y1 - y0) * t).toFixed(2)}`;
  }).join(" ");

/** Deterministic speckle for moss. */
const mossDots = Array.from({ length: 90 }, (_, i) => {
  const a = (i * 2.399963) % (Math.PI * 2); // golden-angle spread
  const r = 28 * Math.sqrt((i + 0.5) / 90);
  return [r * Math.cos(a) + ((i * 37) % 7) * 0.4 - 1.2, r * Math.sin(a) + ((i * 53) % 7) * 0.4 - 1.2];
});

const SYMBOLS: Record<string, ReactNode> = {
  tree: (
    <>
      <circle r={27} {...line} />
      <circle r={13} {...line} />
      <path d="M-5,0 H5 M0,-5 V5" {...line} />
    </>
  ),
  shrub: <path d={polar((a) => 27 + 4 * Math.sin(8 * a))} {...line} />,
  "ground cover": (
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <circle key={i} cx={14 * Math.cos(a)} cy={14 * Math.sin(a)} r={14} {...line} />;
      })}
      <circle r={5} {...line} />
    </>
  ),
  grass: <path d="M0,32 Q-8,0 -6,-32 M0,32 Q0,0 2,-36 M0,32 Q7,0 9,-30" {...line} />,
  succulent: (
    <>
      <path d={star(8, 30, 20)} {...line} />
      <path d={star(8, 16, 10)} {...line} />
    </>
  ),
  geophyte: <circle r={6} fill="currentColor" />,
  graminoid: (
    <path
      d={Array.from({ length: 7 }, (_, i) => {
        const a = (-150 + i * 20) * (Math.PI / 180);
        return `M0,26 L${(46 * Math.cos(a)).toFixed(1)},${(26 + 46 * Math.sin(a)).toFixed(1)}`;
      }).join(" ")}
      {...line}
    />
  ),
  fern: (
    <path
      d={`M0,-34 V34 ${Array.from({ length: 7 }, (_, i) => {
        const y = -26 + i * 8;
        return `M-16,${y - 10} L0,${y} L16,${y - 10}`;
      }).join(" ")}`}
      {...line}
    />
  ),
  orchid: (
    <>
      <ellipse cx={0} cy={-8} rx={12} ry={9} {...line} />
      <ellipse cx={-9} cy={6} rx={9} ry={12} {...line} />
      <ellipse cx={9} cy={6} rx={9} ry={12} {...line} />
    </>
  ),
  "bi/annual": (
    <>
      <path d="M0,-28 A28,28 0 0 0 0,28 Z" fill="currentColor" fillOpacity={0.25} stroke="none" />
      <circle r={28} {...line} />
      <path d="M0,-28 V28" {...line} />
    </>
  ),
  perennial: (
    <path
      d={Array.from({ length: 80 }, (_, i) => {
        const a = (i / 80) * Math.PI * 5;
        const r = 1 + a * 1.1;
        return `${i === 0 ? "M" : "L"}${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
      }).join(" ")}
      {...line}
    />
  ),
  parasitic: (
    <>
      <circle r={18} {...line} />
      <path
        d={Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return `M${(22 * Math.cos(a)).toFixed(1)},${(22 * Math.sin(a)).toFixed(1)} L${(32 * Math.cos(a)).toFixed(1)},${(32 * Math.sin(a)).toFixed(1)}`;
        }).join(" ")}
        {...line}
      />
    </>
  ),
  bulb: <path d="M0,-30 C-14,-30 -16,8 -12,14 C-8,20 8,20 12,14 C16,8 14,-30 0,-30 Z M-7,20 L-9,32 M-3,21 L-4,33 M1,21 L1,33 M5,21 L6,33 M8,20 L10,32" {...line} />,
  aquatic: (
    <>
      <path d={wave(-26, 26, -8, 5, 2)} {...line} />
      <path d={wave(-26, 26, 8, 5, 2)} {...line} />
    </>
  ),
  carnivorous: <path d="M-24,-8 A24,24 0 0 0 24,-8 L18,-2 L12,-10 L6,-2 L0,-10 L-6,-2 L-12,-10 L-18,-2 Z" {...line} />,
  climber: <path d={verticalWave(-30, 30, 9, 3)} {...line} />,
  epiphyte: <path d="M-34,10 H34 M-16,10 A16,16 0 0 1 16,10 M-8,10 A8,8 0 0 1 8,10" {...line} />,
  restio: (
    <>
      <path d="M0,30 L-22,-6 M0,30 L-12,-22 M0,30 L0,-30 M0,30 L12,-22 M0,30 L22,-6" {...line} />
      {[[-22, -6], [-12, -22], [0, -30], [12, -22], [22, -6]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={2.6} fill="currentColor" />
      ))}
    </>
  ),
  liana: (
    <>
      <path d={verticalWave(-32, 32, 9, 3.5)} {...line} />
      <path d={verticalWave(-32, 32, 9, 3.5, Math.PI)} {...line} />
    </>
  ),
  moss: (
    <>
      {mossDots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.3} fill="currentColor" />
      ))}
    </>
  ),
  scrambler: (
    <>
      <ellipse rx={24} ry={12} transform="rotate(-8)" {...line} />
      <ellipse rx={11} ry={24} transform="rotate(10)" {...line} />
      <ellipse cx={4} cy={4} rx={20} ry={13} transform="rotate(25)" {...line} />
    </>
  ),
};

export const SYMBOL_TYPES = Object.keys(SYMBOLS);

export function PlantTypeSymbol({ type }: { type: string | null }) {
  const symbol = type ? SYMBOLS[type] : undefined;
  if (!symbol) return null;
  return (
    <svg className="plant-type-symbol" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      {symbol}
    </svg>
  );
}
