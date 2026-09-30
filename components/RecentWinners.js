import Link from "next/link";
import Avatar from "./Avatar";
import { TrophyIcon } from "./icons";
import { fullName, relativeDate } from "@/lib/format";

/** Horizontal strip of the latest draws, newest first. */
export default function RecentWinners({ raffles }) {
  if (!raffles?.length) return null;

  return (
    <section aria-labelledby="recent-heading" className="mt-8 animate-fade-up [animation-delay:.1s]">
      <div className="flex items-center gap-2">
        <TrophyIcon size={14} className="text-gold-400" />
        <h2 id="recent-heading" className="text-xs font-bold tracking-[0.2em] text-ink-400 uppercase">
          Recent winners
        </h2>
      </div>
      <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
        {raffles.map((raffle, i) => (
          <li key={raffle._id} className="shrink-0">
            <Link
              href={`/employee/${raffle.winner._id}`}
              className={`card flex items-center gap-3 py-2 pr-4 pl-2 transition hover:border-white/15 hover:bg-white/5 ${
                i === 0 ? "border-gold-400/30 bg-gold-400/6" : ""
              }`}
            >
              <Avatar employee={raffle.winner} size={36} />
              <span>
                <span className="block text-sm font-semibold text-ink-50">{fullName(raffle.winner)}</span>
                <span className="block text-xs text-ink-500">{relativeDate(raffle.date)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
