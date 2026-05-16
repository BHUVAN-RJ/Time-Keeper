import { endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export function getDayRangeUtc(now: Date, timeZone: string): {
  startUtc: Date;
  endUtc: Date;
} {
  const zoned = toZonedTime(now, timeZone);
  const startLocal = startOfDay(zoned);
  const endLocal = endOfDay(zoned);
  return {
    startUtc: fromZonedTime(startLocal, timeZone),
    endUtc: fromZonedTime(endLocal, timeZone),
  };
}
