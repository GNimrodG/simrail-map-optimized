import "./styles.css";
import "@fontsource/inter";

import CssBaseline from "@mui/joy/CssBaseline";
import { CssVarsProvider } from "@mui/joy/styles";
import { useMemo, useState } from "react";

import MainMap from "./components/MainMap";
import SelectedRouteContext from "./utils/selected-route-context";
import SelectedTrainContext from "./utils/selected-train-context";

function App() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<{ trainNo: string; follow: boolean } | null>(
    null
  );

  const selectedRouteContextValue = useMemo(
    () => ({ selectedRoute, setSelectedRoute }),
    [selectedRoute, setSelectedRoute]
  );

  const selectedTrainContextValue = useMemo(
    () => ({ selectedTrain, setSelectedTrain }),
    [selectedTrain, setSelectedTrain]
  );

  return (
    <CssVarsProvider
      colorSchemeStorageKey="color-scheme"
      defaultMode="system">
      <CssBaseline />
      <SelectedRouteContext.Provider value={selectedRouteContextValue}>
        <SelectedTrainContext.Provider value={selectedTrainContextValue}>
          <MainMap />
        </SelectedTrainContext.Provider>
      </SelectedRouteContext.Provider>
    </CssVarsProvider>
  );
}

export default App;
