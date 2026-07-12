import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

import { authAppearance } from "../../authAppearance";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F8] px-6 py-8 text-[#3E2E29]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col">
        <Link href="/" className="auth-back-link">
          Back
        </Link>

        <section className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
          <header className="space-y-4 text-center">
            <p className="font-serif text-4xl font-semibold tracking-normal">
              Preeve
            </p>
            <h1 className="font-serif text-5xl font-semibold tracking-normal">
              Create your account
            </h1>
          </header>

          <SignUp
            appearance={authAppearance}
            path="/sign-up"
            routing="path"
          />
        </section>
      </div>
    </main>
  );
}
