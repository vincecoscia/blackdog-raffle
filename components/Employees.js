import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import EmployeeCard from "./EmployeeCard";
import EntryStepper, { MinusGlyph, PlusGlyph } from "./EntryStepper";
import ConfirmDialog from "./Modal";
import RaffleSwitch from "./RaffleSwitch";
import { CheckIcon, PlusIcon, SearchIcon, TicketIcon, TrashIcon, UsersIcon, XIcon } from "./icons";
import { fullName, plural } from "@/lib/format";
import { MAX_ENTRIES, tally, ticketsFor } from "@/lib/raffles";

const FILTER_LABELS = {
  weekly: { all: "Everyone", in: "In the draw", out: "Sitting out" },
  monthly: { all: "Everyone", in: "Has entries", out: "No entries" },
};

/** The roster's words for each raffle. */
function copyFor(kind, { people, tickets, outCount }) {
  if (kind === "monthly") {
    return {
      heading: tickets > 0 ? `${plural(tickets, "entry", "entries")} across ${plural(people, "teammate")}` : "No monthly entries yet",
      blurb:
        "Every entry is a ticket in the monthly hat — more entries, better odds." +
        (outCount > 0 && people > 0 ? ` ${plural(outCount, "person has", "people have")} none yet.` : ""),
    };
  }
  return {
    heading: `${plural(people, "teammate")} in the draw`,
    blurb:
      "Flip someone on once their timesheet is in — one entry each, no favourites." +
      (outCount > 0 ? ` ${plural(outCount, "person is", "people are")} sitting out.` : ""),
  };
}

/** The hat after `change` more entries for everyone (or fewer), with counts kept within 0..MAX_ENTRIES. */
function afterChange(employees, change) {
  let tickets = 0;
  let emptied = 0;
  for (const e of employees) {
    const before = e.entries ?? 0;
    const after = Math.min(MAX_ENTRIES, Math.max(0, before + change));
    tickets += after;
    if (before > 0 && after === 0) emptied += 1;
  }
  return { tickets, emptied };
}

/** Roster: search, bulk controls and the grid of teammate cards, for whichever raffle is showing. */
export default function Employees({
  employees,
  kind,
  onKindChange,
  kindLocked = false,
  savingIds,
  winCounts = {},
  onToggle,
  onEntries,
  onRemove,
  onSetAll,
  onSetAllEntries,
  onChangeAllEntries,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [bulk, setBulk] = useState(null); // "in" | "out" | "add" | "take" | "clear"
  const [amount, setAmount] = useState(1); // how many entries "add" / "take" changes everyone by
  const [lastBulk, setLastBulk] = useState("in"); // keeps the dialog's words while it closes
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const monthly = kind === "monthly";
  const { people, tickets } = tally(employees, kind);
  const outCount = employees.length - people;
  // Monthly cards get a bar sized against the biggest holder — only once
  // counts differ, since a row of identical full bars says nothing.
  const held = monthly ? employees.map((e) => ticketsFor(e, kind)).filter((t) => t > 0) : [];
  const mostTickets = held.length && Math.max(...held) > Math.min(...held) ? Math.max(...held) : 0;
  const copy = copyFor(kind, { people, tickets, outCount });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const active = ticketsFor(e, kind) > 0;
      if (filter === "in" && !active) return false;
      if (filter === "out" && active) return false;
      return !q || `${fullName(e)} ${e.email}`.toLowerCase().includes(q);
    });
  }, [employees, query, filter, kind]);

  const BULK = {
    in: {
      icon: <CheckIcon size={20} />,
      title: "Put everyone in the draw?",
      description: `All ${employees.length} teammates will have an entry in the next weekly draw.`,
      confirmLabel: "Everyone in",
      run: () => onSetAll(true),
      done: "Everyone is in the draw.",
    },
    out: {
      icon: <XIcon size={20} />,
      title: "Take everyone out of the draw?",
      description: "Nobody will be in the weekly draw until you flip them back on — handy at the start of a new week.",
      confirmLabel: "Everyone out",
      run: () => onSetAll(false),
      done: "Everyone is sitting out — flip people in as timesheets land.",
    },
    add: {
      icon: <PlusGlyph size={20} />,
      title: "Add entries for everyone",
      description: "Every teammate gets the same number of extra monthly entries.",
      confirmLabel: `Add ${plural(amount, "entry", "entries")} each`,
      run: () => onChangeAllEntries(amount),
      done: `Everyone got ${plural(amount, "more entry", "more entries")}.`,
      body: <ChangePreview employees={employees} tickets={tickets} change={amount} amount={amount} onAmount={setAmount} />,
    },
    take: {
      icon: <MinusGlyph size={20} />,
      title: "Take entries from everyone",
      description: "Every teammate loses the same number of monthly entries — nobody goes below 0.",
      confirmLabel: `Take ${plural(amount, "entry", "entries")} each`,
      run: () => onChangeAllEntries(-amount),
      done: `Took ${plural(amount, "entry", "entries")} from everyone.`,
      body: <ChangePreview employees={employees} tickets={tickets} change={-amount} amount={amount} onAmount={setAmount} />,
    },
    clear: {
      icon: <TicketIcon size={20} />,
      title: "Clear everyone's monthly entries?",
      description: `All ${employees.length} teammates go back to 0 entries — handy at the start of a new month. The weekly draw isn't affected.`,
      confirmLabel: "Clear entries",
      danger: true,
      run: () => onSetAllEntries(0),
      done: "Monthly entries cleared — a fresh month.",
    },
  };
  const action = BULK[bulk ?? lastBulk];
  const openBulk = (key) => {
    setLastBulk(key);
    setBulk(key);
    setAmount(1);
  };

  const confirmBulk = async () => {
    setBusy(true);
    try {
      await action.run();
      toast.success(action.done);
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
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="eyebrow">The team</p>
            <RaffleSwitch value={kind} onChange={onKindChange} disabled={kindLocked} size="sm" />
          </div>
          <div key={kind} className="animate-fade-up [animation-duration:.4s]">
            <h2 id="roster-heading" className="mt-2 font-display text-2xl font-extrabold text-ink-50">
              {copy.heading}
            </h2>
            <p className="mt-1 text-sm text-ink-400">{copy.blurb}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:shrink-0">
          {monthly ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => openBulk("add")} disabled={!employees.length}>
                <span className="text-accent-300">
                  <PlusGlyph />
                </span>
                Add to everyone
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => openBulk("take")} disabled={!tickets}>
                <MinusGlyph />
                Take from everyone
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => openBulk("clear")} disabled={!tickets}>
                <XIcon size={15} />
                Clear entries
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => openBulk("in")} disabled={!employees.length}>
                <CheckIcon size={15} className="text-accent-300" />
                Everyone in
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => openBulk("out")} disabled={!employees.length}>
                <XIcon size={15} />
                Everyone out
              </button>
            </>
          )}
        </div>
      </div>

      {employees.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Filter teammates" className="flex gap-1 rounded-xl border border-white/8 bg-white/3 p-1">
            {Object.entries(FILTER_LABELS[kind]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filter === key ? "bg-white/10 text-ink-50 shadow-sm" : "text-ink-400 hover:text-ink-100"
                }`}
              >
                {label}
                <span className="ml-1.5 text-ink-500 tabular-nums">
                  {key === "all" ? employees.length : key === "in" ? people : outCount}
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
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-400/10 text-accent-300">
            <UsersIcon size={26} />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold">No teammates yet</h3>
          <p className="mt-1 max-w-sm text-sm text-ink-400">
            Add the team, flip them into the draw, then hit Draw and let the dog do its thing.
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
              kind={kind}
              totalTickets={tickets}
              mostTickets={mostTickets}
              wins={winCounts[employee._id] ?? 0}
              saving={savingIds.has(employee._id)}
              onToggle={(inDraw) => onToggle(employee._id, inDraw)}
              onEntries={(entries) => onEntries(employee._id, entries)}
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
        danger={action.danger}
        icon={action.icon}
        title={action.title}
        description={action.description}
        confirmLabel={action.confirmLabel}
      >
        {action.body}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        danger
        icon={<TrashIcon size={20} />}
        title={deleting ? `Remove ${fullName(deleting)}?` : ""}
        description="Their profile will be permanently deleted. This can't be undone."
        confirmLabel="Remove"
      />
    </section>
  );
}

/** How many entries to add or take, and what the hat looks like afterwards. */
function ChangePreview({ employees, tickets, change, amount, onAmount }) {
  const after = afterChange(employees, change);
  return (
    <>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-white/8 bg-white/3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <EntryStepper
          value={amount}
          onChange={onAmount}
          min={1}
          suffix="each"
          label="everyone"
          inputLabel={change > 0 ? "Entries to add for everyone" : "Entries to take from everyone"}
        />
        <p className="text-xs whitespace-nowrap text-ink-400 tabular-nums" aria-live="polite">
          {tickets} → <span className="font-display text-sm font-extrabold text-accent-300">{after.tickets}</span> in the hat
        </p>
      </div>
      {after.emptied > 0 && (
        <p className="mt-2 text-xs text-ink-500">
          {plural(after.emptied, "teammate ends", "teammates end")} up with no entries.
        </p>
      )}
    </>
  );
}
