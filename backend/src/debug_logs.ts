import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const log = await prisma.aiCallLog.findFirst({
    where: { surface: "explainer" },
    orderBy: { createdAt: "desc" }
  });
  
  if (log) {
    console.log("Log ID:", log.logId);
    console.log("Success:", log.success);
    console.log("ErrorMessage:", log.errorMessage);
    console.log("--- RAW RESPONSE ---");
    console.log(log.responsePreview);
    console.log("--------------------");
  } else {
    console.log("No logs found.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
