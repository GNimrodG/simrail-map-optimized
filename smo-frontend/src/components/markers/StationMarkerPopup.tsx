import { useLocalStorage } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Tab from "@mui/joy/Tab";
import Table from "@mui/joy/Table";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import L from "leaflet";
import { type FunctionComponent, useCallback, useMemo, useState, useTransition } from "react";
import { useMap } from "react-leaflet";

import _stationLayouts from "../../assets/station-layouts.json";
import { Station } from "../../utils/data-manager";
import { getSignalsForStation, getStationGeometry, goToSignal } from "../../utils/geom-utils";
import { ProfileResponse } from "../../utils/steam";
import InfoIcon from "../icons/InfoIcon";
import Loading from "../Loading";
import StationLayout from "../StationLayout";
import SteamProfileDisplay from "../SteamProfileDisplay";
import SignalSpeedDisplay from "../utils/SignalSpeedDisplay";

type StationLayouts = Record<
  string,
  {
    [key: string]: string[];
  } & {
    _defs: Record<string, string[]>;
  }
>;

const StationLayouts = _stationLayouts as unknown as StationLayouts;

export interface StationMarkerPopupProps {
  station: Station;
  userData: ProfileResponse | null;
  onClosePopup: () => void;
}

const STATION_AREA_MAP = new Map<string, L.Polygon>();

const StationMarkerPopup: FunctionComponent<StationMarkerPopupProps> = ({
  station,
  userData,
  onClosePopup,
}) => {
  const [isPending, startTransition] = useTransition();
  const map = useMap();
  const [stationArea, setStationArea] = useState<L.Polygon | null>(
    STATION_AREA_MAP.get(station.id) || null
  );
  const signals = useMemo(() => getSignalsForStation(station), [station]);

  const [stationLayoutModalOpen, setStationLayoutModalOpen] = useState(false);
  const [stationLayoutVariant, setStationLayoutVariant] = useState<string | null>(null);
  const [stationLayoutShowTexts, setStationLayoutShowTexts] = useLocalStorage({
    key: "station-layout-show-texts",
    defaultValue: true,
  });

  const showStationArea = useCallback(() => {
    const polygon = L.polygon(getStationGeometry(station), {
      color: "blue",
      fillColor: "#03f",
      fillOpacity: 0.5,
    });

    polygon.addTo(map);

    STATION_AREA_MAP.set(station.id, polygon);
    setStationArea(polygon);
  }, [station, map]);

  const hideStationArea = useCallback(() => {
    if (stationArea) {
      map.removeLayer(stationArea);
      STATION_AREA_MAP.delete(station.id);
      setStationArea(null);
    }
  }, [map, station.id, stationArea]);

  const layoutDefs = useMemo(
    () => (station.Prefix && StationLayouts[station.Prefix]._defs) || null,
    [station.Prefix]
  );

  const layoutOptions = useMemo(
    () =>
      (station.Prefix &&
        Object.keys(StationLayouts[station.Prefix]).filter((x) => !!x && !x.startsWith("_"))) ||
      [],
    [station.Prefix]
  );

  const layout: string[] | null = useMemo(
    () => (stationLayoutVariant && StationLayouts[station.Prefix][stationLayoutVariant]) || null,
    [station.Prefix, stationLayoutVariant]
  );

  return (
    <>
      {isPending && <Loading color="warning" />}
      <Stack
        alignItems="center"
        spacing={1}>
        {station.MainImageURL && (
          <img
            style={{ width: 300 }}
            src={station.MainImageURL}
            alt={station.Name}
          />
        )}
        <Typography
          level="h4"
          endDecorator={station.Prefix && <Chip>{station.Prefix}</Chip>}>
          {station.Name}
        </Typography>
        {station.DifficultyLevel >= 0 ? (
          <Typography>Difficulty: {station.DifficultyLevel}</Typography>
        ) : (
          <Typography
            level="body-lg"
            color="warning"
            variant="solid"
            noWrap>
            Unplayable station
          </Typography>
        )}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center">
          <Typography component="div">Signals: {signals.length}</Typography>
          <Tooltip
            arrow
            variant="outlined"
            placement="bottom"
            describeChild
            title={
              <Box
                sx={{
                  maxWidth: "max(20vw, 200px)",
                  height: "min(200px, 90vh)",
                  overflowY: "auto",
                }}>
                <Table
                  size="sm"
                  hoverRow
                  stickyHeader>
                  <thead>
                    <tr>
                      <th scope="col">Signal</th>
                      <th scope="col">Role</th>
                      <th scope="col">Speed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((signal) => (
                      <tr
                        style={{ cursor: "pointer" }}
                        key={signal.name}
                        onClick={() => {
                          onClosePopup();
                          goToSignal(signal, map);
                        }}>
                        <td>{signal.name}</td>
                        <td>{signal.role}</td>
                        <td>
                          <Typography>
                            {signal.train && <SignalSpeedDisplay train={signal.train} />}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Box>
            }>
            <Stack
              alignItems="center"
              justifyContent="center">
              <InfoIcon />
            </Stack>
          </Tooltip>
        </Stack>
        {userData && station.DispatchedBy?.[0]?.SteamId && (
          <SteamProfileDisplay
            profile={userData}
            steamId={station.DispatchedBy[0].SteamId}
          />
        )}
        {!!layoutDefs && (
          <Button
            fullWidth
            variant="solid"
            onClick={() => {
              startTransition(() => {
                setStationLayoutVariant(layoutOptions[0]);
                setStationLayoutModalOpen(true);
              });
            }}>
            Show Station Layout
          </Button>
        )}
        {!!signals.length &&
          (stationArea ? (
            <Button
              fullWidth
              variant="solid"
              color="danger"
              onClick={hideStationArea}>
              Hide Station Area
            </Button>
          ) : (
            <Button
              fullWidth
              variant="solid"
              color="success"
              onClick={showStationArea}>
              Show Station Area
            </Button>
          ))}
      </Stack>

      <Modal
        hideBackdrop
        open={stationLayoutModalOpen}
        onClose={() => setStationLayoutModalOpen(false)}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "md",
            p: 1,
            boxShadow: "lg",
            position: "relative",
          }}>
          {isPending && <Loading color="warning" />}
          <ModalClose
            variant="plain"
            sx={{
              position: "absolute",
              top: (theme) => theme.spacing(1),
              right: (theme) => theme.spacing(1),
            }}
          />
          <Typography
            level="h3"
            textAlign="center">
            {station.Name} - Station Layout
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ margin: 1 }}>
            <Typography
              component="label"
              endDecorator={
                <Switch
                  disabled={isPending}
                  checked={stationLayoutShowTexts}
                  onChange={(e) =>
                    startTransition(() => setStationLayoutShowTexts(e.target.checked))
                  }
                />
              }>
              Show texts
            </Typography>
          </Stack>

          {layoutOptions.length > 1 && (
            <Tabs
              value={stationLayoutVariant}
              onChange={(_e, v) => startTransition(() => setStationLayoutVariant(v as string))}>
              <TabList>
                {layoutOptions.map((variant) => (
                  <Tab
                    key={variant}
                    disabled={isPending}
                    value={variant}>
                    {variant}
                  </Tab>
                ))}
              </TabList>
            </Tabs>
          )}

          <Box
            sx={{
              minWidth: "80vw",
              minHeight: "50vh",
              maxWidth: "90vw",
              maxHeight: "80vh",
              overflow: "scroll",
            }}>
            {layout && layoutDefs && (
              <StationLayout
                layout={layout}
                defs={layoutDefs}
                showText={stationLayoutShowTexts}
              />
            )}
          </Box>
          <Typography level="body-sm">
            <Typography color="success">Green</Typography> lines are VMAX lines.{" "}
            <Typography level="body-xs">They're not active paths set by the dispatcher.</Typography>{" "}
            The background color of a block indicates the train's speed that's currently in it.
          </Typography>
        </Sheet>
      </Modal>
    </>
  );
};

export default StationMarkerPopup;
