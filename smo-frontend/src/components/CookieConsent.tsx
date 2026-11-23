import { Button } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";
import { type FunctionComponent, useEffect } from "react";
import ReactCookieConsent, { getCookieConsentValue } from "react-cookie-consent";
import { Trans, useTranslation } from "react-i18next";

import i18n from "../i18n";
import { isReloadingForNewBuild } from "../utils/chunk-reload";
import { isSentryLoaded$ } from "../utils/data-manager";
import { reportUsageSnapshot } from "../utils/usage-stats";
import { VERSION } from "../version";

/** Set at build time from the repo variable SENTRY_DSN (CI passes it to the Docker build); builds without it (local
 * builds, forks) don't load Sentry at all, so they never report into SMO's project. */
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (!SENTRY_DSN) {
  console.warn("Sentry DSN is not set (VITE_SENTRY_DSN at build time), error reporting is disabled.");
}

/** The feedback form (window.feedback() opens it), added while Sentry starts */
function attachFeedbackForm(integration: { createForm: () => Promise<{ appendToDom: () => void; open: () => void }> }) {
  integration
    .createForm()
    .then((form) => {
      form.appendToDom();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).feedback = form.open;
    })
    .catch((e) => console.error("Failed to create the feedback form", e));
}

function initializeSentry() {
  if (!SENTRY_DSN || isSentryLoaded$.getValue()) return;

  isSentryLoaded$.next(true);

  void import("@sentry/react").then((Sentry) => {
    const feedbackIntegration = Sentry.feedbackSyncIntegration(
      {
        colorScheme: "system",
        autoInject: false,
      },
      {
        includeReplay: true,
      },
    );

    attachFeedbackForm(feedbackIntegration);

    Sentry.init({
      dsn: SENTRY_DSN,
      // through this domain (nginx.conf forwards it to Sentry): tracking protection and blockers drop requests to
      // sentry.io, even for visitors who accepted the cookies
      tunnel: import.meta.env.PROD ? "/smo-events" : undefined,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllInputs: false,
          maskAllText: false,
          blockAllMedia: false,
        }),
        feedbackIntegration,
      ],
      release: VERSION,
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: [/^(http|ws)s:\/\/api\.smo\.data-unknown\.com/],
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
      ignoreErrors: [
        // Leaflet's Draggable sometimes gets the Document as event target (Firefox) and reads className.baseVal on it;
        // only Leaflet frames, harmless, nothing in SMO reads baseVal
        /\bbaseVal\b/,
      ],
      // a stale tab is reloading for the new build: errors until it unloads are just the old chunks going missing
      beforeSend: (event) => (isReloadingForNewBuild() ? null : event),
    });

    // the UI language, to tell apart users of the built-in translations from browser translation
    Sentry.setTag("app.language", i18n.resolvedLanguage ?? i18n.language);
    i18n.on("languageChanged", () => Sentry.setTag("app.language", i18n.resolvedLanguage ?? i18n.language));

    // which layers and settings are used (see usage-stats)
    reportUsageSnapshot();
  });
}

const CookieConsent: FunctionComponent = () => {
  const theme = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    if (getCookieConsentValue("smo_data_unknown_gdpr_consent") === "true") {
      initializeSentry();
    }
  }, []);

  return (
    <ReactCookieConsent
      disableStyles
      buttonText={t("PrivacyPolicy.AcceptButton")}
      declineButtonText={t("PrivacyPolicy.DeclineButton")}
      enableDeclineButton
      cookieName="smo_data_unknown_gdpr_consent"
      style={{
        background: theme.palette.background.level2,
        zIndex: 1000,
        position: "fixed",
        bottom: 0,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing(2),
        paddingTop: theme.spacing(1),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        paddingBottom: theme.spacing(3),
      }}
      ButtonComponent={Button}
      customButtonProps={{ color: "success" }}
      customDeclineButtonProps={{ color: "danger", sx: { mr: 1 } }}
      onAccept={initializeSentry}>
      <Trans
        i18nKey="PrivacyPolicy.Description"
        components={[
          <a key="privacy-policy-link" href="/privacy-policy.html" style={{ color: theme.palette.primary.plainColor }}>
            privacy policy
          </a>,
        ]}></Trans>
    </ReactCookieConsent>
  );
};

export default CookieConsent;
