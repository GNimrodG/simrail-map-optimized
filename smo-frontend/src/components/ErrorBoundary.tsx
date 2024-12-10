import { ErrorBoundary as SentryErrorBoundary } from "@sentry/react";
import { type FunctionComponent, PropsWithChildren } from "react";

import ErrorFallback from "./ErrorFallback";

export interface ErrorBoundaryProps {
  location: string;
}

const ErrorBoundary: FunctionComponent<PropsWithChildren<ErrorBoundaryProps>> = ({ location, children }) => {
  return (
    <SentryErrorBoundary fallback={ErrorFallback} beforeCapture={(state) => state.setTag("location", location)}>
      {children}
    </SentryErrorBoundary>
  );
};

export default ErrorBoundary;
