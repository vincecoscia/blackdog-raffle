import Image from "next/image";
import Link from "next/link";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { signOut, useSession } from "next-auth/react";
import { LogOutIcon, PlusIcon } from "./icons";

export default function Nav() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60">
          <Image
            src="/assets/black_dog_logo.png"
            alt=""
            width={34}
            height={38}
            priority
            className="drop-shadow-[0_0_14px_rgb(255_255_255/.25)] transition group-hover:scale-105"
          />
          <span className="font-display text-sm font-extrabold tracking-[0.14em] whitespace-nowrap text-ink-50 uppercase sm:text-base sm:tracking-[0.18em]">
            Blackdog <span className="text-accent-400">Raffle</span>
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-2">
            <Link href="/employee/create" className="btn btn-secondary hidden sm:inline-flex">
              <PlusIcon size={16} />
              Add teammate
            </Link>

            <Menu as="div" className="relative">
              <MenuButton className="flex items-center gap-2 rounded-full p-0.5 outline-none ring-white/10 transition hover:ring-2 focus-visible:ring-2 focus-visible:ring-accent-400/60 data-open:ring-2 data-open:ring-accent-400/60">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt={user.name ?? "Your account"}
                    width={36}
                    height={36}
                    className="rounded-full"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-sm font-bold">
                    {user.name?.[0] ?? "?"}
                  </span>
                )}
              </MenuButton>

              <MenuItems
                transition
                anchor="bottom end"
                className="z-50 mt-2 w-64 origin-top-right rounded-2xl border border-white/8 bg-ink-800/95 p-1.5 shadow-2xl backdrop-blur-xl outline-none transition duration-150 ease-out data-closed:scale-95 data-closed:opacity-0 [--anchor-gap:8px]"
              >
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-ink-50">{user.name}</p>
                  <p className="truncate text-xs text-ink-400">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-white/6" />
                <MenuItem>
                  <Link
                    href="/employee/create"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-200 data-focus:bg-white/6 data-focus:text-ink-50 sm:hidden"
                  >
                    <PlusIcon size={16} />
                    Add teammate
                  </Link>
                </MenuItem>
                <MenuItem>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-200 data-focus:bg-white/6 data-focus:text-ink-50"
                  >
                    <LogOutIcon size={16} />
                    Sign out
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        )}
      </div>
    </header>
  );
}
