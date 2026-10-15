type Observation = { sourceKey: string; title: string;
  dailySchedule: { localTime: string }[] | null };

export type MarineObservationChange = { key: string; title: string;
  kind: 'added' | 'removed' | 'times_changed'; before: string[]; after: string[] };

export function compareMarineObservations(before: Observation[], after: Observation[]): MarineObservationChange[] {
  const oldItems = new Map(before.map((item) => [item.sourceKey,item]));
  const newItems = new Map(after.map((item) => [item.sourceKey,item]));
  const changes: MarineObservationChange[] = [];
  const times = (item: Observation | undefined) => item?.dailySchedule?.map((time) => time.localTime).sort() ?? [];
  for (const key of [...new Set([...oldItems.keys(),...newItems.keys()])].sort()) {
    const oldItem = oldItems.get(key);
    const newItem = newItems.get(key);
    const oldTimes = times(oldItem);
    const newTimes = times(newItem);
    if (oldItem && newItem && JSON.stringify(oldTimes) === JSON.stringify(newTimes)) continue;
    changes.push({ key,title:newItem?.title ?? oldItem!.title,
      kind:!oldItem ? 'added' : !newItem ? 'removed' : 'times_changed',
      before:oldTimes,after:newTimes });
  }
  return changes;
}
