import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "react-toastify";
import Avatar from "@/components/Avatar";
import DrawToggle from "@/components/DrawToggle";
import EntryStepper from "@/components/EntryStepper";
import Field from "@/components/Field";
import Header from "@/components/Header";
import ConfirmDialog from "@/components/Modal";
import { ArrowLeftIcon, PencilIcon, TicketIcon, TrashIcon, TrophyIcon, XIcon } from "@/components/icons";
import useEmployees from "@/hooks/useEmployees";
import { getSession } from "@/lib/auth";
import { api } from "@/lib/client";
import { getEmployeeWithWins, getEmployees } from "@/lib/data";
import { SHOW_WIN_COUNTS } from "@/lib/features";
import { formatLongDate, fullName, plural, relativeDate } from "@/lib/format";
import { formatChance, tally } from "@/lib/raffles";

export default function EmployeePage({ employee: initial, wins: initialWins, others }) {
  const router = useRouter();
  // The roster hook, for a roster of one: same optimistic saves as the home page.
  const {
    employees: [employee],
    savingIds,
    patch,
    setInDraw,
    setEntries,
  } = useEmployees([initial]);
  const [wins, setWins] = useState(initialWins);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [winToDelete, setWinToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  // Odds in each raffle, kept in step with this teammate's own controls.
  const weeklyPool = others.weekly + (employee.inDraw ? 1 : 0);
  const monthlyTotal = others.entries + employee.entries;
  const name = fullName(employee);

  const saveDetails = async (values) => {
    setBusy(true);
    try {
      const { data } = await api(`/api/employees/${employee._id}`, { method: "PUT", body: values });
      patch(employee._id, data);
      setEditing(false);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteEmployee = async () => {
    setBusy(true);
    try {
      await api(`/api/employees/${employee._id}`, { method: "DELETE" });
      toast.success(`${name} was removed.`);
      router.push("/");
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const deleteWin = async () => {
    setBusy(true);
    try {
      await api(`/api/raffles/${winToDelete._id}`, { method: "DELETE" });
      setWins((list) => list.filter((w) => w._id !== winToDelete._id));
      setWinToDelete(null);
      toast.success("Win removed from the record.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Header title={name} />

      <Link href="/" className="btn btn-ghost -ml-3 mb-4 text-ink-400">
        <ArrowLeftIcon size={16} />
        Back to the draw
      </Link>

      <section className="card animate-fade-up p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar employee={employee} size={96} priority className="text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-extrabold text-balance text-ink-50">{name}</h1>
            <p className="mt-1 truncate text-sm text-ink-400">{employee.email}</p>
            {SHOW_WIN_COUNTS && wins.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip border-accent-400/25 bg-accent-400/10 text-accent-300">
                  <TrophyIcon size={12} />
                  {plural(wins.length, "win")}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? <XIcon size={16} /> : <PencilIcon size={16} />}
              {editing ? "Cancel" : "Edit"}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              <TrashIcon size={16} />
              Remove
            </button>
          </div>
        </div>

        {editing && (
          <EditForm employee={employee} busy={busy} onSave={saveDetails} onCancel={() => setEditing(false)} />
        )}
      </section>

      <div
        className={`mt-4 grid animate-fade-up gap-4 [animation-delay:.08s] ${SHOW_WIN_COUNTS ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <Stat label="Weekly draw">
          <div className="pt-1">
            <DrawToggle
              checked={employee.inDraw}
              onChange={(next) => setInDraw(employee._id, next)}
              saving={savingIds.has(employee._id)}
              size="lg"
            />
          </div>
          <span className="mt-3 block text-xs text-ink-500">
            {employee.inDraw ? (
              <>
                <strong className="font-semibold text-ink-200">1 in {weeklyPool}</strong> chance this week ·{" "}
                {plural(weeklyPool, "teammate")} in the hat
              </>
            ) : (
              "Flip on once their timesheet is in."
            )}
          </span>
        </Stat>
        <Stat label="Monthly draw">
          <div className="pt-1">
            <EntryStepper value={employee.entries} onChange={(n) => setEntries(employee._id, n)} label={name} size="lg" />
          </div>
          <span className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
            <TicketIcon size={12} className="shrink-0" />
            {employee.entries > 0 ? (
              <span>
                <strong className="font-semibold text-ink-200">{formatChance(employee.entries, monthlyTotal)}</strong> chance
                this month · {employee.entries} of {plural(monthlyTotal, "entry", "entries")}
              </span>
            ) : (
              "No entries this month yet."
            )}
          </span>
        </Stat>
        {SHOW_WIN_COUNTS && (
          <Stat label="Wins">
            <span className="font-display text-4xl font-extrabold tabular-nums text-ink-50">{wins.length}</span>
            {wins[0] && <span className="mt-1 block text-xs text-ink-500">Last {relativeDate(wins[0].date)}</span>}
          </Stat>
        )}
      </div>

      {SHOW_WIN_COUNTS && (
        <section aria-labelledby="wins-heading" className="mt-10 animate-fade-up [animation-delay:.16s]">
          <p className="eyebrow">History</p>
          <h2 id="wins-heading" className="mt-1 font-display text-2xl font-extrabold text-ink-50">
            Raffle wins
          </h2>

          {wins.length === 0 ? (
            <p className="card mt-4 px-6 py-10 text-center text-sm text-ink-400">
              No wins yet. {employee.firstName}&apos;s time will come.
            </p>
          ) : (
            <ol className="card mt-4 divide-y divide-white/6">
              {wins.map((win, i) => (
                <li key={win._id} className="group flex items-center gap-4 px-5 py-4">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      i === 0 ? "bg-accent-400/15 text-accent-300" : "bg-white/5 text-ink-400"
                    }`}
                  >
                    <TrophyIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-50">{formatLongDate(win.date)}</p>
                    <p className="text-xs text-ink-500">
                      {relativeDate(win.date)}
                      {win.kind === "monthly"
                        ? ` · Monthly · ${win.entries} of ${plural(win.totalEntries, "entry", "entries")}`
                        : win.poolSize
                          ? ` · Weekly · 1 in ${win.poolSize}`
                          : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWinToDelete(win)}
                    aria-label={`Remove win from ${formatLongDate(win.date)}`}
                    className="btn btn-ghost btn-icon h-9 w-9 text-ink-500 hover:text-red-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                  >
                    <TrashIcon size={16} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteEmployee}
        busy={busy}
        danger
        icon={<TrashIcon size={20} />}
        title={`Remove ${name}?`}
        description="Their profile will be permanently deleted. This can't be undone."
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={Boolean(winToDelete)}
        onClose={() => setWinToDelete(null)}
        onConfirm={deleteWin}
        busy={busy}
        danger
        icon={<TrophyIcon size={20} />}
        title="Remove this win?"
        description={
          winToDelete
            ? `${name}'s win from ${formatLongDate(winToDelete.date)} will be struck from the record. This can't be undone.`
            : ""
        }
        confirmLabel="Remove win"
      />
    </div>
  );
}

function Stat({ label, children }) {
  return (
    <div className="card flex flex-col items-start p-5">
      <p className="label">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function EditForm({ employee, busy, onSave, onCancel }) {
  const [values, setValues] = useState({
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    imageURL: employee.imageURL ?? "",
  });
  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  return (
    <form
      className="mt-6 grid gap-4 border-t border-white/6 pt-6 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
    >
      <Field label="First name" name="firstName" value={values.firstName} onChange={set} required autoFocus />
      <Field label="Last name" name="lastName" value={values.lastName} onChange={set} required />
      <Field label="Email" name="email" type="email" value={values.email} onChange={set} required />
      <Field label="Photo URL" name="imageURL" type="url" value={values.imageURL} onChange={set} placeholder="https://…" />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Save changes
        </button>
      </div>
    </form>
  );
}

export async function getServerSideProps({ req, res, params }) {
  const session = await getSession(req, res);
  if (!session) return { redirect: { destination: "/", permanent: false } };

  const [result, employees] = await Promise.all([getEmployeeWithWins(params.id), getEmployees()]);
  if (!result) return { notFound: true };

  // Everyone else's share of each raffle; the page adds this teammate's own.
  const rest = employees.filter((e) => e._id !== result.employee._id);
  const others = { weekly: tally(rest, "weekly").people, entries: tally(rest, "monthly").tickets };
  const wins = SHOW_WIN_COUNTS ? result.wins : [];
  return { props: { session, employee: result.employee, wins, others } };
}
