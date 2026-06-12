"use client";

import { useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

function FloatingInput({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  multiline = false,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const floating = focused || value.length > 0;

  const inputClasses =
    "w-full bg-transparent border-b border-surface-border text-foreground py-3 outline-none transition-colors focus:border-accent placeholder-transparent";

  return (
    <div className="relative mb-6">
      <motion.label
        htmlFor={name}
        className={`absolute left-0 text-sm transition-all duration-200 pointer-events-none ${
          floating
            ? "-top-5 text-xs text-accent"
            : "top-3 text-foreground/40"
        }`}
      >
        {label}
      </motion.label>
      {multiline ? (
        <textarea
          id={name}
          name={name}
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={`${inputClasses} resize-none`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={inputClasses}
          autoComplete={type === "email" ? "email" : "off"}
        />
      )}
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}

export function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    website: "", // honeypot
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const updateField = (field: string) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrors({});
    setErrorMsg("");

    const parsed = contactSchema.safeParse({
      name: form.name,
      email: form.email,
      subject: form.subject,
      message: form.message,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const [key, msgs] of Object.entries(
        parsed.error.flatten().fieldErrors
      )) {
        fieldErrors[key] = msgs?.[0] || "Invalid";
      }
      setErrors(fieldErrors);
      setStatus("idle");
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 429) {
          setErrorMsg(data.error || "Too many requests. Please try again later.");
        } else {
          setErrorMsg("Failed to send message. Please try again.");
        }
        setStatus("error");
        return;
      }

      setStatus("success");
      setForm({ name: "", email: "", subject: "", message: "", website: "" });
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Honeypot — hidden from users */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(e) => updateField("website")(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="absolute opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      <FloatingInput
        label="Name"
        name="name"
        value={form.name}
        onChange={updateField("name")}
        error={errors.name}
      />
      <FloatingInput
        label="Email"
        name="email"
        type="email"
        value={form.email}
        onChange={updateField("email")}
        error={errors.email}
      />
      <FloatingInput
        label="Subject"
        name="subject"
        value={form.subject}
        onChange={updateField("subject")}
        error={errors.subject}
      />
      <FloatingInput
        label="Message"
        name="message"
        value={form.message}
        onChange={updateField("message")}
        error={errors.message}
        multiline
      />

      {errorMsg && (
        <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
      )}

      <SubmitButton status={status} />
    </form>
  );
}

function SubmitButton({ status }: { status: string }) {
  return (
    <motion.button
      type="submit"
      disabled={status === "loading" || status === "success"}
      className={`relative inline-flex items-center gap-3 px-8 py-3 rounded-lg font-medium text-sm overflow-hidden transition-colors ${
        status === "success"
          ? "bg-green-600 text-white"
          : "bg-accent text-background hover:shadow-[0_0_20px_rgba(45,212,191,0.3)]"
      } disabled:opacity-70`}
      whileTap={{ scale: 0.98 }}
    >
      {status === "loading" && (
        <motion.span
          className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
        />
      )}

      {status === "success" && (
        <motion.svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <motion.path
            d="M4 10l4 4 8-8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          />
        </motion.svg>
      )}

      <span>
        {status === "loading"
          ? "Sending..."
          : status === "success"
          ? "Message sent"
          : "Send message"}
      </span>
    </motion.button>
  );
}
