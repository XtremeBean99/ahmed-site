"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProjectEditor } from "@/components/ProjectEditor";

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (data: {
    slug: string;
    title: string;
    summary: string;
    descriptionMd: string;
    year: number;
    tags: string[];
    published: boolean;
    sortOrder: number;
  }) => {
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to create project");
      setSaving(false);
      return;
    }

    const project = await res.json();
    router.push(`/admin/projects/${project.id}`);
  };

  return (
    <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
      <Link
        href="/admin/projects"
        className="text-sm text-foreground/40 hover:text-accent transition-colors"
      >
        &larr; All projects
      </Link>
      <h1 className="font-serif text-3xl font-bold text-foreground mb-8 mt-2">
        New project
      </h1>
      <ProjectEditor onSave={handleSave} saving={saving} error={error} />
    </div>
  );
}
