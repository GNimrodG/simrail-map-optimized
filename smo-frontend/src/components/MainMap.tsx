import "leaflet/dist/leaflet.css";

import { useHotkeys, useLocalStorage } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Checkbox from "@mui/joy/Checkbox";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import Control from "react-leaflet-custom-control";

import { isConnected$, signalsData$, trainsData$ } from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../utils/steam";
import useBehaviorSubj from "../utils/useBehaviorSubj";
import ActiveSignalsLayer from "./layers/ActiveSignalsLayer";
import PassiveSignalsLayer from "./layers/PassiveSignalsLayer";
import SelectedTrainRouteLayer from "./layers/SelectedTrainRouteLayer";
import StationsLayer from "./layers/StationsLayer";
import TrainsLayer from "./layers/TrainsLayer";
import UnplayableStationsLayer from "./layers/UnplayableStationsLayer";
import Loading from "./Loading";
import MapTimeDisplay from "./MapTimeDisplay";
import TrainMarkerPopup from "./markers/TrainMarkerPopup";
import SearchBar from "./SearchBar";
import ServerSelector from "./ServerSelector";
import ThemeToggle from "./utils/ThemeToggle";

export interface MapProps {
  serverId: string;
}

const BACKGROUND_LAYERS = [
  { name: "OpenRailwayMap - Infrastructure", key: "orm-infra" },
  { name: "OpenRailwayMap - Maxspeed", key: "orm-maxspeed" },
  { name: "OpenRailwayMap - Signals", key: "orm-signals" },
  { name: "OpenRailwayMap - Electrification", key: "orm-electrification" },
];

const LAYERS = [
  { name: "Stations", key: "stations" },
  { name: "Trains", key: "trains" },
  { name: "Active Signals", key: "active-signals" },
  { name: "Passive Signals", key: "passive-signals" },
  { name: "Selected Route", key: "selected-route" },
  { name: "Unplayable Stations", key: "unplayable-stations" },
];

const MAIN_ATTRIBUTIONS = [
  '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  '<a href="https://github.com/GNimrodG/simrail-map-optimized" target="_blank">GitHub</a>',
  'This website is not affiliated with the <a href="https://simrail.eu" target="_blank">SimRail</a> team.',
].join(" | ");

const MainMap: FunctionComponent<MapProps> = () => {
  const [map, setMap] = useState<LeafletMap | null>(null);

  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);

  const isConnected = useBehaviorSubj(isConnected$);
  const trains = useBehaviorSubj(trainsData$);
  const signals = useBehaviorSubj(signalsData$);

  const [visibleLayers, setVisibleLayers] = useLocalStorage<string[]>({
    key: "visibleLayers",
    defaultValue: ["stations", "trains", "active-signals", "selected-route", "unplayable-stations"],
  });

  useHotkeys([
    [
      "Escape",
      () => {
        setSelectedRoute(null);
        setSelectedTrain(null);
      },
    ],
  ]);

  useEffect(() => {
    if (selectedTrain?.follow) {
      const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
      if (train) {
        map?.panTo([train.TrainData.Latititute, train.TrainData.Longitute], {
          animate: true,
          duration: 1,
        });
      }
    }
  }, [map, selectedTrain, trains]);

  const [selectedTrainUserData, setSelectedTrainUserData] = useState<ProfileResponse | null>(null);

  const selectedTrainData = useMemo(() => {
    if (!selectedTrain) return null;

    const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
    if (!train) return null;

    if (!train.TrainData.ControlledBySteamID) {
      setSelectedTrainUserData(null);
      return train;
    }

    getSteamProfileInfo(train.TrainData.ControlledBySteamID).then((profile) => {
      setSelectedTrainUserData(profile);
    });

    return train;
  }, [selectedTrain, trains]);

  return (
    <>
      {!isConnected && <Loading />}
      <MapContainer
        ref={setMap}
        center={[51.015482, 19.572143]}
        zoom={8}
        scrollWheelZoom={true}
        style={{ height: "100vh", width: "100vw" }}>
        <TileLayer
          attribution={MAIN_ATTRIBUTIONS}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* placeholder control */}
        <Control
          prepend
          position="topleft">
          <Box sx={{ p: 2, visible: "none" }} />
        </Control>

        {/* Server Select | Search | Time */}
        <Stack
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 1000,
          }}
          direction="row"
          spacing={1}>
          <ServerSelector />
          <SearchBar />
          <MapTimeDisplay />
        </Stack>

        {/* Theme Toggle */}
        <Control position="topleft">
          <ThemeToggle />
        </Control>
        {/* Selected Train Popup */}
        <Control position="bottomleft">
          {selectedTrain && selectedTrainData && (
            <Sheet
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: "var(--joy-radius-sm)",
              }}>
              <TrainMarkerPopup
                train={selectedTrainData}
                userData={selectedTrainUserData}
                showTrainRouteButton
              />
            </Sheet>
          )}
        </Control>
        {/* Layers */}
        <Control position="topright">
          <Sheet
            variant="outlined"
            sx={{
              p: 1,
              borderRadius: "var(--joy-radius-sm)",
            }}>
            <Stack spacing={1}>
              {BACKGROUND_LAYERS.map((layer) => (
                <Checkbox
                  slotProps={{
                    checkbox: { sx: { borderRadius: "50%" } },
                  }}
                  key={layer.key}
                  value={layer.key}
                  label={layer.name}
                  size="sm"
                  name="background-layers"
                  checked={visibleLayers.includes(layer.key)}
                  onChange={(e) => {
                    setVisibleLayers((visibleLayers) => [
                      ...visibleLayers.filter((l) => !BACKGROUND_LAYERS.find((bl) => bl.key === l)),
                      ...(!visibleLayers.includes(e.target.value) ? [layer.key] : []),
                    ]);
                  }}
                />
              ))}
              {LAYERS.map((layer) => (
                <Checkbox
                  key={layer.key}
                  checked={visibleLayers.includes(layer.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setVisibleLayers([...visibleLayers, layer.key]);
                    } else {
                      setVisibleLayers(visibleLayers.filter((l) => l !== layer.key));
                    }
                  }}
                  label={layer.name}
                  size="sm"
                />
              ))}
            </Stack>
          </Sheet>
        </Control>
        {/* Selected Route */}
        <Control
          prepend
          position="bottomright">
          {selectedRoute && (
            <Sheet
              variant="outlined"
              sx={{
                p: 1,
                borderRadius: "var(--joy-radius-sm)",
              }}>
              <Stack>
                <Typography level="body-md">Selected Route</Typography>
                <Stack
                  spacing={1}
                  direction="row"
                  alignItems="center">
                  <Typography
                    level="body-lg"
                    variant="outlined"
                    color="primary">
                    {selectedRoute}
                  </Typography>
                  <Button
                    size="sm"
                    variant="outlined"
                    color="danger"
                    onClick={() => setSelectedRoute(null)}>
                    Clear
                  </Button>
                </Stack>
              </Stack>
            </Sheet>
          )}
        </Control>

        {/* Layers */}
        {/* orm-infra */}
        {visibleLayers.includes("orm-infra") && (
          <TileLayer
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
          />
        )}
        {/* orm-maxspeed */}
        {visibleLayers.includes("orm-maxspeed") && (
          <TileLayer
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png"
          />
        )}
        {/* orm-signals */}
        {visibleLayers.includes("orm-signals") && (
          <TileLayer
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png"
          />
        )}
        {/* orm-electrification */}
        {visibleLayers.includes("orm-electrification") && (
          <TileLayer
            attribution='Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a>'
            url="https://{s}.tiles.openrailwaymap.org/electrification/{z}/{x}/{y}.png"
          />
        )}
        {/* orm-overlays */}

        {/* Stations, Trains, Signals, Active route, Unplayable stations*/}
        {visibleLayers.includes("stations") && <StationsLayer />}
        {visibleLayers.includes("trains") && <TrainsLayer />}
        {visibleLayers.includes("passive-signals") && <PassiveSignalsLayer signals={signals} />}
        {visibleLayers.includes("active-signals") && <ActiveSignalsLayer signals={signals} />}
        {visibleLayers.includes("selected-route") && <SelectedTrainRouteLayer />}
        {visibleLayers.includes("unplayable-stations") && <UnplayableStationsLayer />}
      </MapContainer>
    </>
  );
};

export default MainMap;
