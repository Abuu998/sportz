import type { Match } from "@/db/schema";
import { MATCH_STATUS } from "@/validations/matches";

export function getMatchStatus(
  startTime: Date | string,
  endTime: Date | string,
  now = new Date(),
) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (now < start) {
    return MATCH_STATUS.SCHEDULED;
  }

  if (now >= end) {
    return MATCH_STATUS.FINISHED;
  }

  return MATCH_STATUS.LIVE;
}

export async function syncMatchStatus(
  match: Match,
  updateStatus: (status: ReturnType<typeof getMatchStatus>) => Promise<void>,
) {
  const nextStatus = getMatchStatus(match.startTime as Date, match.endTime as Date);

  if (!nextStatus) {
    return match.status;
  }

  if (match.status !== nextStatus) {
    await updateStatus(nextStatus);
    match.status = nextStatus;
  }

  return match.status;
}
