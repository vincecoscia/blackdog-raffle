import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { toast } from "react-toastify";
import Avatar from "@/components/Avatar";
import DrawToggle from "@/components/DrawToggle";
import Field from "@/components/Field";
import Header from "@/components/Header";
import { ArrowLeftIcon, PlusIcon, Spinner } from "@/components/icons";
import { getSession } from "@/lib/auth";
import { api } from "@/lib/client";
import { fullName } from "@/lib/format";

const EMPTY = { firstName: "", lastName: "", email: "", imageURL: "", inDraw: true };

export default function CreateEmployee() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  const preview = { ...values, firstName: values.firstName || "New", lastName: values.lastName || "Teammate" };

  const submit = async (e) => {
    e.preventDefault();
    if (!values.firstName.trim() || !values.lastName.trim() || !values.email.trim()) {
      toast.error("First name, last name and email are required.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api("/api/employees", { method: "POST", body: values });
      toast.success(`${fullName(data)} is in the draw!`);
      router.push("/");
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Header title="Add teammate" />

      <Link href="/" className="btn btn-ghost -ml-3 mb-4 text-ink-400">
        <ArrowLeftIcon size={16} />
        Back to the draw
      </Link>

      <div className="grid animate-fade-up gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={submit} className="card p-6 sm:p-8">
          <p className="eyebrow">New teammate</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-ink-50">Add to the draw</h1>
          <p className="mt-2 text-sm text-ink-400">They&apos;ll show up on the reel as soon as they&apos;re in the draw.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Field label="First name" name="firstName" value={values.firstName} onChange={set} required autoFocus />
            <Field label="Last name" name="lastName" value={values.lastName} onChange={set} required />
            <Field
              label="Email"
              name="email"
              type="email"
              value={values.email}
              onChange={set}
              required
              className="sm:col-span-2"
            />
            <Field
              label="Photo URL"
              name="imageURL"
              type="url"
              value={values.imageURL}
              onChange={set}
              placeholder="https://…"
              hint="Optional. Without a photo they get a coloured initials avatar."
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <span className="label">This week&apos;s draw</span>
              <div className="pt-1">
                <DrawToggle checked={values.inDraw} onChange={(inDraw) => setValues((v) => ({ ...v, inDraw }))} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-2">
            <Link href="/" className="btn btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner size={16} /> : <PlusIcon size={16} />}
              Add teammate
            </button>
          </div>
        </form>

        <aside className="lg:pt-10">
          <p className="label">Preview</p>
          <div className="card flex items-center gap-3 p-4">
            <Avatar key={values.imageURL} employee={preview} size={48} />
            <div className="min-w-0">
              <p className="truncate font-display font-bold text-ink-50">{fullName(preview)}</p>
              <p className="truncate text-xs text-ink-400">{values.email || "email@blackdogadvertising.com"}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-500">This is how they&apos;ll look on the reel and the roster.</p>
        </aside>
      </div>
    </div>
  );
}

export async function getServerSideProps({ req, res }) {
  const session = await getSession(req, res);
  if (!session) return { redirect: { destination: "/", permanent: false } };
  return { props: { session } };
}
