import "./styles.css";
import "@fontsource/inter";

import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { lazy, Suspense, useMemo, useState } from "react";

import ErrorBoundary from "./components/ErrorBoundary";
import Loading from "./components/Loading";
import MapLinesContext, { MapLineData } from "./utils/map-lines-context";
import SelectedRouteContext from "./utils/selected-route-context";
import SelectedTrainContext, { SelectedTrainData } from "./utils/selected-train-context";

const MainMap = lazy(() => import("./components/MainMap"));

function App() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<SelectedTrainData | null>(null);
  const [mapLines, setMapLines] = useState<MapLineData | null>(null);

  const selectedRouteContextValue = useMemo(
    () => ({ selectedRoute, setSelectedRoute }),
    [selectedRoute, setSelectedRoute],
  );

  const selectedTrainContextValue = useMemo(
    () => ({ selectedTrain, setSelectedTrain }),
    [selectedTrain, setSelectedTrain],
  );

  const mapLinesContextValue = useMemo(() => ({ mapLines, setMapLines }), [mapLines, setMapLines]);

  return (
    <CssVarsProvider colorSchemeStorageKey="color-scheme" defaultMode="system">
      <CssBaseline />
      <SelectedRouteContext.Provider value={selectedRouteContextValue}>
        <SelectedTrainContext.Provider value={selectedTrainContextValue}>
          <MapLinesContext.Provider value={mapLinesContextValue}>
            <Suspense fallback={<Loading color="success" />}>
              <ErrorBoundary location="App">
                <MainMap />
              </ErrorBoundary>
            </Suspense>
          </MapLinesContext.Provider>
        </SelectedTrainContext.Provider>
      </SelectedRouteContext.Provider>
    </CssVarsProvider>
  );
}

export default App;
