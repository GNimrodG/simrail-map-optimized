import { Button } from "@mui/joy";
import { useTheme } from "@mui/joy/styles";
import { type FunctionComponent, useEffect } from "react";
import ReactCookieConsent, { getCookieConsentValue } from "react-cookie-consent";
import { Trans, useTranslation } from "react-i18next";

import { isSentryLoaded$ } from "../utils/data-manager";
import { VERSION } from "../version";

function initializeSentry() {
  if (isSentryLoaded$.getValue()) return;

  isSentryLoaded$.next(true);

  import("@sentry/react").then((Sentry) => {
    const feedbackIntegration = Sentry.feedbackSyncIntegration(
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
      release: VERSION,
      // Performance Monitoring
      tracesSampleRate: 1.0, //  Capture 100% of the transactions
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: [/^(http|ws)s:\/\/api\.smo\.data-unknown\.com/],
      // Session Replay
      replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
      replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    });
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
