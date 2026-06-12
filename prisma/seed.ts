import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── Projects ──────────────────────────────────────────────────────
  const projects = [
    {
      slug: "daydream-machine-custom-build",
      title: "Daydream Machine custom build",
      summary:
        "Bespoke hardware solution for a creative learning studio supporting neurodivergent young people. Full lifecycle: specification, procurement, build, deployment, handover.",
      descriptionMd: `## Daydream Machine custom build

**Client:** Daydream Machine, Fyshwick (Canberra creative learning studio)

**Brief:** End-to-end hardware consultancy for a studio supporting neurodivergent young people.

### Scope

- Full project lifecycle from component specification and procurement through to build, deployment and handover
- Architected a bespoke custom computer hardware solution tailored to the studio's creative workflows
- Managed the complete procurement process, balancing performance requirements with budget constraints
- On-site deployment, testing, and staff handover with documentation

### Outcome

A reliable, high-performance system that supports the studio's creative learning programs.`,
      year: 2024,
      tags: ["Hardware", "Consulting", "Project Management"],
      published: true,
      sortOrder: 1,
    },
    {
      slug: "xtreme-builds",
      title: "Xtreme Builds",
      summary:
        "Custom PC building under the xtremebuilds.com.au brand.",
      descriptionMd: `## Xtreme Builds

Custom PC building and system integration under the xtremebuilds.com.au brand.

### Services

- Bespoke PC assembly tailored to client requirements — gaming, creative workstations, and general-purpose systems
- Component selection and compatibility consulting
- System testing, benchmarking, and optimisation`,
      year: 2023,
      tags: ["Hardware", "PC Building", "Custom Systems"],
      published: true,
      sortOrder: 2,
    },
    {
      slug: "this-website",
      title: "This website",
      summary:
        "Full-stack Next.js site with a contact API, project showcase and blog CMS, built by AI agents from a written specification.",
      descriptionMd: `## This website

A full-stack Next.js personal website built from a written specification using AI agents.

### Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Motion (Framer Motion v12+)
- **Backend:** Prisma ORM, PostgreSQL (Neon), Next.js API routes
- **Auth:** bcrypt password verification, JWT session cookies (jose)
- **Email:** Resend for contact form delivery
- **Content:** Markdown blog posts rendered with react-markdown

### Features

- Project showcase served from a database
- Blog CMS with Markdown editing
- Contact form with rate limiting, honeypot spam protection, and email delivery
- Admin dashboard for managing content
- Full animation system: canvas particle background, scroll animations, page transitions`,
      year: 2025,
      tags: ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "AI"],
      published: true,
      sortOrder: 3,
    },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { slug: project.slug },
      update: project,
      create: project,
    });
  }

  // ── Blog posts ────────────────────────────────────────────────────
  const launchPost = {
    slug: "why-i-study-law-and-computing",
    title: "Why I study law and computing at the same time",
    excerpt:
      "Most people pick one. I could not, because the questions I find interesting sit exactly between the two.",
    contentMd: `Most people pick one. I could not, because the questions I find interesting sit exactly between the two. Who is liable when a model gives bad advice? What does "explainability" mean when a statute demands reasons for a decision? How do you regulate a system whose behaviour its own developers cannot fully predict?

Working in a pharmacy makes this concrete. Every script I help dispense moves through a chain of regulation: scheduling, storage, recording, counselling. The rules work because they were written for processes people can inspect. AI breaks that assumption, and the law is still catching up. That gap is where I want to work.

This blog will track what I learn along the way: case notes, AI regulation developments in Australia, and the occasional build log.`,
    published: true,
  };

  await prisma.post.upsert({
    where: { slug: launchPost.slug },
    update: launchPost,
    create: launchPost,
  });

  console.log("✅ Seed complete — 3 projects, 1 blog post inserted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
