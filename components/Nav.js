import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Nav() {
  const { data: session } = useSession();
  const [modal, setModal] = useState(false);

  // Create a function that opens a modal to sign out
  const signOutModal = () => {
    // if modal is false, set modal to true and vice versa
    setModal(!modal);
  };
  return (
    <nav className="py-4 lg:px-36 p-5 bg-slate-800 text-white">
      <div className="container flex justify-between min-w-full">
        <div className="flex items-center">
          <Link href="/">
            <Image
              src="/assets/black_dog_logo.png"
              alt="Blackdog Logo"
              width={50}
              height={100}
            />
          </Link>
          <Link href="/">
            <h1 className="text-xl font-bold ml-3 uppercase tracking-[.1rem]">
              Blackdog Raffle
            </h1>
          </Link>
        </div>
        {session ? (
          <div className="flex items-center relative">
            {/*button onClick open modal*/}
            <button onClick={() => signOutModal()}>
              <Image
                src={session.user.image}
                alt="User Image"
                width={50}
                height={50}
                className="rounded-full"
              />
            </button>
            {/* If modal is true, display modal */}
            {modal ? (
              <div className="absolute top-16 right-0 bg-slate-600 pt-5 px-10 w-64 h-32 rounded shadow-md">
                <div className="">
                <h3 className=" mb-2 font-bold text-lg">{session.user.name}</h3>
                <hr/>
                  <button
                    className="bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4 w-full"
                    onClick={() => signOut()}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          null
        )}
      </div>
    </nav>
  );
}
