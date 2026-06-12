"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PostEditor } from "@/components/PostEditor";

export default function NewPostPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (data: {
    slug: string;
    title: string;
    excerpt: string;
    contentMd: string;
    coverImage: string;
    tags: string;
    date: string;
    published: boolean;
  }) => {
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to create post");
      setSaving(false);
      return;
    }

    const post = await res.json();
    router.push(`/admin/posts/${post.id}`);
  };

  return (
    <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
      <Link
        href="/admin/posts"
        className="text-sm text-foreground/40 hover:text-accent transition-colors"
      >
        &larr; All posts
      </Link>
      <h1 className="font-serif text-3xl font-bold text-foreground mb-8 mt-2">
        New post
      </h1>
      <PostEditor onSave={handleSave} saving={saving} error={error} />
    </div>
  );
}
