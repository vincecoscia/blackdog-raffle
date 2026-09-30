import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import Header from "@/components/Header";
import { ArrowLeftIcon, VolumeIcon, VolumeOffIcon } from "@/components/icons";
import { getSession } from "@/lib/auth";
import {
  CLIP_NAMES,
  isSoundEnabled,
  isSoundEnabledOnServer,
  playClip,
  playCrash,
  playFanfare,
  playWinnerSting,
  setSoundEnabled,
  sfx,
  startDrumroll,
  subscribeSound,
  unlockAudio,
  STING_THEMES,
} from "@/lib/sound";

// Where each recorded clip comes from (all CC0 — see public/sounds/CREDITS.md).
const SOURCES = {
  bark: "BigSoundBank #0612 · Small dog barking",
  yip: "BigSoundBank #1060 · 2 small dogs bark and growl",
  woof1: "BigSoundBank #1545 · Dogs barking and crying #2",
  woof2: "BigSoundBank #1544 · Dogs barking and crying #1",
  whine: "BigSoundBank #1546 · Dogs barking and crying #3",
  howl: "BigSoundBank #2450 · Dog singing #1",
  pant: "BigSoundBank #1547 · Dogs breathing",
  clack: "Kenney Impact Sounds · wood, light",
  plank: "Kenney Impact Sounds · plank",
  paw: "Kenney Impact Sounds · carpet footstep",
  thud: "Kenney Impact Sounds · soft impact",
};
const sourceOf = (name) => SOURCES[name] ?? SOURCES[name.replace(/\d+$/, "")] ?? SOURCES[name.replace(/Heavy$/, "")] ?? "";

const DOG = CLIP_NAMES.filter((n) => /^(bark|yip|woof|whine|howl|pant)/.test(n));
const OBJECTS = CLIP_NAMES.filter((n) => !DOG.includes(n));

const SYNTH = [
  { label: "Whoosh (big jump)", play: () => sfx.whoosh(1) },
  { label: "Whoosh (thrown bone)", play: () => sfx.whoosh(0.3) },
  { label: "Skid", play: () => sfx.skid() },
  { label: "Ear flap (head shake)", play: () => sfx.earFlap() },
  { label: "Bell (the “!”)", play: () => sfx.ting() },
  { label: "Sad trombone (fake-out)", play: () => sfx.wahwah() },
  { label: "Dig scratch", play: () => sfx.scratch() },
  { label: "Sniff", play: () => sfx.sniff() },
  { label: "Bone avalanche (cannonball)", play: () => sfx.avalanche() },
  { label: "Happy barks (reveal)", play: () => sfx.happyBarks() },
  { label: "Cymbal crash", play: () => playCrash() },
  { label: "Fanfare (brand look)", play: () => playFanfare() },
];

const THEME_LABELS = {
  none: "Brand look (fanfare)",
  halloween: "Halloween · organ + howl",
  holiday: "Holiday · sleigh bells",
  newyear: "New Year · party horn",
  valentines: "Valentine's · harp",
  stpatricks: "St. Patrick's · tin whistle",
  spring: "Spring · birdsong",
  summer: "Summer · ukulele",
  autumn: "Autumn · guitar",
};

/**
 * Sound board: every sound in the raffle, playable on its own, plus the whole
 * reveal sequence per season. Not linked from the app — for tuning.
 */
export default function Sounds() {
  const soundOn = useSyncExternalStore(subscribeSound, isSoundEnabled, isSoundEnabledOnServer);
  const [playingReveal, setPlayingReveal] = useState(null);
  const timers = useRef([]);

  const play = (fn) => {
    unlockAudio();
    fn();
  };

  const drumroll = () => {
    const stop = startDrumroll();
    timers.current.push(setTimeout(() => stop.climax(), 3000));
    timers.current.push(setTimeout(() => stop(true), 4000));
  };

  /** The end of a draw: drumroll, climax, crash + barks + sting, then panting. */
  const reveal = (theme) => {
    unlockAudio();
    timers.current.forEach(clearTimeout);
    setPlayingReveal(theme);
    const stop = startDrumroll();
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));
    at(3000, () => stop.climax());
    at(4000, () => {
      stop(true);
      sfx.happyBarks(0.12);
    });
    at(4180, () => playWinnerSting(theme === "none" ? null : theme));
    at(5900, () => sfx.pant());
    at(8200, () => setPlayingReveal(null));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Header title="Sound board" />
      <Link href="/" className="btn btn-ghost -ml-3 mb-4 text-ink-400">
        <ArrowLeftIcon size={16} />
        Back to the draw
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Tuning</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-ink-50">Sound board</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-400">
            Every sound in the raffle. Recorded clips vary their pitch slightly each time, like in the draw.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSoundEnabled(!soundOn)}
          className={`btn ${soundOn ? "btn-secondary" : "btn-primary"}`}
        >
          {soundOn ? <VolumeIcon size={16} /> : <VolumeOffIcon size={16} />}
          {soundOn ? "Sound on" : "Sound is muted — turn on"}
        </button>
      </div>

      <Section title="The whole reveal, by season" hint="About 8 seconds: drumroll → climax → crash, barks and the season's music → panting.">
        <div className="grid gap-2 sm:grid-cols-3">
          {["none", ...STING_THEMES].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => reveal(t)}
              disabled={playingReveal !== null}
              className={`btn justify-start ${playingReveal === t ? "btn-primary" : "btn-secondary"}`}
            >
              {THEME_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Just the music, by season" hint="What plays after the crash and the happy barks.">
        <Grid>
          {["none", ...STING_THEMES].map((t) => (
            <Pad
              key={t}
              label={(THEME_LABELS[t] ?? t).split(" · ")[0]}
              sub={(THEME_LABELS[t] ?? "").split(" · ")[1]}
              onClick={() => play(() => playWinnerSting(t === "none" ? null : t))}
            />
          ))}
          <Pad label="Drumroll" sub="3s build, 1s climax, crash" onClick={() => play(drumroll)} />
        </Grid>
      </Section>

      <Section title="The dog" hint="Recorded, public domain.">
        <Grid>
          {DOG.map((n) => (
            <Pad key={n} label={n} sub={sourceOf(n)} onClick={() => play(() => playClip(n, { gain: 0.8 }))} />
          ))}
        </Grid>
      </Section>

      <Section title="Bones, paws and landings" hint="Recorded, public domain.">
        <Grid>
          {OBJECTS.map((n) => (
            <Pad key={n} label={n} sub={sourceOf(n)} onClick={() => play(() => playClip(n, { gain: 0.8 }))} />
          ))}
        </Grid>
      </Section>

      <Section title="Effects and music" hint="Synthesised live in the browser.">
        <Grid>
          {SYNTH.map((s) => (
            <Pad key={s.label} label={s.label} onClick={() => play(s.play)} />
          ))}
        </Grid>
      </Section>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-ink-50">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-xs text-ink-500">{hint}</p>}
      {children}
    </section>
  );
}

const Grid = ({ children }) => <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;

function Pad({ label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex flex-col items-start px-3 py-2.5 text-left transition hover:border-accent-400/40 hover:bg-accent-400/6 active:translate-y-px"
    >
      <span className="font-display text-sm font-bold text-ink-50">{label}</span>
      {sub && <span className="mt-0.5 text-[11px] leading-tight text-ink-500">{sub}</span>}
    </button>
  );
}

export async function getServerSideProps({ req, res }) {
  const session = await getSession(req, res);
  if (!session) return { redirect: { destination: "/", permanent: false } };
  return { props: { session } };
}
