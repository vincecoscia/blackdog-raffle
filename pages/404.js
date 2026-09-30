import Link from "next/link";
import Header from "@/components/Header";
import { ArrowLeftIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <Header title="Not found" />
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-ink-50">No ticket for that page</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-400">
        Whatever you were looking for isn&apos;t in the hat. Head back to the draw.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        <ArrowLeftIcon size={16} />
        Back to the draw
      </Link>
    </div>
  );
}
