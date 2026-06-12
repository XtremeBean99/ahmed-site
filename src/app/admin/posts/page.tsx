"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  published: boolean;
  createdAt: string;
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    const res = await fetch("/api/admin/posts");
    if (res.ok) {
      setPosts(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleTogglePublish = async (post: Post) => {
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !post.published }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    }
  };

  return (
    <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Posts
          </h1>
          <Link
            href="/admin"
            className="text-sm text-foreground/40 hover:text-accent transition-colors"
          >
            &larr; Dashboard
          </Link>
        </div>
        <Link
          href="/admin/posts/new"
          className="px-4 py-2 rounded-lg bg-accent text-background font-medium text-sm hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-shadow"
        >
          New post
        </Link>
      </div>

      {loading ? (
        <p className="text-foreground/40">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-foreground/40">No posts yet.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between p-4 rounded-lg border border-surface-border bg-surface"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="font-medium text-foreground hover:text-accent transition-colors truncate"
                  >
                    {post.title}
                  </Link>
                  {post.published ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 shrink-0">
                      Published
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/40 shrink-0">
                      Draft
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground/40 mt-1">
                  /{post.slug} &middot; {formatDate(post.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  onClick={() => handleTogglePublish(post)}
                  className="text-xs px-3 py-1 rounded border border-surface-border text-foreground/60 hover:text-foreground hover:border-accent/50 transition-colors"
                >
                  {post.published ? "Unpublish" : "Publish"}
                </button>
                <Link
                  href={`/admin/posts/${post.id}`}
                  className="text-xs px-3 py-1 rounded border border-surface-border text-foreground/60 hover:text-foreground hover:border-accent/50 transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(post.id)}
                  className="text-xs px-3 py-1 rounded border border-surface-border text-red-400 hover:text-red-300 hover:border-red-500/50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
