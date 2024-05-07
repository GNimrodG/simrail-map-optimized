import { useEffect } from "react";
import { Observable } from "rxjs";

const useObservable = <T>(obs: Observable<T>, handler: (data: T) => void) => {
  useEffect(() => {
    const subscription = obs.subscribe(handler);
    return () => subscription.unsubscribe();
  }, [obs, handler]);
};

export default useObservable;
