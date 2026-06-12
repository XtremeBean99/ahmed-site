"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ProjectEditor } from "@/components/ProjectEditor";

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<{
    slug: string;
    title: string;
    summary: string;
    descriptionMd: string;
    year: number;
    tags: string[];
    published: boolean;
    sortOrder: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/projects/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          router.push("/admin/projects");
          return;
        }
        setProject(data);
        setLoading(false);
      });
  }, [id, router]);

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

    const res = await fetch(`/api/admin/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Failed to update project");
      setSaving(false);
      return;
    }

    const updated = await res.json();
    setProject(updated);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
        <p className="text-foreground/40">Loading...</p>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
      <Link
        href="/admin/projects"
        className="text-sm text-foreground/40 hover:text-accent transition-colors"
      >
        &larr; All projects
      </Link>
      <h1 className="font-serif text-3xl font-bold text-foreground mb-8 mt-2">
        Edit project
      </h1>
      <ProjectEditor
        initial={project}
        onSave={handleSave}
        saving={saving}
        error={error}
      />
    </div>
  );
}
