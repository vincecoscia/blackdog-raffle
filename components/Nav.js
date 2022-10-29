import Image from "next/image";
import Link from "next/link";

export default function Nav() {
  return (
    <nav className=" py-4 lg:px-36 p-5 bg-slate-800 text-white">
      <div className="container flex items-center">
      <Link
        href="/"
      >
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
    </nav>
  );
}
