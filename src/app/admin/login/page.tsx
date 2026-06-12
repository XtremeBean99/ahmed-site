"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("Incorrect password");
        setLoading(false);
        return;
      }

      const redirect = searchParams.get("redirect") || "/admin";
      router.push(redirect);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-sm"
    >
      <h1 className="font-serif text-2xl font-bold text-foreground mb-8 text-center">
        Admin login
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-sm text-foreground/60 mb-2"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
            autoFocus
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-accent text-background font-medium text-sm hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-shadow disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </motion.div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Suspense fallback={<p className="text-foreground/40">Loading...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
