import { type FunctionComponent, lazy, PropsWithChildren } from "react";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { isSentryLoaded$ } from "../utils/data-manager";
import ErrorFallback from "./ErrorFallback";

const SentryErrorBoundary = lazy(() => import("@sentry/react").then((mod) => ({ default: mod.ErrorBoundary })));
const FallbackErrorBoundary = lazy(() =>
  import("react-error-boundary").then((mod) => ({ default: mod.ErrorBoundary })),
);
export interface ErrorBoundaryProps {
  location: string;
}

const ErrorBoundary: FunctionComponent<PropsWithChildren<ErrorBoundaryProps>> = ({ location, children }) => {
  const isSentryLoaded = useBehaviorSubj(isSentryLoaded$);

  if (!isSentryLoaded) {
    // If Sentry is not loaded, just render children without error boundary
    return <FallbackErrorBoundary FallbackComponent={ErrorFallback}>{children}</FallbackErrorBoundary>;
  }

  return (
    <SentryErrorBoundary fallback={ErrorFallback} beforeCapture={(state) => state.setTag("location", location)}>
      {children}
    </SentryErrorBoundary>
  );
};

export default ErrorBoundary;
