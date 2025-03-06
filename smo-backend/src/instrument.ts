import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: "https://9a17f501f8e2c7f28b08fd08a925dd8f@o260759.ingest.us.sentry.io/4507205518295040",
  integrations: [Sentry.captureConsoleIntegration(), nodeProfilingIntegration()],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});
