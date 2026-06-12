"use client";

import { useState } from "react";

interface PostData {
  slug: string;
  title: string;
  excerpt: string;
  contentMd: string;
  coverImage: string;
  tags: string;
  date: string;
  published: boolean;
}

interface PostEditorProps {
  initial?: PostData;
  onSave: (data: PostData) => Promise<void>;
  saving: boolean;
  error: string;
}

export function PostEditor({
  initial,
  onSave,
  saving,
  error,
}: PostEditorProps) {
  const [slug, setSlug] = useState(initial?.slug || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt || "");
  const [contentMd, setContentMd] = useState(initial?.contentMd || "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage || "");
  const [tags, setTags] = useState(initial?.tags || "");
  const [date, setDate] = useState(initial?.date || "");
  const [published, setPublished] = useState(initial?.published || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ slug, title, excerpt, contentMd, coverImage, tags, date, published });
  };

  const generateSlug = () => {
    setSlug(
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="title"
            className="block text-sm text-foreground/60 mb-2"
          >
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !slug && generateSlug()}
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
            required
          />
        </div>
        <div>
          <label
            htmlFor="slug"
            className="block text-sm text-foreground/60 mb-2"
          >
            Slug
          </label>
          <div className="flex gap-2">
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1 bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
              required
            />
            <button
              type="button"
              onClick={generateSlug}
              className="px-3 py-2 text-xs border border-surface-border rounded-lg text-foreground/60 hover:text-foreground transition-colors"
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="excerpt"
          className="block text-sm text-foreground/60 mb-2"
        >
          Excerpt
        </label>
        <input
          id="excerpt"
          type="text"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="content"
          className="block text-sm text-foreground/60 mb-2"
        >
          Content (Markdown)
        </label>
        <textarea
          id="content"
          rows={20}
          value={contentMd}
          onChange={(e) => setContentMd(e.target.value)}
          className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors font-mono text-sm resize-y"
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="coverImage"
            className="block text-sm text-foreground/60 mb-2"
          >
            Cover image path
          </label>
          <input
            id="coverImage"
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="/images/example.jpg"
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="date"
            className="block text-sm text-foreground/60 mb-2"
          >
            Display date (optional)
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="tags"
          className="block text-sm text-foreground/60 mb-2"
        >
          Tags (comma-separated)
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="pc-build, cooking, misc"
          className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="published"
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="w-4 h-4 rounded border-surface-border accent-accent"
        />
        <label htmlFor="published" className="text-sm text-foreground/60">
          Published
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-3 rounded-lg bg-accent text-background font-medium text-sm hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-shadow disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
