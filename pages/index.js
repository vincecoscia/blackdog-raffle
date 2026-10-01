import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import Employees from "@/components/Employees";
import RaffleSlotMachine from "@/components/RaffleSlotMachine";
import SignIn from "@/components/SignIn";
import useEmployees from "@/hooks/useEmployees";
import { getSession } from "@/lib/auth";
import { getEmployees, getWinCounts } from "@/lib/data";
import { SHOW_WIN_COUNTS } from "@/lib/features";
import { chatWebhookUrl } from "@/lib/google-chat";
import { DEFAULT_KIND, KIND_COOKIE, isRaffleKind } from "@/lib/raffles";

// Long enough to hop to a profile and back, short enough that next week opens on weekly.
const REMEMBER_KIND_SECONDS = 6 * 60 * 60;

export default function Home({ session, employees: initialEmployees, winCounts: initialCounts, chatEnabled, kind }) {
  if (!session) return <SignIn />;
  return <Dashboard employees={initialEmployees} winCounts={initialCounts} chatEnabled={chatEnabled} initialKind={kind} />;
}

function Dashboard({ employees: initialEmployees, winCounts: initialCounts, chatEnabled, initialKind }) {
  const router = useRouter();
  const { employees, savingIds, setInDraw, setEntries, remove, setAllInDraw, setAllEntries, changeAllEntries } =
    useEmployees(initialEmployees);
  const [winCounts, setWinCounts] = useState(initialCounts);
  const [kind, setKind] = useState(initialKind);
  const [drawing, setDrawing] = useState(false);

  // Which raffle is showing: kept in the URL (?raffle=monthly) so it can be
  // linked to, and in a short-lived cookie so a reload or a trip to a profile
  // comes back to it.
  const changeKind = useCallback(
    (next) => {
      setKind(next);
      document.cookie = `${KIND_COOKIE}=${next}; path=/; max-age=${REMEMBER_KIND_SECONDS}; samesite=lax`;
      const query = { ...router.query };
      if (next === DEFAULT_KIND) delete query.raffle;
      else query.raffle = next;
      router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
    },
    [router]
  );

  // Called by the reel once it has landed — never before, so nothing spoils it.
  const handleWinner = useCallback(({ winner }) => {
    setWinCounts((counts) => ({ ...counts, [winner._id]: (counts[winner._id] ?? 0) + 1 }));
  }, []);

  return (
    <>
      <RaffleSlotMachine
        employees={employees}
        kind={kind}
        onKindChange={changeKind}
        onBusyChange={setDrawing}
        onWinner={handleWinner}
        chatEnabled={chatEnabled}
      />
      <Employees
        employees={employees}
        kind={kind}
        onKindChange={changeKind}
        kindLocked={drawing}
        savingIds={savingIds}
        winCounts={winCounts}
        onToggle={setInDraw}
        onEntries={setEntries}
        onRemove={remove}
        onSetAll={setAllInDraw}
        onSetAllEntries={setAllEntries}
        onChangeAllEntries={changeAllEntries}
      />
    </>
  );
}

export async function getServerSideProps({ req, res, query }) {
  const session = await getSession(req, res);
  if (!session) return { props: { session: null } };

  // ?raffle=monthly wins; otherwise the raffle this browser was just running; otherwise weekly.
  const kind = [query.raffle, req.cookies?.[KIND_COOKIE]].find(isRaffleKind) ?? DEFAULT_KIND;
  const [employees, winCounts] = await Promise.all([getEmployees(), SHOW_WIN_COUNTS ? getWinCounts() : {}]);
  return { props: { session, employees, winCounts, chatEnabled: Boolean(chatWebhookUrl()), kind } };
}
