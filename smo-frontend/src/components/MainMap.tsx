import "leaflet/dist/leaflet.css";

import { useHotkeys } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import L from "leaflet";
import { type FunctionComponent, lazy, Suspense, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer } from "react-leaflet";
import Control from "react-leaflet-custom-control";

import i18n from "../i18n";
import { dataProvider } from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import useBehaviorSubj from "../utils/use-behaviorSubj";
import { useSetting } from "../utils/use-setting";
import AutoZoomHandler from "./AutoZoom";
import ErrorBoundary from "./ErrorBoundary";
import LayerMenu from "./LayerMenu";
import Loading from "./Loading";
import LowSpeedWarning from "./LowSpeedWarning";
import MapTimeDisplay from "./MapTimeDisplay";
import SearchBar from "./SearchBar";
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

const MAIN_ATTRIBUTIONS = [
  '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  '<a href="https://github.com/GNimrodG/simrail-map-optimized" target="_blank">GitHub</a>',
  `<a onclick="window.feedback()" href="#">${i18n.t("BugReport")}</a>`,
  'This website is not affiliated with the <a href="https://simrail.eu" target="_blank">SimRail</a> team.',
].join(" | ");

const MainMap: FunctionComponent = () => {
  const { t } = useTranslation();
  const { setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);
  const [alternativeTheme] = useSetting("alternativeTheme");

  const isConnected = useBehaviorSubj(dataProvider.isConnected$);

  const [visibleLayers, setVisibleLayers] = useSetting("visibleLayers");
  const [layerOpacities] = useSetting("layerOpacities");

  const [renderer] = useState(() => new L.Canvas());
  const [map, setMap] = useState<L.Map | null>(null);

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
  }, [map]);

  useHotkeys([
    [
      "Escape",
      () => {
        setSelectedRoute(null);
        setSelectedTrain(null);
      },
    ],
  ]);

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
          attribution={MAIN_ATTRIBUTIONS}
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
          {selectedRoute && (
            <Sheet
              variant="outlined"
              sx={{
                p: 1,
                borderRadius: "var(--joy-radius-sm)",
              }}>
              <Stack>
                <Typography level="body-md">{t("SelectedRoute")}</Typography>
                <Stack spacing={1} direction="row" alignItems="center">
                  <Typography level="body-lg" variant="outlined" color="primary">
                    {selectedRoute}
                  </Typography>
                  <Button size="sm" variant="outlined" color="danger" onClick={() => setSelectedRoute(null)}>
                    {t("Hide")}
                  </Button>
                </Stack>
              </Stack>
            </Sheet>
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

        <LowSpeedWarning />
        <AutoZoomHandler />
      </MapContainer>
    </>
  );
};

export default MainMap;
