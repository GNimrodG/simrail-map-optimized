import { BehaviorSubject } from "rxjs";

import { timeData$ } from "./data-manager";

export const timeSubj$ = new BehaviorSubject(0);

setInterval(() => {
  timeSubj$.next(timeSubj$.getValue() + 1000);
}, 1000);

// I have no idea why this is necessary, but it is
const CORRECTION = 2 * 60 * 60 * 1000; // 2 hours

timeData$.subscribe((timeData) => {
  if (timeData?.time) {
    timeSubj$.next(timeData.time - CORRECTION);
  }
});
