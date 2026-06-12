"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    const res = await fetch("/api/admin/messages");
    if (res.ok) {
      setMessages(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleMarkRead = async (id: string, read: boolean) => {
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }
  };

  return (
    <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Messages
          </h1>
          <Link
            href="/admin"
            className="text-sm text-foreground/40 hover:text-accent transition-colors"
          >
            &larr; Dashboard
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-foreground/40">Loading...</p>
      ) : messages.length === 0 ? (
        <p className="text-foreground/40">No messages yet.</p>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                msg.read
                  ? "border-surface-border bg-surface"
                  : "border-accent/20 bg-accent/5"
              }`}
              onClick={() =>
                setExpanded(expanded === msg.id ? null : msg.id)
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-medium ${
                        msg.read ? "text-foreground/70" : "text-foreground"
                      }`}
                    >
                      {msg.name}
                    </span>
                    {!msg.read && (
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-foreground/50 truncate mt-0.5">
                    {msg.subject} &middot; {msg.email} &middot;{" "}
                    {formatDate(msg.createdAt)}
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 ml-4 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleMarkRead(msg.id, !msg.read)}
                    className="text-xs px-3 py-1 rounded border border-surface-border text-foreground/60 hover:text-foreground transition-colors"
                  >
                    {msg.read ? "Unread" : "Read"}
                  </button>
                  <button
                    onClick={() => handleDelete(msg.id)}
                    className="text-xs px-3 py-1 rounded border border-surface-border text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {expanded === msg.id && (
                <div className="mt-4 pt-4 border-t border-surface-border">
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {msg.body}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
