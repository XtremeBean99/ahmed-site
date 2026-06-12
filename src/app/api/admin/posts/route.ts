import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const postSchema = z.object({
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional().default(""),
  contentMd: z.string().min(1),
  coverImage: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  date: z.string().optional().nullable(),
  published: z.boolean().default(false),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const post = await prisma.post.create({
      data: {
        ...parsed.data,
        tags: parsed.data.tags
          ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        date: parsed.data.date ? new Date(parsed.data.date) : null,
      },
    });
    return NextResponse.json(post, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A post with that slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
