import { BehaviorSubject } from "rxjs";

import { dataProvider } from "./data-manager";

export const timeSubj$ = new BehaviorSubject(0);

setInterval(() => {
  timeSubj$.next(timeSubj$.getValue() + 1000);
}, 1000);

const CORRECTION = new Date().getTimezoneOffset() * 60 * 1000;

dataProvider.timeData$.subscribe((timeData) => {
  if (timeData?.Time) {
    const parsed = new Date(timeData.Time + CORRECTION);

    parsed.setHours(new Date().getUTCHours() + timeData.Timezone); // Manual timezone correction because the API is unreliable

    timeSubj$.next(parsed.getTime());
  }
});
