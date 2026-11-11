"use client";
import { Suspense, useEffect } from "react";
import { Background } from "@/components/creem/landing/background";
import { TerminalButton } from "@/components/ui/terminal-button";
import { useState, FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function SigninPage() {
  const router = useRouter();
  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) router.replace("/dashboard");
    });
  }, [router]);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden">
      <Background />
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-12 flex flex-col items-center">
        <h1 className="font-mono text-2xl md:text-3xl text-white mb-8 text-center select-none">
          <span className="text-[#ffbe98]">$</span> Sign in to Creem
        </h1>
        <Suspense
          fallback={
            <div className="text-neutral-400 font-mono">Loading...</div>
          }
        >
          <SigninForm />
        </Suspense>
      </main>
    </div>
  );
}

interface SigninFormState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
}

function SigninForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [state, setState] = useState<SigninFormState>({
    isLoading: false,
    hasError: false,
    errorMessage: "",
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ isLoading: true, hasError: false, errorMessage: "" });
    try {
      const { data, error } = await authClient.signIn.email(
        {
          email: form.email,
          password: form.password,
          callbackURL: `/dashboard`,
        },
        {
          onRequest: (ctx) => {
            console.log("Requesting signin", ctx);
          },
          onSuccess: (ctx) => {
            console.log("Signin successful", ctx);
          },
          onError: (ctx) => {
            console.error("Signin error", ctx);
            setState({
              isLoading: false,
              hasError: true,
              errorMessage: ctx.error.message,
            });
          },
        },
      );

      if (error) {
        throw error;
      }

      // Redirect on success
      window.location.href = "/dashboard";
    } catch (err: any) {
      setState({
        isLoading: false,
        hasError: true,
        errorMessage: err?.message || "Sign in failed",
      });
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full flex flex-col gap-4 bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-lg"
    >
      <label className="font-mono text-sm text-neutral-300" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#ffbe98]"
        value={form.email}
        onChange={handleChange}
        disabled={state.isLoading}
      />
      <label className="font-mono text-sm text-neutral-300" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#ffbe98]"
        value={form.password}
        onChange={handleChange}
        disabled={state.isLoading}
      />
      <TerminalButton
        type="submit"
        className="mt-4 w-full justify-center"
        disabled={state.isLoading}
        prompt={"$"}
        command={state.isLoading ? "signing..." : "signin"}
        path={form.email ? form.email : "/user"}
      >
        {state.isLoading ? "Signing in..." : "Sign in"}
      </TerminalButton>
      {state.hasError && (
        <div className="text-red-400 font-mono text-xs mt-2">
          {state.errorMessage}
        </div>
      )}
    </form>
  );
}
