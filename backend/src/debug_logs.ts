import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const subjectsCount = await prisma.subject.count();
  console.log("Database connection successful. Total subjects:", subjectsCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

