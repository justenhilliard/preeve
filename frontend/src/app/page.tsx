import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/55">
            Preeve
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            Preeve frontend is running.
          </h1>
        </div>

        <div className="flex min-h-11 items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="h-11 rounded-md border border-foreground/20 px-5 text-sm font-medium transition hover:bg-foreground/5">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="h-11 rounded-md bg-foreground px-5 text-sm font-medium text-background transition hover:bg-foreground/85">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </section>
    </main>
  );
}
