import "dotenv/config";
import {
  PrismaClient,
  Role,
  Sentiment,
  FeedbackStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding LOOP database...");

  // Rebuild only the demo workspace; never erase unrelated tenant data.
  const workspace = await prisma.workspace.findFirst({ where: { name: "LOOP Demo Workspace" } }) ?? await prisma.workspace.create({ data: { name: "LOOP Demo Workspace" } });
  await prisma.feedbackTheme.deleteMany({ where: { feedback: { workspaceId: workspace.id } } });
  await prisma.embedding.deleteMany({ where: { feedback: { workspaceId: workspace.id } } });
  await prisma.feedback.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.theme.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.report.deleteMany({ where: { workspaceId: workspace.id } });

  // Create secure password hash
  const demoPasswordHash = await bcrypt.hash("Demo@123", 10);

  // Create demo users
  const userData = [
      {
        name: "Admin User",
        email: "admin@loop.demo",
        passwordHash: demoPasswordHash,
        role: Role.ADMIN,
        workspaceId: workspace.id,
      },
      {
        name: "Analyst User",
        email: "analyst@loop.demo",
        passwordHash: demoPasswordHash,
        role: Role.ANALYST,
        workspaceId: workspace.id,
      },
      {
        name: "Viewer User",
        email: "viewer@loop.demo",
        passwordHash: demoPasswordHash,
        role: Role.VIEWER,
        workspaceId: workspace.id,
      },
  ];
  for (const user of userData) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    if (existing && existing.workspaceId !== workspace.id) throw new Error(`Demo email ${user.email} belongs to a different workspace; refusing to move it.`);
    await prisma.user.upsert({ where: { email: user.email }, update: { name: user.name, passwordHash: demoPasswordHash, role: user.role }, create: user });
  }

  console.log(`👥 Ensured ${userData.length} demo users`);

  // Create themes
  const themes = await Promise.all([
    prisma.theme.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Product Quality" } },
      update: { description: "Feedback about product quality and reliability", color: "#3B82F6" },
      create: {
        name: "Product Quality",
        description: "Feedback about product quality and reliability",
        color: "#3B82F6",
        workspaceId: workspace.id,
      },
    }),
    prisma.theme.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Customer Support" } },
      update: { description: "Feedback about customer support experience", color: "#8B5CF6" },
      create: {
        name: "Customer Support",
        description: "Feedback about customer support experience",
        color: "#8B5CF6",
        workspaceId: workspace.id,
      },
    }),
    prisma.theme.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Pricing" } },
      update: { description: "Feedback about pricing and value", color: "#10B981" },
      create: {
        name: "Pricing",
        description: "Feedback about pricing and value",
        color: "#10B981",
        workspaceId: workspace.id,
      },
    }),
    prisma.theme.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "User Experience" } },
      update: { description: "Feedback about usability and interface", color: "#F59E0B" },
      create: {
        name: "User Experience",
        description: "Feedback about usability and interface",
        color: "#F59E0B",
        workspaceId: workspace.id,
      },
    }),
    prisma.theme.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: "Performance" } },
      update: { description: "Feedback about speed and performance", color: "#EF4444" },
      create: {
        name: "Performance",
        description: "Feedback about speed and performance",
        color: "#EF4444",
        workspaceId: workspace.id,
      },
    }),
  ]);

  console.log(`🏷️ Created ${themes.length} themes`);

  // Sample feedback
  const positiveFeedback = [
    "The product is very easy to use and the interface looks great.",
    "Customer support responded quickly and solved my problem.",
    "The latest update made the application much faster.",
    "I really like the new dashboard design.",
    "The product provides excellent value for the price.",
    "Everything works smoothly and I am very satisfied.",
    "The onboarding process was simple and helpful.",
    "The application loads quickly and feels responsive.",
  ];

  const neutralFeedback = [
    "The product works as expected for my daily tasks.",
    "The dashboard has the information I need.",
    "The support team provided the requested information.",
    "The current pricing plan is acceptable.",
    "The latest update changed several features.",
    "The application works normally most of the time.",
  ];

  const negativeFeedback = [
    "The application is sometimes slow when loading pages.",
    "I had difficulty finding the settings I needed.",
    "Customer support took too long to respond.",
    "The pricing is higher than I expected.",
    "The application crashed while I was using it.",
    "The new interface is confusing and difficult to navigate.",
    "Some features are not working correctly.",
    "The page takes too long to load.",
  ];

  const feedbackData = [];

  for (let i = 0; i < 120; i++) {
    let sentiment: Sentiment;
    let content: string;

    if (i % 3 === 0) {
      sentiment = Sentiment.POS;
      content = positiveFeedback[i % positiveFeedback.length];
    } else if (i % 3 === 1) {
      sentiment = Sentiment.NEU;
      content = neutralFeedback[i % neutralFeedback.length];
    } else {
      sentiment = Sentiment.NEG;
      content = negativeFeedback[i % negativeFeedback.length];
    }

    const channels = ["Support ticket", "App store review", "NPS survey", "Sales call note", "Community post"];
    const channel = channels[i % channels.length];

    feedbackData.push({
      content,
      channel,
      createdAt: new Date(Date.now() - (i % 60) * 86400000),
      sourceRef: `DEMO-${String(i + 1).padStart(3, "0")}`,
      customerLabel: `Customer ${i + 1}`,

      sentiment,

      sentimentScore:
        sentiment === Sentiment.POS
          ? 0.7 + (i % 3) * 0.1
          : sentiment === Sentiment.NEG
            ? -0.7 - (i % 3) * 0.1
            : 0,

      featureArea:
        i % 3 === 0
          ? "Product"
          : i % 3 === 1
            ? "Support"
            : "Performance",

      rationale:
        sentiment === Sentiment.POS
          ? "Customer expressed a positive experience."
          : sentiment === Sentiment.NEG
            ? "Customer reported a problem or dissatisfaction."
            : "Customer provided neutral feedback.",

      status:
        i % 4 === 0
          ? FeedbackStatus.NEW
          : i % 4 === 1
            ? FeedbackStatus.REVIEWED
            : FeedbackStatus.ACTIONED,

      workspaceId: workspace.id,
    });
  }

  const feedback = await prisma.feedback.createMany({
    data: feedbackData,
  });

  console.log(`💬 Created ${feedback.count} feedback items`);

  // Get created feedback
  const createdFeedback = await prisma.feedback.findMany({
    where: {
      workspaceId: workspace.id,
    },
    select: {
      id: true,
    },
  });

  // Connect feedback with themes
  for (let i = 0; i < createdFeedback.length; i++) {
    const theme = themes[i % themes.length];

    await prisma.feedbackTheme.create({
      data: {
        feedbackId: createdFeedback[i].id,
        themeId: theme.id,
        confidence: 0.75 + (i % 20) / 100,
      },
    });
  }

  console.log("🔗 Connected feedback with themes");

  console.log("✅ LOOP database seeded successfully!");
  console.log("🔐 Demo password for all users: Demo@123 (change before public deployment)");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
