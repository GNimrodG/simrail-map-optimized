import { useEffect, useState } from "react";
import { BehaviorSubject } from "rxjs";

function useBehaviorSubj<T>(subj: BehaviorSubject<T>, selector?: never): T;
function useBehaviorSubj<T, S>(subj: BehaviorSubject<S>, selector?: (data: S) => T): T;
function useBehaviorSubj<T, S>(subj: BehaviorSubject<S>, selector?: (data: S) => T) {
  const [value, setValue] = useState(
    selector ? selector(subj.value) : (subj.value as unknown as T)
  );

  useEffect(() => {
    const subscription = subj.subscribe((data) => {
      setValue(selector ? selector(data) : (data as unknown as T));
    });
    return () => subscription.unsubscribe();
  }, [selector, subj]);

  return value;
}

export default useBehaviorSubj;
