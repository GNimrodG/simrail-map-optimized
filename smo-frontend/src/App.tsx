import "./styles.css";
import "@fontsource/inter";

import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { lazy, Suspense, useMemo, useState } from "react";

import CookieConsent from "./components/CookieConsent";
import ErrorBoundary from "./components/ErrorBoundary";
import Loading from "./components/Loading";
import SelectedTrainProvider from "./components/SelectedTrainProvider";
import MapLinesContext, { MapLineData } from "./utils/map-lines-context";
import SelectedRouteContext from "./utils/selected-route-context";

const MainMap = lazy(() => import("./components/MainMap"));

function App() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [mapLines, setMapLines] = useState<MapLineData | null>(null);

  const selectedRouteContextValue = useMemo(
    () => ({ selectedRoute, setSelectedRoute }),
    [selectedRoute, setSelectedRoute],
  );

  const mapLinesContextValue = useMemo(() => ({ mapLines, setMapLines }), [mapLines, setMapLines]);

  return (
    <CssVarsProvider colorSchemeStorageKey="color-scheme" defaultMode="system">
      <CssBaseline />
      <SelectedRouteContext.Provider value={selectedRouteContextValue}>
        <SelectedTrainProvider>
          <MapLinesContext.Provider value={mapLinesContextValue}>
            <Suspense fallback={<Loading color="success" />}>
              <ErrorBoundary location="App">
                <CookieConsent />
                <MainMap />
              </ErrorBoundary>
            </Suspense>
          </MapLinesContext.Provider>
        </SelectedTrainProvider>
      </SelectedRouteContext.Provider>
    </CssVarsProvider>
  );
}

export default App;
