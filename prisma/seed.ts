import { PrismaClient } from "../src/generated/prisma";
import { WORKSPACE_DEPARTMENTS } from "../src/lib/workspace-departments";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Humans of SIB…");

  // Cities
  const cities = await Promise.all([
    prisma.city.upsert({ where: { slug: "noida" }, update: {}, create: { name: "Noida", slug: "noida", isHQ: true } }),
    prisma.city.upsert({ where: { slug: "pune" }, update: {}, create: { name: "Pune", slug: "pune" } }),
    prisma.city.upsert({ where: { slug: "indore" }, update: {}, create: { name: "Indore", slug: "indore" } }),
  ]);

  // Departments — canonical workspace list (see src/lib/workspace-departments.ts)
  const depts = [...WORKSPACE_DEPARTMENTS];

  for (const d of depts) {
    await prisma.department.upsert({
      where: { slug: d.slug },
      update: { name: d.name, emoji: d.emoji },
      create: { slug: d.slug, name: d.name, emoji: d.emoji },
    });
  }

  // Seed trainings
  const trainingSeed = [
    {
      title: "Welcome to Skillinabox",
      description: "Our story, mission, and how we empower women across India through doorstep skilling.",
      type: "SELF_PACED",
      durationMin: 30,
      category: "Culture",
    },
    {
      title: "Fashion & Beauty 101",
      description: "A ground-up primer on the world our learners enter — from sewing basics to the business of makeup.",
      type: "SELF_PACED",
      durationMin: 60,
      category: "Product",
    },
    {
      title: "Customer Empathy at SIB",
      description: "How we talk with learners. What to say, what to never say. Real transcripts.",
      type: "WORKSHOP",
      durationMin: 90,
      category: "CSAT",
    },
    {
      title: "Writing that converts",
      description: "Internal copywriting: from WhatsApp nudges to landing pages.",
      type: "SELF_PACED",
      durationMin: 45,
      category: "Marketing",
    },
    {
      title: "How our kits get made",
      description: "A walk through supply chain — from vendors to learner doorstep.",
      type: "LIVE",
      durationMin: 60,
      category: "Operations",
    },
  ] as const;

  for (const t of trainingSeed) {
    const existing = await prisma.training.findFirst({ where: { title: t.title } });
    if (!existing) await prisma.training.create({ data: t });
  }

  const librarySeed = [
    {
      title: "Atomic Habits",
      description: "Tiny changes, remarkable results — build better habits and break bad ones.",
      type: "READING" as const,
      author: "James Clear",
      durationMin: 180,
      category: "Growth",
      pointsAwarded: 75,
      isPublished: true,
      quiz: [
        {
          prompt: "What is the core idea behind habit stacking?",
          options: [
            { label: "Link a new habit to an existing one", isCorrect: true },
            { label: "Do all habits at once", isCorrect: false },
            { label: "Skip weekends", isCorrect: false },
          ],
        },
        {
          prompt: "The 1% improvement rule suggests that small daily gains compound over time.",
          options: [
            { label: "True", isCorrect: true },
            { label: "False", isCorrect: false },
          ],
        },
        {
          prompt: "Which framework describes cue, craving, response, and reward?",
          options: [
            { label: "The habit loop", isCorrect: true },
            { label: "The OKR cycle", isCorrect: false },
            { label: "The sales funnel", isCorrect: false },
          ],
        },
      ],
    },
    {
      title: "The 7 Habits of Highly Effective People",
      description: "Principles for personal and interpersonal effectiveness.",
      type: "READING" as const,
      author: "Stephen R. Covey",
      durationMin: 240,
      category: "Leadership",
      pointsAwarded: 80,
      isPublished: true,
      quiz: [
        {
          prompt: "Which habit focuses on envisioning desired outcomes before acting?",
          options: [
            { label: "Begin with the end in mind", isCorrect: true },
            { label: "Sharpen the saw", isCorrect: false },
            { label: "Think lose-win", isCorrect: false },
          ],
        },
        {
          prompt: "Synergy means valuing differences to create better solutions together.",
          options: [
            { label: "True", isCorrect: true },
            { label: "False", isCorrect: false },
          ],
        },
        {
          prompt: "Putting first things first is primarily about:",
          options: [
            { label: "Time management and priorities", isCorrect: true },
            { label: "Working longer hours", isCorrect: false },
            { label: "Avoiding collaboration", isCorrect: false },
          ],
        },
      ],
    },
    {
      title: "Google Digital Garage — Fundamentals of Digital Marketing",
      description: "Free certification course covering SEO, analytics, and online strategy.",
      type: "EXTERNAL_COURSE" as const,
      provider: "Google Digital Garage",
      externalUrl: "https://learndigital.withgoogle.com/digitalgarage",
      durationMin: 300,
      category: "Marketing",
      pointsAwarded: 100,
      isPublished: true,
      quiz: [
        {
          prompt: "SEO primarily helps your content:",
          options: [
            { label: "Rank better in search results", isCorrect: true },
            { label: "Print faster", isCorrect: false },
            { label: "Reduce payroll costs", isCorrect: false },
          ],
        },
        {
          prompt: "A call-to-action (CTA) tells users what to do next.",
          options: [
            { label: "True", isCorrect: true },
            { label: "False", isCorrect: false },
          ],
        },
        {
          prompt: "Which metric shows how many users completed a desired action?",
          options: [
            { label: "Conversion rate", isCorrect: true },
            { label: "Bounce height", isCorrect: false },
            { label: "Server uptime", isCorrect: false },
          ],
        },
      ],
    },
  ];

  for (const item of librarySeed) {
    const { quiz, ...data } = item;
    let training = await prisma.training.findFirst({ where: { title: data.title } });
    if (!training) {
      training = await prisma.training.create({ data });
    }
    const qCount = await prisma.trainingQuestion.count({ where: { trainingId: training.id } });
    if (qCount === 0) {
      for (let i = 0; i < quiz.length; i++) {
        const q = quiz[i]!;
        await prisma.trainingQuestion.create({
          data: {
            trainingId: training.id,
            prompt: q.prompt,
            sortOrder: i,
            options: { create: q.options },
          },
        });
      }
    }
  }

  const { LIA_CORE_DOCUMENTS } = await import("../src/lib/lia-core-documents");

  for (const d of LIA_CORE_DOCUMENTS) {
    await prisma.liaKnowledgeArticle.upsert({
      where: { slug: d.slug },
      update: {
        title: d.title,
        summary: d.summary,
        body: d.body,
        category: d.category,
        keywords: d.keywords,
        detailHref: d.detailHref ?? null,
        sortOrder: d.sortOrder,
        kind: "DOCUMENT",
        published: true,
      },
      create: {
        slug: d.slug,
        title: d.title,
        summary: d.summary,
        body: d.body,
        category: d.category,
        keywords: d.keywords,
        detailHref: d.detailHref ?? null,
        sortOrder: d.sortOrder,
        kind: "DOCUMENT",
        published: true,
      },
    });
  }

  console.log("✅ Seed complete.");
  console.log(
    `   ${cities.length} cities, ${depts.length} departments, ${trainingSeed.length + librarySeed.length} trainings, ${LIA_CORE_DOCUMENTS.length} LIA documents`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
