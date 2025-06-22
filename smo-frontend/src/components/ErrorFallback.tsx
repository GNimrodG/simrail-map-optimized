import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState } from "react";

import Loading from "./Loading";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feedbackFn = (window as any).feedback || (() => console.error("Feedback function not found"));

let lastAutoReset = 0;

export interface ErrorFallbackProps {
  error: unknown;
  resetErrorBoundary: () => void;
}

const prevErrors: string[] = [];

const ErrorFallbackRender: FunctionComponent<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  console.error("Error boundary has been triggered: ", error);
  const [hide, setHide] = useState(false);

  if (error instanceof Error && !prevErrors.includes(error.message)) {
    // Log the error only once
    prevErrors.push(error.message);
    // Try to reset the error boundary when an error occurs first time
    resetErrorBoundary?.();

    return <Loading color="danger" />;
  }

  if (hide) {
    // show an error indicator circle in the bottom right corner of the screen, when clicked it will show the error again
    return (
      <Box
        sx={{
          position: "fixed",
          bottom: (theme) => theme.spacing(3),
          right: (theme) => theme.spacing(2),
          zIndex: 100000,
        }}>
        <IconButton color="danger" onClick={() => setHide(false)} variant="soft" sx={{ borderRadius: "50%" }}>
          !
        </IconButton>
      </Box>
    );
  }

  const isProbablyTranslationError = error instanceof Error && error.message.includes("removeChild");

  if (isProbablyTranslationError) {
    console.warn("This error is probably caused by the browser's built-in translation feature.");
  }

  if (isProbablyTranslationError && resetErrorBoundary && Date.now() - lastAutoReset > 10000) {
    // Automatically reset the error boundary after 10 seconds if it's a translation error
    // eslint-disable-next-line react-compiler/react-compiler
    lastAutoReset = Date.now();
    resetErrorBoundary();
  }

  if (
    error instanceof Error &&
    error.message.includes("error loading dynamically imported module") &&
    navigator.onLine
  ) {
    console.warn("This error is probably caused by a dynamically imported module that failed to load.");
    // show a dialog to reload the page because it's probably because the app was updated and the module is no longer available
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: (theme) => theme.palette.background.body,
          pt: 2,
        }}>
        <Box
          sx={{
            zIndex: 100000,
            p: 2,
            borderRadius: "var(--joy-radius-md)",
            border: "1px solid",
            borderColor: (theme) => theme.palette.primary.outlinedBorder,
            backgroundColor: (theme) => theme.palette.primary.softBg,
            maxWidth: "min(90vw, 500px)",
            maxHeight: "90vh",
            overflow: "auto",
          }}>
          <Typography level="h1" color="primary">
            An update is available!
          </Typography>

          <Stack alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
            <Button
              color="primary"
              onClick={() => {
                window.location.reload();
              }}
              sx={{ mt: 2 }}>
              Reload the page
            </Button>
          </Stack>
          <Typography level="body-md" sx={{ mt: 1 }}>
            If this message persists, please try clearing your browser cache or disabling any browser extensions that
            may interfere with the app.
          </Typography>
          <Typography level="body-sm" sx={{ mt: 1 }}>
            If the issue persists, please report it using the button below.
          </Typography>
          <Stack gap={1} direction="row" sx={{ mt: 2 }}>
            <Button color="success" sx={{ flexGrow: 1 }} onClick={() => feedbackFn()}>
              Report
            </Button>
            <Button color="danger" onClick={() => setHide(true)}>
              Hide
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Loading color="danger" />
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: (theme) => theme.palette.background.body,
          pt: 2,
        }}>
        <Box
          sx={{
            zIndex: 100000,
            p: 2,
            borderRadius: "var(--joy-radius-md)",
            border: "1px solid",
            borderColor: (theme) => theme.palette.danger.outlinedBorder,
            backgroundColor: (theme) => theme.palette.danger.softBg,
            maxWidth: "min(90vw, 500px)",
            maxHeight: "90vh",
            overflow: "auto",
          }}>
          <Typography level="h1" color="danger">
            Something went wrong!
          </Typography>
          <Typography fontFamily="monospace" sx={{ whiteSpace: "pre", marginBottom: 1 }}>
            {error instanceof Error ? error.message : "An error occurred"}
          </Typography>
          <Typography level="body-md">Please try again or if the issue persists, hide this message.</Typography>
          {isProbablyTranslationError && (
            <>
              <Typography level="title-lg" color="warning">
                If you have translated the page using the browser's built-in translation, please try disabling it.
              </Typography>
              <Typography level="body-sm" color="warning">
                There are already built-in translations for German, Hungarian, Turkish and Polish in the Settings.
              </Typography>
            </>
          )}
          <Typography level="body-sm">This error has been logged and will be investigated.</Typography>
          <Typography level="body-sm" gutterBottom>
            If you would like to provide feedback, please click the report button.
          </Typography>
          <Stack gap={1} direction="row">
            <Button color="warning" onClick={resetErrorBoundary} sx={{ flexGrow: 1 }}>
              Try again
            </Button>
            {/* Report */}
            <Button color="success" sx={{ flexGrow: 1 }} onClick={() => feedbackFn()}>
              Report
            </Button>
            <Button color="danger" onClick={() => setHide(true)}>
              Hide
            </Button>
          </Stack>
        </Box>
      </Box>
    </>
  );
};

const ErrorFallback: (errorData: {
  error: unknown;
  resetError?(): void;
  resetErrorBoundary?(): void;
}) => React.ReactElement = ({ error, resetError, resetErrorBoundary }) => {
  return <ErrorFallbackRender error={error} resetErrorBoundary={resetError ?? resetErrorBoundary!} />;
};

export default ErrorFallback;
