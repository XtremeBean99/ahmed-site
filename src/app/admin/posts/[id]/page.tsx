"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { PostEditor } from "@/components/PostEditor";

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [post, setPost] = useState<{
    slug: string;
    title: string;
    excerpt: string;
    contentMd: string;
    published: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/posts/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/admin/posts");
          return;
        }
        setPost(data);
        setLoading(false);
      });
  }, [id, router]);

  const handleSave = async (data: {
    slug: string;
    title: string;
    excerpt: string;
    contentMd: string;
    published: boolean;
  }) => {
    setSaving(true);
    setError("");

    const res = await fetch(`/api/admin/posts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to update post");
      setSaving(false);
      return;
    }

    const updated = await res.json();
    setPost(updated);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
        <p className="text-foreground/40">Loading...</p>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
      <Link
        href="/admin/posts"
        className="text-sm text-foreground/40 hover:text-accent transition-colors"
      >
        &larr; All posts
      </Link>
      <h1 className="font-serif text-3xl font-bold text-foreground mb-8 mt-2">
        Edit post
      </h1>
      <PostEditor
        initial={post}
        onSave={handleSave}
        saving={saving}
        error={error}
      />
    </div>
  );
}
