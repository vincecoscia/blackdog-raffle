import Link from "next/link";
import Avatar from "./Avatar";
import DrawToggle from "./DrawToggle";
import { TrashIcon, TrophyIcon } from "./icons";
import { fullName } from "@/lib/format";

export default function EmployeeCard({ employee, wins = 0, saving, onToggle, onDelete, style }) {
  const inDraw = employee.entries > 0;

  return (
    <article
      style={style}
      className={`card group relative flex animate-fade-up items-center gap-3 p-3.5 transition-colors ${
        inDraw ? "hover:border-white/12" : "border-white/4 bg-transparent hover:border-white/10"
      }`}
    >
      <Link
        href={`/employee/${employee._id}`}
        className={`shrink-0 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-accent-400/60 ${
          inDraw ? "" : "opacity-50 grayscale"
        }`}
      >
        <Avatar employee={employee} size={44} />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/employee/${employee._id}`}
            className={`truncate font-display text-[15px] font-bold outline-none hover:text-accent-300 focus-visible:text-accent-300 ${
              inDraw ? "text-ink-50" : "text-ink-300"
            }`}
          >
            {fullName(employee)}
          </Link>
          {wins > 0 && (
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
        <div className="mt-2">
          <DrawToggle checked={inDraw} onChange={onToggle} saving={saving} label={`${fullName(employee)} in the draw`} />
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${fullName(employee)}`}
        className="btn btn-ghost btn-icon absolute top-2 right-2 h-8 w-8 text-ink-600 opacity-0 transition hover:text-red-300 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <TrashIcon size={15} />
      </button>
    </article>
  );
}
