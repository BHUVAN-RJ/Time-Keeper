import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { parseCustomExcludeLines } from "@/lib/google-calendar/filters";
import { eq } from "drizzle-orm";

export async function getCalendarExcludeCustomLines(
  userId: string,
): Promise<string[]> {
  const [row] = await db
    .select({ calendarExcludePatterns: userPreferences.calendarExcludePatterns })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return parseCustomExcludeLines(row?.calendarExcludePatterns);
}

export async function saveCalendarExcludeCustomLines(
  userId: string,
  raw: string,
): Promise<string[]> {
  const lines = parseCustomExcludeLines(raw);
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId,
      calendarExcludePatterns: lines.length > 0 ? lines.join("\n") : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        calendarExcludePatterns: lines.length > 0 ? lines.join("\n") : null,
        updatedAt: now,
      },
    });
  return lines;
}
