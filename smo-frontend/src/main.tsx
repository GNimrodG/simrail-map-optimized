import "core-js/actual/array/to-sorted";
import "./i18n.ts";

import * as Sentry from "@sentry/react";
import React from "react";
import ReactDOM from "react-dom/client";

export const feedbackIntegration = Sentry.feedbackSyncIntegration(
  {
    colorScheme: "system",
    autoInject: false,
  },
  {
    includeReplay: true,
  },
);

feedbackIntegration.createForm().then((form) => {
  form.appendToDom();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).feedback = form.open;
});

Sentry.init({
  dsn: "https://8c28aa804663f38f3314af8312673ed5@o260759.ingest.us.sentry.io/4507205489262592",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllInputs: false,
      maskAllText: false,
      blockAllMedia: false,
    }),
    feedbackIntegration,
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: ["localhost", /^(http|ws)s:\/\/api\.smo\.data-unknown\.com/],
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
