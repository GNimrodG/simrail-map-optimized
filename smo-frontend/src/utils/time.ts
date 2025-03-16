import { BehaviorSubject } from "rxjs";

import { timeData$ } from "./data-manager";

export const timeSubj$ = new BehaviorSubject(0);

setInterval(() => {
  timeSubj$.next(timeSubj$.getValue() + 1000);
}, 1000);

const CORRECTION = new Date().getTimezoneOffset() * 60 * 1000;

timeData$.subscribe((timeData) => {
  if (timeData?.time) {
    const parsed = new Date(timeData.time + CORRECTION);

    parsed.setHours(new Date().getUTCHours() + timeData.timezone); // Manual timezone correction because the API is unreliable

    timeSubj$.next(parsed.getTime());
  }
});
