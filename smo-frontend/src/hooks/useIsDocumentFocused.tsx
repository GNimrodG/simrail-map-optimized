import { debounce } from "lodash";
import { useEffect, useState } from "react";

export function useIsDocumentFocused() {
  const [isFocused, setIsFocused] = useState(true);

  useEffect(() => {
    const handleBlur = debounce(() => setIsFocused(false), 100); // Debounce to avoid false positives on quick focus changes
    const handleFocus = () => {
      handleBlur.cancel();
      setIsFocused(true);
    };

    document.addEventListener("focus", handleFocus, true);
    document.addEventListener("blur", handleBlur, true);

    return () => {
      document.removeEventListener("focus", handleFocus, true);
      document.removeEventListener("blur", handleBlur, true);
    };
  }, []);

  return isFocused;
}
