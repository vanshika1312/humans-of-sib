import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Humans of SIB…");

  // Cities
  const cities = await Promise.all([
    prisma.city.upsert({ where: { slug: "noida" }, update: {}, create: { name: "Noida", slug: "noida", isHQ: true } }),
    prisma.city.upsert({ where: { slug: "pune" }, update: {}, create: { name: "Pune", slug: "pune" } }),
    prisma.city.upsert({ where: { slug: "indore" }, update: {}, create: { name: "Indore", slug: "indore" } }),
  ]);

  // Departments
  const depts = [
    { slug: "product", name: "Product", emoji: "🛠️" },
    { slug: "sales", name: "Sales", emoji: "💼" },
    { slug: "marketing", name: "Marketing", emoji: "📣" },
    { slug: "supply-chain", name: "Supply Chain", emoji: "📦" },
    { slug: "csat", name: "CSAT", emoji: "🤝" },
    { slug: "video", name: "Video", emoji: "🎬" },
    { slug: "hoe", name: "HoE", emoji: "🎓" },
    { slug: "hr", name: "HR", emoji: "👥" },
    { slug: "operations", name: "Operations", emoji: "⚙️" },
    { slug: "accounts-finance", name: "Accounts & Finance", emoji: "💰" },
  ];

  for (const d of depts) {
    await prisma.department.upsert({
      where: { slug: d.slug },
      update: { name: d.name, emoji: d.emoji },
      create: d,
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

  console.log("✅ Seed complete.");
  console.log(`   ${cities.length} cities, ${depts.length} departments, ${trainingSeed.length} trainings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
