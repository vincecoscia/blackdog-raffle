import Link from "next/link";
import Avatar from "./Avatar";
import DrawToggle from "./DrawToggle";
import EntryStepper from "./EntryStepper";
import { TrashIcon, TrophyIcon } from "./icons";
import { SHOW_WIN_COUNTS } from "@/lib/features";
import { fullName } from "@/lib/format";
import { formatChance, ticketsFor } from "@/lib/raffles";

/**
 * One teammate on the roster. The weekly draw shows the in/out switch; the
 * monthly draw shows their entries, their odds, and a bar along the bottom
 * sized against whoever holds the most.
 */
export default function EmployeeCard({ employee, kind, totalTickets = 0, mostTickets = 0, wins = 0, saving, onToggle, onEntries, onDelete, style }) {
  const monthly = kind === "monthly";
  const tickets = ticketsFor(employee, kind);
  const active = tickets > 0;
  const name = fullName(employee);

  return (
    <article
      style={style}
      className={`card group relative flex animate-fade-up items-center gap-3 overflow-hidden p-3.5 transition-colors ${
        active ? "hover:border-white/12" : "border-white/4 bg-transparent hover:border-white/10"
      }`}
    >
      <Link
        href={`/employee/${employee._id}`}
        className={`shrink-0 rounded-full outline-none transition duration-300 focus-visible:ring-2 focus-visible:ring-accent-400/60 ${
          active ? "" : "opacity-50 grayscale"
        }`}
      >
        <Avatar employee={employee} size={44} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/employee/${employee._id}`}
            className={`truncate font-display text-[15px] font-bold outline-none hover:text-accent-300 focus-visible:text-accent-300 ${
              active ? "text-ink-50" : "text-ink-300"
            }`}
          >
            {name}
          </Link>
          {SHOW_WIN_COUNTS && wins > 0 && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-400/10 px-1.5 py-0.5 text-[10px] font-bold text-accent-300"
              title={`${wins} ${wins === 1 ? "win" : "wins"}`}
            >
              <TrophyIcon size={10} />
              {wins}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-ink-500">{employee.email}</p>
        {/* Keyed by raffle so the control fades in fresh when the raffle changes. */}
        <div key={kind} className="mt-2 flex min-h-7 animate-fade-up items-center gap-2 [animation-duration:.4s]">
          {monthly ? (
            <>
              <EntryStepper value={employee.entries ?? 0} onChange={onEntries} label={name} />
              {active && (
                <span className="text-xs whitespace-nowrap text-ink-500 tabular-nums" title="Chance of winning this month's draw">
                  · {formatChance(tickets, totalTickets)}
                </span>
              )}
            </>
          ) : (
            <DrawToggle checked={active} onChange={onToggle} saving={saving} label={`${name} in the draw`} />
          )}
        </div>
      </div>

      {monthly && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-linear-to-r from-accent-400/30 via-accent-400/80 to-accent-300 transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${mostTickets ? tickets / mostTickets : 0})` }}
        />
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${name}`}
        className="btn btn-ghost btn-icon absolute top-2 right-2 h-8 w-8 text-ink-600 opacity-0 transition hover:text-red-300 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <TrashIcon size={15} />
      </button>
    </article>
  );
}
