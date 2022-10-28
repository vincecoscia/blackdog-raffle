import Image from "next/image";

export default function Nav() {
  return (
    <nav className=" py-4 lg:px-48 p-5 bg-slate-800 text-white">
      <div className="container flex items-center">
        <Image
          src="/assets/black_dog_logo.png"
          alt="Blackdog Logo"
          width={50}
          height={100}
        />
        <h1 className="text-xl font-bold ml-3 uppercase tracking-[.1rem]">
          Blackdog Raffle
        </h1>
      </div>
    </nav>
  );
}
