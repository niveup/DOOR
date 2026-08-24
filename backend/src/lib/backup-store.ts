import { signedFetch } from "./private-tracker-store";
import { getKolkataDateString, backupWeekOf } from "./time";

/**
 * Weekly JSON snapshots of the primary Postgres store, pushed to the
 * authenticated Cloudflare D1 backup table (audit GA-112 / F-ARC-2).
 * Private journal content is intentionally NOT included: it lives encrypted
 * in D1 already and never touches Postgres.
 */

const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

export type BackupBundle = Record<string, unknown>;


export async function collectBackupBundle(prisma: unknown): Promise<BackupBundle> {
  const db = prisma as Record<string, { findMany?: (a?: unknown) => Promise<unknown[]> }>;
  const grab = async (model: string) =>
    db[model]?.findMany ? await db[model].findMany() : [];
  const [settings, subjects, routinePlans, tasks, progressRatings, topicStatuses,
    weeklyReports, studyLogs, financeExpense, financeBudget, financeBill,
    interviewAttempts] = await Promise.all([
    grab("settings"), grab("subject"), grab("routinePlan"), grab("task"),
    grab("progressRating"), grab("topicStatus"), grab("weeklyReport"),
    grab("studyLog"), grab("financeExpense"), grab("financeBudget"),
    grab("financeBill"), grab("interviewAttempt"),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    excludedByDesign: ["Journal (encrypted in D1)", "AiCallLog (operational logs)", "ConceptExplanation (regenerable)"],
    tables: {
      settings, subjects, routinePlans, tasks, progressRatings, topicStatuses,
      weeklyReports, studyLogs,
      financeExpense, financeBudget, financeBill, interviewAttempts,
    },
  };
}

export async function pushBackup(
  prisma: unknown
): Promise<{ pushed: boolean; id?: string; bytes?: number; reason?: string }> {
  const bundle = await collectBackupBundle(prisma);
  const payload = JSON.stringify(bundle);
  if (Buffer.byteLength(payload) > MAX_PAYLOAD_BYTES) {
    return { pushed: false, reason: `backup exceeds ${MAX_PAYLOAD_BYTES} bytes` };
  }
  const weekOf = backupWeekOf();
  const body = JSON.stringify({
    id: `full-${weekOf}`,
    kind: "full",
    weekOf,
    createdAt: Date.now(),
    payload,
  });
  const result = await signedFetch("/v1/backups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!result || !result.ok) {
    return { pushed: false, reason: "D1 store unavailable or rejected the snapshot" };
  }
  return { pushed: true, id: `full-${weekOf}`, bytes: Buffer.byteLength(payload) };
}
