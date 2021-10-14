
const periodToVestIntervalSec = {
  day: 24 * 3600,
  week: 7 * 24 * 3600,
  month: 30 * 24 * 3600
};

export type unitOfTime = "day" | "week" | "month";

export const unitOfTimeToSec = (unit: unitOfTime): number => {
  return periodToVestIntervalSec[unit];
}
