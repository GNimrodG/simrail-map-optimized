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

import {
  DataCallback,
  offData,
  onData,
  SignalWithTrain,
  Station,
  Train,
} from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../utils/steam";
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

const LAYERS = [
  { name: "Stations", key: "stations" },
  { name: "Trains", key: "trains" },
  { name: "Active Signals", key: "active-signals" },
  { name: "Passive Signals", key: "passive-signals" },
  { name: "Selected Route", key: "selected-route" },
  { name: "Unplayable Stations", key: "unplayable-stations" },
];

const MainMap: FunctionComponent<MapProps> = () => {
  const [map, setMap] = useState<LeafletMap | null>(null);

  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);

  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [signals, setSignals] = useState<SignalWithTrain[]>([]);

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
    const handler: DataCallback = (data) => {
      setTrains(data.trains || []);
      setStations(data.stations || []);
      setSignals(data.signals || []);
    };

    onData(handler);

    return () => {
      offData(handler);
    };
  }, []);

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
      {!trains.length && !stations.length && <Loading />}
      <MapContainer
        ref={setMap}
        center={[51.015482, 19.572143]}
        zoom={8}
        scrollWheelZoom={true}
        style={{ height: "100vh", width: "100vw" }}>
        <TileLayer
          attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
        {visibleLayers.includes("stations") && <StationsLayer stations={stations} />}
        {visibleLayers.includes("trains") && <TrainsLayer trains={trains} />}
        {visibleLayers.includes("passive-signals") && <PassiveSignalsLayer signals={signals} />}
        {visibleLayers.includes("active-signals") && <ActiveSignalsLayer signals={signals} />}
        {visibleLayers.includes("selected-route") && <SelectedTrainRouteLayer />}
        {visibleLayers.includes("unplayable-stations") && <UnplayableStationsLayer />}
      </MapContainer>
    </>
  );
};

export default MainMap;
