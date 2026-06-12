import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [postCount, projectCount, messageCount, unreadCount] =
    await Promise.all([
      prisma.post.count(),
      prisma.project.count(),
      prisma.message.count(),
      prisma.message.count({ where: { read: false } }),
    ]);

  const stats = [
    { label: "Posts", count: postCount, href: "/admin/posts" },
    { label: "Projects", count: projectCount, href: "/admin/projects" },
    { label: "Messages", count: messageCount, href: "/admin/messages" },
    { label: "Unread", count: unreadCount, href: "/admin/messages" },
  ];

  return (
    <div className="pt-24 pb-16 px-6 max-w-grid mx-auto">
      <div className="flex items-center justify-between mb-12">
        <h1 className="font-serif text-3xl font-bold text-foreground">
          Dashboard
        </h1>
        <SignOutButton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="block p-6 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors"
          >
            <p className="text-3xl font-bold font-serif text-accent">
              {stat.count}
            </p>
            <p className="text-sm text-foreground/50 mt-1">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link
          href="/admin/posts"
          className="p-6 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors"
        >
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">
            Manage posts
          </h2>
          <p className="text-sm text-foreground/50">
            Create, edit, publish, and delete blog posts
          </p>
        </Link>
        <Link
          href="/admin/projects"
          className="p-6 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors"
        >
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">
            Manage projects
          </h2>
          <p className="text-sm text-foreground/50">
            Create, edit, publish, and delete project entries
          </p>
        </Link>
        <Link
          href="/admin/messages"
          className="p-6 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors"
        >
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">
            View messages
          </h2>
          <p className="text-sm text-foreground/50">
            Read and manage contact form messages
          </p>
        </Link>
        <Link
          href="/"
          className="p-6 rounded-lg border border-surface-border bg-surface hover:bg-surface-hover transition-colors"
        >
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">
            View site
          </h2>
          <p className="text-sm text-foreground/50">
            Open the public site in a new tab
          </p>
        </Link>
      </div>
    </div>
  );
}
