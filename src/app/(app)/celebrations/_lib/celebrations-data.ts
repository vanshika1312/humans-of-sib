import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/user-display-name";
import {
  CELEBRATIONS_HORIZON_DAYS,
  daysUntil,
  nextOccurrence,
  startOfDay,
  workAnniversaryYears,
  type CelebrationEntry,
} from "@/lib/celebrations";

const userSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  image: true,
  birthday: true,
  joinedAt: true,
  department: { select: { name: true, emoji: true } },
  city: { select: { name: true } },
} as const;

export async function loadCelebrationsData() {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: userSelect,
  });

  const today = startOfDay();
  const entries: CelebrationEntry[] = [];

  for (const u of users) {
    const name = displayName(u);
    const base = {
      userId: u.id,
      name,
      image: u.image,
      department: u.department,
      cityName: u.city?.name ?? null,
    };

    if (u.birthday) {
      const next = nextOccurrence(u.birthday, today);
      const until = daysUntil(next, today);
      if (until < CELEBRATIONS_HORIZON_DAYS) {
        entries.push({
          ...base,
          kind: "birthday",
          next,
          daysUntil: until,
          isToday: until === 0,
        });
      }
    }

    const annivNext = nextOccurrence(u.joinedAt, today);
    const years = workAnniversaryYears(u.joinedAt, annivNext);
    const annivUntil = daysUntil(annivNext, today);
    if (years > 0 && annivUntil < CELEBRATIONS_HORIZON_DAYS) {
      entries.push({
        ...base,
        kind: "work-aversary",
        next: annivNext,
        daysUntil: annivUntil,
        isToday: annivUntil === 0,
        joinedAt: u.joinedAt,
        years,
      });
    }
  }

  entries.sort((a, b) => a.next.getTime() - b.next.getTime() || a.name.localeCompare(b.name));

  const todayEntries = entries.filter((e) => e.isToday);
  const birthdays = entries.filter((e) => e.kind === "birthday");
  const workAversaries = entries.filter((e) => e.kind === "work-aversary");

  return {
    today: todayEntries,
    birthdays,
    workAversaries,
    horizonDays: CELEBRATIONS_HORIZON_DAYS,
  };
}
