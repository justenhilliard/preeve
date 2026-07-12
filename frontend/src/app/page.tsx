import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground"
    >
      <section className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <p className="font-sans text-sm font-medium uppercase tracking-[0.18em] text-[#4A413C]">
            Preeve
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-normal sm:text-5xl">
            Preeve frontend is running.
          </h1>
        </div>

        <div className="flex min-h-11 items-center gap-3">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="home-auth-link home-auth-link-secondary"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="home-auth-link home-auth-link-primary"
            >
              Sign up
            </Link>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </section>
    </main>
  );
}
