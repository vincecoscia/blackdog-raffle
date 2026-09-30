import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { GoogleIcon, Spinner } from "./icons";

const ERRORS = {
  AccessDenied: "That Google account isn't on the Blackdog list. Try your work email.",
  OAuthSignin: "Google sign-in couldn't start. Please try again.",
  OAuthCallback: "Google sign-in didn't complete. Please try again.",
  Callback: "Something went wrong finishing sign-in. Please try again.",
  default: "Sign-in failed. Please try again.",
};

export default function SignIn() {
  const { query } = useRouter();
  const [loading, setLoading] = useState(false);
  const error = query.error ? (ERRORS[query.error] ?? ERRORS.default) : null;

  return (
    <div className="relative flex min-h-[70dvh] items-center justify-center overflow-hidden">
      {/* Drifting mint orbs behind the card. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute top-[5%] left-[18%] h-56 w-56 animate-float rounded-full bg-accent-400/15 blur-[90px]" />
        <div className="absolute right-[15%] bottom-[8%] h-64 w-64 animate-float rounded-full bg-accent-300/10 blur-[100px] [animation-delay:-7s]" />
      </div>

      <div className="card relative w-full max-w-md animate-fade-up bg-ink-900/80 p-8 text-center backdrop-blur-xl sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/4 ring-1 ring-white/8">
          <Image src="/assets/black_dog_logo.png" alt="" width={48} height={52} priority />
        </div>
        <p className="eyebrow mt-6">Blackdog Advertising</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink-50">The Raffle</h1>
        <p className="mt-2 text-sm text-ink-400">Sign in with your Blackdog Google account to run the weekly draw.</p>

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            signIn("google", { callbackUrl: "/" });
          }}
          disabled={loading}
          className="btn mt-7 h-12 w-full bg-white text-ink-950 hover:bg-ink-100 active:translate-y-px"
        >
          {loading ? <Spinner size={18} /> : <GoogleIcon size={18} />}
          Continue with Google
        </button>
      </div>
    </div>
  );
}
