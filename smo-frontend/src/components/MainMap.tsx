import "leaflet/dist/leaflet.css";

import { useHotkeys } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import L from "leaflet";
import { type FunctionComponent, lazy, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer } from "react-leaflet";
import Control from "react-leaflet-custom-control";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { useSetting } from "../hooks/useSetting";
import { dataProvider } from "../utils/data-manager";
import { goToSignal } from "../utils/geom-utils";
import MapLinesContext from "../utils/map-lines-context";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import AutoZoomHandler from "./AutoZoom";
import ErrorBoundary from "./ErrorBoundary";
import LayerMenu from "./LayerMenu";
import Loading from "./Loading";
import LowSpeedWarning from "./LowSpeedWarning";
import MapTimeDisplay from "./MapTimeDisplay";
import SearchBar from "./SearchBar";
import SelectedRouteControl from "./SelectedRouteControl";
import SelectedTrainInfo from "./SelectedTrainInfo";
import ServerSelector from "./ServerSelector";
import SettingsModal from "./settings/SettingsModal";
import StatsDisplay from "./StatsDisplay";
import RefreshableTileLayer from "./utils/RefreshableTileLayer";
import ThemeToggle from "./utils/ThemeToggle";

const ActiveSignalsLayer = lazy(() => import("./layers/ActiveSignalsLayer"));
const MapLinesLayer = lazy(() => import("./layers/MapLinesLayer"));
const PassiveSignalsLayer = lazy(() => import("./layers/PassiveSignalsLayer"));
const SelectedTrainRouteLayer = lazy(() => import("./layers/SelectedTrainRouteLayer"));
const StationsLayer = lazy(() => import("./layers/StationsLayer"));
const TrainsLayer = lazy(() => import("./layers/TrainsLayer"));
const UnplayableStationsLayer = lazy(() => import("./layers/UnplayableStationsLayer"));
const StoppingPointsLayer = lazy(() => import("./layers/StoppingPointsLayer"));

const MainMap: FunctionComponent = () => {
  const { t } = useTranslation();
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);
  const { mapLines, setMapLines } = useContext(MapLinesContext);
  const [alternativeTheme] = useSetting("alternativeTheme");

  const isConnected = useBehaviorSubj(dataProvider.isConnected$);

  const [visibleLayers, setVisibleLayers] = useSetting("visibleLayers");
  const [layerOpacities] = useSetting("layerOpacities");

  const [renderer] = useState(() => new L.Canvas());
  const [map, setMap] = useState<L.Map | null>(null);

  const [panesCreated, setPanesCreated] = useState(false);

  useEffect(() => {
    if (!map) return;

    // Create custom panes with specific z-indices
    // Default Leaflet panes are between 200-700, so we'll use 400-500 range
    map.createPane("passiveSignalsPane").style.zIndex = "401";
    map.createPane("unplayableStationsPane").style.zIndex = "402";
    map.createPane("stoppingPointsPane").style.zIndex = "403";
    map.createPane("stationsPane").style.zIndex = "404";
    map.createPane("trainsPane").style.zIndex = "405";
    map.createPane("activeSignalsPane").style.zIndex = "406";
    map.createPane("selectedRoutePane").style.zIndex = "407";
    map.createPane("mapLinesPane").style.zIndex = "408";

    setPanesCreated(true);

    return () => {
      setPanesCreated(false);
    };
  }, [map]);

  useHotkeys([
    [
      "Escape",
      () => {
        setSelectedRoute(null);
        setSelectedTrain(null);
        setMapLines(null);
      },
    ],
  ]);

  const attributions = useMemo(
    () =>
      [
        '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        '<a href="https://github.com/GNimrodG/simrail-map-optimized" target="_blank">GitHub</a>',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).feedback && `<a onclick="window.feedback()" href="#">${t("BugReport")}</a>`,
        `<a href="/privacy-policy.html" target="_blank">${t("PrivacyPolicy.Title")}</a>`,
        'This website is not affiliated with the <a href="https://simrail.eu" target="_blank">SimRail</a> team.',
      ]
        .filter(Boolean)
        .join(" | "),
    [t],
  );

  const panToSignal = (signalName: string) => {
    if (!map) return;

    const signal = dataProvider.signalsData$.value.find((s) => s.Name === signalName);
    if (!signal) return;

    setSelectedTrain(selectedTrain ? { ...selectedTrain, follow: false } : null);
    goToSignal(signal, map);
  };

  const panToTrain = (trainNo: string) => {
    if (!map) return;

    const train = dataProvider.trainsData$.value.find((t) => t.TrainNoLocal === trainNo);
    if (!train) return;

    map.panTo([train.TrainData.Latitude, train.TrainData.Longitude], {
      animate: true,
      duration: 1,
    });
    setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true, paused: false });
  };

  return (
    <>
      {!isConnected && <Loading />}
      <MapContainer
        ref={setMap}
        center={[51.015482, 19.572143]}
        zoom={8}
        zoomSnap={0.1}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100vh", width: "100vw" }}
        renderer={renderer}>
        <RefreshableTileLayer
          className={alternativeTheme ? "alternativemap" : "defaultmap"}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={attributions}
        />

        {/* placeholder control */}
        <Control prepend position="topleft">
          <Box sx={{ p: 2, visible: "none" }} />
        </Control>

        {/* Server Select | Search | Time */}
        <Stack
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 1000,
            maxWidth: "calc(100vw - 4rem)",
            flexWrap: "wrap",
          }}
          useFlexGap
          direction="row"
          spacing={1}>
          <ErrorBoundary location="MainMap - ServerSelector">
            <ServerSelector />
          </ErrorBoundary>
          <ErrorBoundary location="MainMap - SearchBar">
            <SearchBar />
          </ErrorBoundary>
          <ErrorBoundary location="MainMap - MapTimeDisplay">
            <MapTimeDisplay />
          </ErrorBoundary>
          <ErrorBoundary location="MainMap - StatsDisplay">
            {visibleLayers.includes("stats") && <StatsDisplay />}
          </ErrorBoundary>
        </Stack>

        {/* Selected Train Popup */}
        <Control position="bottomleft">
          <ErrorBoundary location="MainMap - SelectedTrainInfo">
            <SelectedTrainInfo />
          </ErrorBoundary>
        </Control>

        {/* Layers */}
        {/* ThemeToggle */}
        {/* Settings */}
        <Stack
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1000,
          }}
          useFlexGap
          direction="column"
          spacing={1}>
          <LayerMenu visibleLayers={visibleLayers} setVisibleLayers={setVisibleLayers} />

          <ThemeToggle />

          <SettingsModal />
        </Stack>

        {/* Selected Route */}
        <Control prepend position="bottomright">
          {(mapLines || selectedRoute) && (
            <Stack spacing={1} alignItems="flex-end">
              {selectedRoute && (
                <SelectedRouteControl
                  title={t("SelectedRoute")}
                  value={selectedRoute}
                  valueColor="primary"
                  onValueClick={() => panToTrain(selectedRoute)}
                  onHide={() => setSelectedRoute(null)}
                />
              )}

              {mapLines && (
                <SelectedRouteControl
                  title={t("SignalMarker.ActiveLinesTitle")}
                  value={mapLines.signal}
                  valueColor="success"
                  onValueClick={() => panToSignal(mapLines.signal)}
                  onHide={() => setMapLines(null)}
                />
              )}
            </Stack>
          )}
        </Control>
        {/* Layers */}
        {/* orm-infra */}
        {visibleLayers.includes("orm-infra") && (
          <RefreshableTileLayer
            className={alternativeTheme ? "alternativelayers" : "defaultmap"}
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
            opacity={layerOpacities["orm-infra"]}
          />
        )}
        {/* orm-maxspeed */}
        {visibleLayers.includes("orm-maxspeed") && (
          <RefreshableTileLayer
            className={alternativeTheme ? "alternativelayers" : "defaultmap"}
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png"
            opacity={layerOpacities["orm-maxspeed"]}
          />
        )}
        {/* orm-signals */}
        {visibleLayers.includes("orm-signals") && (
          <RefreshableTileLayer
            className={alternativeTheme ? "alternativelayers" : "defaultmap"}
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png"
            opacity={layerOpacities["orm-signals"]}
          />
        )}
        {/* orm-electrification */}
        {visibleLayers.includes("orm-electrification") && (
          <RefreshableTileLayer
            className={alternativeTheme ? "alternativelayers" : "defaultmap"}
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/electrification/{z}/{x}/{y}.png"
            opacity={layerOpacities["orm-electrification"]}
          />
        )}

        {panesCreated && (
          <Suspense fallback={<Loading color="success" />}>
            {/* Stopping points, Stations, Trains, Signals, Active route, Unplayable stations*/}
            {visibleLayers.includes("unplayable-stations") && (
              <ErrorBoundary location="MainMap - UnplayableStationsLayer">
                <UnplayableStationsLayer />
              </ErrorBoundary>
            )}
            {visibleLayers.includes("stoppingpoints") && (
              <ErrorBoundary location="MainMap - StoppingPointsLayer">
                <StoppingPointsLayer />
              </ErrorBoundary>
            )}
            {visibleLayers.includes("passive-signals") && (
              <ErrorBoundary location="MainMap - PassiveSignalsLayer">
                <PassiveSignalsLayer />
              </ErrorBoundary>
            )}
            {visibleLayers.includes("stations") && (
              <ErrorBoundary location="MainMap - StationsLayer">
                <StationsLayer />
              </ErrorBoundary>
            )}
            {visibleLayers.includes("trains") && (
              <ErrorBoundary location="MainMap - TrainsLayer">
                <TrainsLayer />
              </ErrorBoundary>
            )}
            {visibleLayers.includes("active-signals") && (
              <ErrorBoundary location="MainMap - ActiveSignalsLayer">
                <ActiveSignalsLayer />
              </ErrorBoundary>
            )}
            {visibleLayers.includes("selected-route") && (
              <ErrorBoundary location="MainMap - SelectedTrainRouteLayer">
                <SelectedTrainRouteLayer />
              </ErrorBoundary>
            )}

            <ErrorBoundary location="MainMap - MapLinesLayer">
              <MapLinesLayer />
            </ErrorBoundary>
          </Suspense>
        )}

        <LowSpeedWarning />
        <AutoZoomHandler />
      </MapContainer>
    </>
  );
};

export default MainMap;
