import "leaflet/dist/leaflet.css";

import { useHotkeys } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import L from "leaflet";
import { type FunctionComponent, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer } from "react-leaflet";
import Control from "react-leaflet-custom-control";

import i18n from "../i18n";
import { isConnected$ } from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import { useSetting } from "../utils/use-setting";
import useBehaviorSubj from "../utils/useBehaviorSubj";
import LayerMenu from "./LayerMenu";
import ActiveSignalsLayer from "./layers/ActiveSignalsLayer";
import MapLinesLayer from "./layers/MapLinesLayer";
import PassiveSignalsLayer from "./layers/PassiveSignalsLayer";
import SelectedTrainRouteLayer from "./layers/SelectedTrainRouteLayer";
import StationsLayer from "./layers/StationsLayer";
import TrainsLayer from "./layers/TrainsLayer";
import UnplayableStationsLayer from "./layers/UnplayableStationsLayer";
import Loading from "./Loading";
import MapTimeDisplay from "./MapTimeDisplay";
import SearchBar from "./SearchBar";
import SelectedTrainInfo from "./SelectedTrainInfo";
import ServerSelector from "./ServerSelector";
import Settings from "./settings/Settings";
import StatsDisplay from "./StatsDisplay";
import RefreshableTileLayer from "./utils/RefreshableTileLayer";
import ThemeToggle from "./utils/ThemeToggle";

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

  const isConnected = useBehaviorSubj(isConnected$);

  const [visibleLayers, setVisibleLayers] = useSetting("visibleLayers");
  const [layerOpacities] = useSetting("layerOpacities");

  const [renderer] = useState(() => new L.Canvas());

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
        center={[51.015482, 19.572143]}
        zoom={8}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: "100vh", width: "100vw" }}
        renderer={renderer}
      >
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
          spacing={1}
        >
          <ServerSelector />
          <SearchBar />
          <MapTimeDisplay />
          {visibleLayers.includes("stats") && <StatsDisplay />}
        </Stack>

        {/* Selected Train Popup */}
        <Control position="bottomleft">
          <SelectedTrainInfo />
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
          spacing={1}
        >
          <LayerMenu visibleLayers={visibleLayers} setVisibleLayers={setVisibleLayers} />

          <ThemeToggle />

          <Settings />
        </Stack>

        {/* Selected Route */}
        <Control prepend position="bottomright">
          {selectedRoute && (
            <Sheet
              variant="outlined"
              sx={{
                p: 1,
                borderRadius: "var(--joy-radius-sm)",
              }}
            >
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

        {/* Stations, Trains, Signals, Active route, Unplayable stations*/}
        {visibleLayers.includes("stations") && <StationsLayer />}
        {visibleLayers.includes("trains") && <TrainsLayer />}
        {visibleLayers.includes("passive-signals") && <PassiveSignalsLayer />}
        {visibleLayers.includes("active-signals") && <ActiveSignalsLayer />}
        {visibleLayers.includes("selected-route") && <SelectedTrainRouteLayer />}
        {visibleLayers.includes("unplayable-stations") && <UnplayableStationsLayer />}
        <MapLinesLayer />
      </MapContainer>
    </>
  );
};

export default MainMap;
