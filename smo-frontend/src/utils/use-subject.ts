import { useEffect, useState } from "react";
import { Observable } from "rxjs";

function useSubject<T>(subj: Observable<T>, defaultValue: T, selector?: never): T;
function useSubject<T, S>(subj: Observable<S>, defaultValue: T, selector?: (data: S) => T): T;
function useSubject<T, S>(subj: Observable<S>, defaultValue: T, selector?: (data: S) => T) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const subscription = subj.subscribe((data) => {
      setValue(selector ? selector(data) : (data as unknown as T));
    });
    return () => subscription.unsubscribe();
  }, [selector, subj]);

  return value;
}

export default useSubject;
