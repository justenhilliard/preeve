import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

import { authAppearance } from "../../authAppearance";

export default function SignInPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAF9F8] px-6 py-8 text-[#3E2E29]">
      <div aria-hidden="true" className="grain-overlay" />

      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 z-0 h-[48vh] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 100"
      >
        <path
          d={
            "M0,50 C120,38 240,62 360,50 C480,38 600,62 720,50 " +
            "C840,38 960,62 1080,50 C1200,38 1320,62 1440,50 " +
            "L1440,100 L0,100 Z"
          }
          fill="#3E2E29"
        />
        <path
          className={
            "[filter:drop-shadow(0_14px_10px_rgba(0,0,0,0.55))_" +
            "drop-shadow(0_28px_32px_rgba(0,0,0,0.4))]"
          }
          d={
            "M0,50 C120,38 240,62 360,50 C480,38 600,62 720,50 " +
            "C840,38 960,62 1080,50 C1200,38 1320,62 1440,50"
          }
          fill="none"
          stroke="#8A9A7B"
          strokeLinecap="round"
          strokeWidth={4}
        />
      </svg>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col">
        <Link href="/" className="auth-back-link">
          Back
        </Link>

        <section className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
          <header className="animate-fade-up space-y-4 text-center">
            <p className="font-serif text-4xl font-semibold tracking-normal">
              Preeve
            </p>
            <h1 className="font-serif text-5xl font-semibold tracking-normal">
              Log in to your account
            </h1>
          </header>

          <SignIn
            appearance={authAppearance}
            path="/sign-in"
            routing="path"
          />
        </section>
      </div>
    </main>
  );
}
