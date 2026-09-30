import Link from "next/link";
import { useState } from "react";
import Header from "@/components/Header";
import SimulationChart from "@/components/SimulationChart";
import { ArrowLeftIcon, RefreshIcon, ShieldIcon, Spinner, TicketIcon } from "@/components/icons";
import { getSession } from "@/lib/auth";
import { api } from "@/lib/client";
import { getEmployees } from "@/lib/data";
import { fairnessDemo } from "@/lib/draw";
import {
  chanceNeverWon,
  chanceSomeoneRepeats,
  drawsUntilRepeatLikely,
  expectedDistinctWinners,
} from "@/lib/stats";

const DEMO_DRAWS = 100_000;

const PRESETS = [
  { draws: 12, label: "A year of monthly draws" },
  { draws: 26, label: "6 months of weekly draws" },
  { draws: 52, label: "A year of weekly draws" },
];

const fmt = new Intl.NumberFormat("en-US");
const percent = (p) => (p > 0.995 && p < 1 ? ">99%" : p < 0.005 && p > 0 ? "<1%" : `${Math.round(p * 100)}%`);

export default function Fairness({ poolSize, firstRun }) {
  const n = poolSize;
  const [draws, setDraws] = useState(26);

  return (
    <div className="mx-auto max-w-3xl">
      <Header title="How the draw works" description="How the Blackdog raffle picks a winner, and why it's fair." />

      <Link href="/" className="btn btn-ghost -ml-3 mb-4 text-ink-400">
        <ArrowLeftIcon size={16} />
        Back to the draw
      </Link>

      <section className="animate-fade-up">
        <p className="eyebrow">Fair and square</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-balance text-ink-50 sm:text-5xl">How the draw works</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-300">
          Everyone whose timesheet is in gets <strong className="text-ink-50">exactly one entry</strong>, and the computer picks one
          entry completely at random. With {n} people in the draw, everyone&apos;s chance is{" "}
          <strong className="text-ink-50">1 in {n}</strong> — every single time.
        </p>
      </section>

      <section className="mt-10 grid animate-fade-up gap-4 [animation-delay:.08s] sm:grid-cols-3">
        <Point icon={<TicketIcon size={18} />} title="One entry each">
          No extra tickets, no favourites. Nobody&apos;s odds depend on anything but being in the draw.
        </Point>
        <Point icon={<ShieldIcon size={18} />} title="Picked before the dog moves">
          The server picks the winner using secure randomness (the kind used for encryption keys) and records it straight away. The
          dog just acts it out.
        </Point>
        <Point icon={<RefreshIcon size={18} />} title="No memory">
          Every draw starts fresh. Winning last time doesn&apos;t make you more or less likely to win this time — like a coin
          that doesn&apos;t remember its last flip.
        </Point>
      </section>

      <section aria-labelledby="repeats" className="mt-14 animate-fade-up [animation-delay:.12s]">
        <p className="eyebrow">The question everyone asks</p>
        <h2 id="repeats" className="mt-2 font-display text-2xl font-extrabold text-ink-50 sm:text-3xl">
          Why do some people win more than once?
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed text-ink-300">
          <p>
            Because that&apos;s what real randomness looks like. It feels like a fair draw should go around the room, but a draw
            that made sure everyone won in turn wouldn&apos;t be random — it would be a rotation.
          </p>
          <p>
            It&apos;s the same reason a shuffled playlist plays the same artist twice, or why in a room of just 23 people, two of
            them probably share a birthday. With {n} people in the raffle, it only takes{" "}
            <strong className="text-ink-50">{drawsUntilRepeatLikely(n)} draws</strong> before it&apos;s more likely than not that
            someone has already won twice.
          </p>
        </div>

        <div className="card mt-6 p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-ink-100">
              After <span className="font-display text-lg text-accent-300">{draws}</span> draws with {n} people…
            </p>
            <div role="group" aria-label="Number of draws" className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.draws}
                  type="button"
                  onClick={() => setDraws(p.draws)}
                  aria-pressed={draws === p.draws}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    draws === p.draws ? "bg-white/10 text-ink-50" : "text-ink-400 hover:bg-white/5 hover:text-ink-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="mt-4 block">
            <span className="sr-only">Number of draws</span>
            <input
              type="range"
              min={1}
              max={104}
              value={draws}
              onChange={(e) => setDraws(Number(e.target.value))}
              className="w-full accent-[#77ddaf]"
            />
          </label>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Figure value={percent(chanceSomeoneRepeats(n, draws))} label="chance someone has already won more than once" />
            <Figure
              value={`${Math.round(expectedDistinctWinners(n, draws))} of ${n}`}
              label="different people you'd expect to have won"
            />
            <Figure value={percent(chanceNeverWon(n, draws))} label="chance any one person hasn't won yet" />
          </dl>
          <p className="mt-5 text-xs text-ink-500">
            So over {draws} draws, repeat winners and people still waiting for their first win are both completely normal — neither
            is a sign that the draw is off.
          </p>
        </div>
      </section>

      <Simulation n={n} firstRun={firstRun} />

      <section aria-labelledby="recorded" className="mt-14 mb-4 animate-fade-up">
        <h2 id="recorded" className="font-display text-xl font-extrabold text-ink-50">
          What gets recorded
        </h2>
        <p className="mt-2 leading-relaxed text-ink-300">
          Each draw saves the date, the winner, how many people were in the draw, and who pressed the button. Nobody can pick or
          nudge the result: the page asks the server for a winner, and the server decides on its own.
        </p>
      </section>
    </div>
  );
}

function Point({ icon, title, children }) {
  return (
    <div className="card p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-400/12 text-accent-300">{icon}</div>
      <h3 className="mt-3 font-display text-base font-bold text-ink-50">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{children}</p>
    </div>
  );
}

function Figure({ value, label }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-3xl font-extrabold text-ink-50">{value}</dd>
      <dd className="mt-1 text-sm text-ink-400">{label}</dd>
    </div>
  );
}

/** Live demo: run test draws through the real pick function on the server. */
function Simulation({ n, firstRun }) {
  const [result, setResult] = useState(firstRun);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const { data } = await api(`/api/fairness?n=${n}&draws=${DEMO_DRAWS}`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const share = (c) => `${((c / (result?.draws ?? 1)) * 100).toFixed(2)}%`;
  const passed = result && result.pValue > 0.001;

  return (
    <section aria-labelledby="see" className="mt-14 animate-fade-up">
      <p className="eyebrow">See for yourself</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="see" className="font-display text-2xl font-extrabold text-ink-50 sm:text-3xl">
          100,000 test draws, just now
        </h2>
        <button type="button" onClick={run} disabled={running} className="btn btn-secondary">
          {running ? <Spinner size={15} /> : <RefreshIcon size={15} />}
          Run them again
        </button>
      </div>
      <p className="mt-3 leading-relaxed text-ink-300">
        This runs the exact same code the real draw uses, 100,000 times, with {n} entries (nothing is recorded). Each bar is one
        entry; if the draw favoured anyone, their bar would stick out.
      </p>

      <div className="card mt-5 p-4 sm:p-6">
        {error ? (
          <p className="py-10 text-center text-sm text-red-300">{error}</p>
        ) : !result ? (
          <div className="flex h-[266px] items-center justify-center text-ink-500">
            <Spinner size={20} />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-300">
              Every entry won between <strong className="text-ink-50">{share(result.min)}</strong> and{" "}
              <strong className="text-ink-50">{share(result.max)}</strong> of the time.
            </p>
            <SimulationChart counts={result.counts} draws={result.draws} />
            <div
              className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                passed ? "border-accent-400/25 bg-accent-400/8 text-ink-200" : "border-amber-400/30 bg-amber-400/8 text-ink-200"
              }`}
            >
              <ShieldIcon size={18} className={`mt-0.5 shrink-0 ${passed ? "text-accent-300" : "text-amber-300"}`} />
              <p>
                {passed ? (
                  <>
                    <strong className="text-ink-50">No favouritism detected.</strong> A standard statistical test (chi-square)
                    found the spread well within normal chance variation (p = {result.pValue.toFixed(2)}).
                  </>
                ) : (
                  <>
                    <strong className="text-ink-50">Unusually uneven run.</strong> A fair draw produces a run this lopsided about 1
                    time in 1,000 (p = {result.pValue.toFixed(4)}), so run it again — it should be back to normal.
                  </>
                )}{" "}
                <span className="text-ink-500">
                  {fmt.format(result.draws)} draws in {result.ms} ms.
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-400">
        We also run an automated test suite of 18 checks that puts millions of draws through the same code. It checks that every
        entry is equally likely, that one draw never influences the next, and it&apos;s been confirmed to catch rigged draws —
        including one that quietly stops anyone winning twice in a row.
      </p>
    </section>
  );
}

export async function getServerSideProps({ req, res }) {
  const session = await getSession(req, res);
  if (!session) return { redirect: { destination: "/", permanent: false } };
  const employees = await getEmployees();
  const inDraw = employees.filter((e) => e.entries > 0).length;
  // With fewer than two people in, explain with the whole team instead.
  const poolSize = inDraw >= 2 ? inDraw : Math.max(2, employees.length || 25);

  // The first demo run happens here so the chart is there on page load.
  return { props: { session, poolSize, firstRun: fairnessDemo(poolSize, DEMO_DRAWS) } };
}
