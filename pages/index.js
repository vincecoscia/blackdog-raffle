import { useCallback, useState } from "react";
import Employees from "@/components/Employees";
import RaffleSlotMachine from "@/components/RaffleSlotMachine";
import SignIn from "@/components/SignIn";
import useEmployees from "@/hooks/useEmployees";
import { getSession } from "@/lib/auth";
import { getEmployees, getWinCounts } from "@/lib/data";
import { SHOW_WIN_COUNTS } from "@/lib/features";
import { chatWebhookUrl } from "@/lib/google-chat";

export default function Home({ session, employees: initialEmployees, winCounts: initialCounts, chatEnabled }) {
  if (!session) return <SignIn />;
  return <Dashboard employees={initialEmployees} winCounts={initialCounts} chatEnabled={chatEnabled} />;
}

function Dashboard({ employees: initialEmployees, winCounts: initialCounts, chatEnabled }) {
  const { employees, savingIds, setInDraw, remove, setAllInDraw } = useEmployees(initialEmployees);
  const [winCounts, setWinCounts] = useState(initialCounts);

  // Called by the reel once it has landed — never before, so nothing spoils it.
  const handleWinner = useCallback(({ winner }) => {
    setWinCounts((counts) => ({ ...counts, [winner._id]: (counts[winner._id] ?? 0) + 1 }));
  }, []);

  return (
    <>
      <RaffleSlotMachine employees={employees} onWinner={handleWinner} chatEnabled={chatEnabled} />
      <Employees
        employees={employees}
        savingIds={savingIds}
        winCounts={winCounts}
        onToggle={setInDraw}
        onRemove={remove}
        onSetAll={setAllInDraw}
      />
    </>
  );
}

export async function getServerSideProps({ req, res }) {
  const session = await getSession(req, res);
  if (!session) return { props: { session: null } };

  const [employees, winCounts] = await Promise.all([getEmployees(), SHOW_WIN_COUNTS ? getWinCounts() : {}]);
  return { props: { session, employees, winCounts, chatEnabled: Boolean(chatWebhookUrl()) } };
}
