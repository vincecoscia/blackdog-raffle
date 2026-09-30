import { useCallback, useState } from "react";
import Employees from "@/components/Employees";
import RaffleSlotMachine from "@/components/RaffleSlotMachine";
import RecentWinners from "@/components/RecentWinners";
import SignIn from "@/components/SignIn";
import useEmployees from "@/hooks/useEmployees";
import { getSession } from "@/lib/auth";
import { getEmployees, getRecentWinners, getWinCounts } from "@/lib/data";

export default function Home({ session, employees: initialEmployees, recent: initialRecent, winCounts: initialCounts }) {
  if (!session) return <SignIn />;
  return (
    <Dashboard employees={initialEmployees} recent={initialRecent} winCounts={initialCounts} />
  );
}

function Dashboard({ employees: initialEmployees, recent: initialRecent, winCounts: initialCounts }) {
  const { employees, savingIds, setInDraw, remove, setAllInDraw } = useEmployees(initialEmployees);
  const [recent, setRecent] = useState(initialRecent);
  const [winCounts, setWinCounts] = useState(initialCounts);

  // Called by the reel once it has landed — never before, so nothing spoils it.
  const handleWinner = useCallback(({ winner, raffle }) => {
    setRecent((list) => [{ ...raffle, winner }, ...list].slice(0, 8));
    setWinCounts((counts) => ({ ...counts, [winner._id]: (counts[winner._id] ?? 0) + 1 }));
  }, []);

  const handleRemove = useCallback(
    async (id) => {
      await remove(id);
      setRecent((list) => list.filter((r) => r.winner._id !== id));
    },
    [remove]
  );

  return (
    <>
      <RaffleSlotMachine employees={employees} lastWinner={recent[0] ?? null} onWinner={handleWinner} />
      <RecentWinners raffles={recent} />
      <Employees
        employees={employees}
        savingIds={savingIds}
        winCounts={winCounts}
        onToggle={setInDraw}
        onRemove={handleRemove}
        onSetAll={setAllInDraw}
      />
    </>
  );
}

export async function getServerSideProps({ req, res }) {
  const session = await getSession(req, res);
  if (!session) return { props: { session: null } };

  const [employees, recent, winCounts] = await Promise.all([getEmployees(), getRecentWinners(8), getWinCounts()]);
  return { props: { session, employees, recent, winCounts } };
}
