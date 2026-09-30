// The raffle lives on the home page now; keep old bookmarks working.
export async function getServerSideProps() {
  return { redirect: { destination: "/", permanent: true } };
}

export default function RaffleRedirect() {
  return null;
}
