"use client";

import { useState } from "react";

interface ProjectData {
  slug: string;
  title: string;
  summary: string;
  descriptionMd: string;
  year: number;
  tags: string[];
  published: boolean;
  sortOrder: number;
}

interface ProjectEditorProps {
  initial?: ProjectData;
  onSave: (data: ProjectData) => Promise<void>;
  saving: boolean;
  error: string;
}

export function ProjectEditor({
  initial,
  onSave,
  saving,
  error,
}: ProjectEditorProps) {
  const [slug, setSlug] = useState(initial?.slug || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [summary, setSummary] = useState(initial?.summary || "");
  const [descriptionMd, setDescriptionMd] = useState(
    initial?.descriptionMd || ""
  );
  const [year, setYear] = useState(initial?.year || new Date().getFullYear());
  const [tagsStr, setTagsStr] = useState(
    (initial?.tags || []).join(", ")
  );
  const [published, setPublished] = useState(initial?.published || false);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      slug,
      title,
      summary,
      descriptionMd,
      year,
      tags,
      published,
      sortOrder,
    });
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
          htmlFor="summary"
          className="block text-sm text-foreground/60 mb-2"
        >
          Summary
        </label>
        <input
          id="summary"
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
          required
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm text-foreground/60 mb-2"
        >
          Description (Markdown)
        </label>
        <textarea
          id="description"
          rows={12}
          value={descriptionMd}
          onChange={(e) => setDescriptionMd(e.target.value)}
          className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors font-mono text-sm resize-y"
          required
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <label
            htmlFor="year"
            className="block text-sm text-foreground/60 mb-2"
          >
            Year
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || 0)}
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
            required
          />
        </div>
        <div>
          <label
            htmlFor="sortOrder"
            className="block text-sm text-foreground/60 mb-2"
          >
            Sort order
          </label>
          <input
            id="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
          />
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
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-foreground outline-none focus:border-accent transition-colors"
            placeholder="Hardware, PC Building"
          />
        </div>
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
