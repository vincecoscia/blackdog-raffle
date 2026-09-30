import { useEffect, useRef, useState } from "react";

const HEIGHT = 220; // plot height
const AXIS_BAND = 28; // room for x-axis labels under the plot
const LEFT = 44; // room for y-axis labels
const TOP = 18;
const RIGHT = 8;
const BAR = "#33a87a"; // accent-600: passes the palette checks on the dark surface

const pct = (v, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const fmt = new Intl.NumberFormat("en-US");

/** A clean upper bound and ticks for a percentage axis (values are fractions). */
function niceScale(maxValue) {
  const steps = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25];
  const step = steps.find((s) => maxValue / s <= 5) ?? 0.25;
  const top = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return { top, ticks };
}

/**
 * Share of test draws won by each entry, with the "perfectly even" level
 * marked. Bars start at zero on purpose: fair results should look flat.
 */
export default function SimulationChart({ counts, draws }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const n = counts.length;
  const shares = counts.map((c) => c / draws);
  const expected = 1 / n;
  const { top, ticks } = niceScale(Math.max(expected * 1.3, ...shares));
  const plotW = width - LEFT - RIGHT;
  const band = plotW / n;
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v) => TOP + HEIGHT - (v / top) * HEIGHT;
  const x = (i) => LEFT + i * band + (band - barW) / 2;
  const labelEvery = Math.ceil(n / Math.max(1, Math.floor(plotW / 28)));
  const lo = Math.min(...shares);
  const hi = Math.max(...shares);

  const barPath = (i) => {
    const h = Math.max(0.5, y(0) - y(shares[i]));
    const r = Math.min(4, barW / 2, h);
    const x0 = x(i);
    const y0 = y(0);
    return `M ${x0} ${y0} V ${y0 - h + r} Q ${x0} ${y0 - h} ${x0 + r} ${y0 - h} H ${x0 + barW - r} Q ${x0 + barW} ${
      y0 - h
    } ${x0 + barW} ${y0 - h + r} V ${y0} Z`;
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => (a == null ? 0 : (a + dir + n) % n));
    } else if (e.key === "Escape") setActive(null);
  };

  const tipLeft = active == null ? 0 : Math.min(width - 170, Math.max(0, x(active) + barW / 2 - 85));

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={TOP + HEIGHT + AXIS_BAND}
        role="img"
        aria-label={`Bar chart: share of ${fmt.format(draws)} test draws won by each of ${n} entries. Lowest ${pct(lo, 2)}, highest ${pct(
          hi,
          2
        )}, perfectly even would be ${pct(expected, 2)}. Use the left and right arrow keys to read each bar.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? 0)}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
      >
        {/* Hairline grid + y-axis labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.07)" strokeWidth="1" />
            <text x={LEFT - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-ink-500 text-[11px] tabular-nums">
              {t === 0 ? "0%" : pct(t, t < 0.01 ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* Bars (grow in on each new run) */}
        {shares.map((_, i) => (
          <path
            key={`${draws}-${i}`}
            d={barPath(i)}
            fill={BAR}
            opacity={active == null || active === i ? 1 : 0.45}
            className="origin-bottom animate-[bar-grow_.6s_cubic-bezier(.16,1,.3,1)_both] [transform-box:fill-box]"
            style={{ animationDelay: `${Math.min(i, 60) * 12}ms` }}
          />
        ))}

        {/* Expected (perfectly even) level */}
        <line x1={LEFT} x2={width - RIGHT} y1={y(expected)} y2={y(expected)} stroke="#e9e9ef" strokeOpacity="0.75" strokeWidth="1" />
        <text x={width - RIGHT} y={y(expected) - 6} textAnchor="end" className="fill-ink-200 text-[11px] font-semibold">
          Perfectly even: {pct(expected)}
        </text>

        {/* X-axis labels */}
        {shares.map((_, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i) + barW / 2} y={TOP + HEIGHT + 16} textAnchor="middle" className="fill-ink-500 text-[10px] tabular-nums">
              {i + 1}
            </text>
          ) : null
        )}

        {/* Hover targets: the whole column, wider than the bar */}
        {shares.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={LEFT + i * band}
            y={TOP}
            width={band}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
          />
        ))}
      </svg>

      {active != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-[170px] rounded-xl border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{ left: tipLeft }}
          role="status"
        >
          <p className="font-semibold text-ink-50">Entry {active + 1}</p>
          <p className="mt-0.5 text-ink-300">
            {fmt.format(counts[active])} wins · <span className="text-ink-50">{pct(shares[active], 2)}</span>
          </p>
        </div>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-400 hover:text-ink-200">See the numbers</summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/8">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-850 text-ink-400">
              <tr>
                <th className="px-3 py-2 font-semibold">Entry</th>
                <th className="px-3 py-2 text-right font-semibold">Wins</th>
                <th className="px-3 py-2 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-ink-200 tabular-nums">
              {counts.map((c, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{i + 1}</td>
                  <td className="px-3 py-1.5 text-right">{fmt.format(c)}</td>
                  <td className="px-3 py-1.5 text-right">{pct(c / draws, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
