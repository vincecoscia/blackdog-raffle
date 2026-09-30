import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import EmployeeCard from "./EmployeeCard";
import ConfirmDialog from "./Modal";
import { CheckIcon, PlusIcon, SearchIcon, TrashIcon, UsersIcon, XIcon } from "./icons";
import { fullName, plural } from "@/lib/format";

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "in", label: "In the draw" },
  { key: "out", label: "Sitting out" },
];

/** Roster: search, everyone-in/out controls and the grid of teammate cards. */
export default function Employees({ employees, savingIds, winCounts = {}, onToggle, onRemove, onSetAll }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [bulk, setBulk] = useState(null); // true = everyone in, false = everyone out
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const inCount = employees.filter((e) => e.entries > 0).length;
  const outCount = employees.length - inCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (filter === "in" && e.entries === 0) return false;
      if (filter === "out" && e.entries > 0) return false;
      return !q || `${fullName(e)} ${e.email}`.toLowerCase().includes(q);
    });
  }, [employees, query, filter]);

  const confirmBulk = async () => {
    setBusy(true);
    try {
      await onSetAll(bulk);
      toast.success(bulk ? "Everyone is in the draw." : "Everyone is sitting out — flip people in as timesheets land.");
      setBulk(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await onRemove(deleting._id);
      toast.success(`${fullName(deleting)} was removed.`);
      setDeleting(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="roster-heading" className="mt-14">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">The team</p>
          <h2 id="roster-heading" className="mt-1 font-display text-2xl font-extrabold text-ink-50">
            {plural(inCount, "teammate")} in the draw
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Flip someone on once their timesheet is in — one entry each, no favourites.
            {outCount > 0 && ` ${plural(outCount, "person is", "people are")} sitting out.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setBulk(true)} disabled={!employees.length}>
            <CheckIcon size={15} className="text-gold-300" />
            Everyone in
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setBulk(false)} disabled={!employees.length}>
            <XIcon size={15} />
            Everyone out
          </button>
        </div>
      </div>

      {employees.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filter teammates" className="flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f.key ? "bg-white/10 text-ink-50 shadow-sm" : "text-ink-400 hover:text-ink-100"
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-ink-500 tabular-nums">
                  {f.key === "all" ? employees.length : f.key === "in" ? inCount : outCount}
                </span>
              </button>
            ))}
          </div>
          <label className="relative block">
            <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a teammate"
              aria-label="Find a teammate"
              className="input pl-9 sm:w-64"
            />
          </label>
        </div>
      )}

      {employees.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-300">
            <UsersIcon size={26} />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold">No teammates yet</h3>
          <p className="mt-1 max-w-sm text-sm text-ink-400">
            Add the team, flip them into the draw, then hit Draw and let the reel do its thing.
          </p>
          <Link href="/employee/create" className="btn btn-primary mt-6">
            <PlusIcon size={16} />
            Add your first teammate
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="card mt-4 px-6 py-10 text-center text-sm text-ink-400">
          {query ? <>Nobody matches &ldquo;{query}&rdquo;.</> : "Nobody here."}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((employee, i) => (
            <EmployeeCard
              key={employee._id}
              employee={employee}
              wins={winCounts[employee._id] ?? 0}
              saving={savingIds.has(employee._id)}
              onToggle={(inDraw) => onToggle(employee._id, inDraw)}
              onDelete={() => setDeleting(employee)}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={bulk !== null}
        onClose={() => setBulk(null)}
        onConfirm={confirmBulk}
        busy={busy}
        icon={bulk ? <CheckIcon size={20} /> : <XIcon size={20} />}
        title={bulk ? "Put everyone in the draw?" : "Take everyone out of the draw?"}
        description={
          bulk
            ? `All ${employees.length} teammates will have an entry in the next draw.`
            : `Nobody will be in the draw until you flip them back on — handy at the start of a new week.`
        }
        confirmLabel={bulk ? "Everyone in" : "Everyone out"}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        danger
        icon={<TrashIcon size={20} />}
        title={deleting ? `Remove ${fullName(deleting)}?` : ""}
        description="Their profile and win history will be permanently deleted. This can't be undone."
        confirmLabel="Remove"
      />
    </section>
  );
}
