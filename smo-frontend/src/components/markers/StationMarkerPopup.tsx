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
import { type FunctionComponent, lazy, Suspense, useCallback, useMemo, useState, useTransition } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";

import _stationLayouts from "../../assets/station-layouts.json";
import { Station } from "../../utils/data-manager";
import { getSignalsForStation, getStationGeometry, goToSignal } from "../../utils/geom-utils";
import { ProfileResponse } from "../../utils/steam";
import InfoIcon from "../icons/InfoIcon";
import Loading from "../Loading";
import SteamProfileDisplay from "../SteamProfileDisplay";
import SignalSpeedDisplay from "../utils/SignalSpeedDisplay";

const StationLayout = lazy(() => import("../StationLayout"));

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

const StationMarkerPopup: FunctionComponent<StationMarkerPopupProps> = ({ station, userData, onClosePopup }) => {
  const { t } = useTranslation("translation", { keyPrefix: "StationMarkerPopup" });
  const [isPending, startTransition] = useTransition();
  const map = useMap();
  const [stationArea, setStationArea] = useState<L.Polygon | null>(STATION_AREA_MAP.get(station.id) || null);
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

  const layoutDefs = useMemo(() => {
    const defs = (station.Prefix && StationLayouts[station.Prefix]?._defs) || null;
    if (!defs) return null;

    if (stationLayoutVariant?.endsWith("-inverted")) {
      return Object.fromEntries(
        Object.entries(defs).map(([key, [s1, s2, t, s1l, s2l]]) => [key, [s2, s1, t, s2l, s1l]]),
      );
    }

    return defs;
  }, [station.Prefix, stationLayoutVariant]);

  const layoutOptions = useMemo(
    () =>
      (station.Prefix && Object.keys(StationLayouts[station.Prefix] || {}).filter((x) => !!x && !x.startsWith("_"))) ||
      [],
    [station.Prefix],
  );

  const layout: string[] | null = useMemo(
    () => (stationLayoutVariant && StationLayouts[station.Prefix][stationLayoutVariant]) || null,
    [station.Prefix, stationLayoutVariant],
  );

  return (
    <>
      {isPending && <Loading color="warning" />}
      <Stack alignItems="center" spacing={1}>
        {station.MainImageURL && <img style={{ width: 300 }} src={station.MainImageURL} alt={station.Name} />}
        <Typography level="h4" endDecorator={station.Prefix && <Chip>{station.Prefix}</Chip>}>
          {station.Name}
        </Typography>
        {station.DifficultyLevel >= 0 ? (
          <Typography>{t("Difficulty", { difficulty: station.DifficultyLevel })}</Typography>
        ) : (
          <Typography level="body-lg" color="warning" variant="solid" noWrap>
            {t("UnplayableStation")}
          </Typography>
        )}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography component="div">{t("SignalCount", { signalCount: signals.length })}</Typography>
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
                <Table size="sm" hoverRow stickyHeader>
                  <thead>
                    <tr>
                      <th scope="col">{t("Signal")}</th>
                      <th scope="col">{t("Role")}</th>
                      <th scope="col">{t("Speed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals
                      .sort((a, b) => {
                        const nameA = RegExp(/(.+?\D+)(\d+)$/).exec(a.name);
                        const nameB = RegExp(/(.+?\D+)(\d+)$/).exec(b.name);
                        if (nameA && nameB) {
                          if (nameA[1] === nameB[1]) {
                            return parseInt(nameA[2], 10) - parseInt(nameB[2], 10);
                          }
                          return nameA[1].localeCompare(nameB[1]);
                        }
                        return a.name.localeCompare(b.name);
                      })
                      .map((signal) => (
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
                            <Typography>{signal.train && <SignalSpeedDisplay train={signal.train} />}</Typography>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </Box>
            }>
            <Stack alignItems="center" justifyContent="center">
              <InfoIcon />
            </Stack>
          </Tooltip>
        </Stack>
        {userData && station.DispatchedBy?.[0]?.SteamId && (
          <SteamProfileDisplay profile={userData} steamId={station.DispatchedBy[0].SteamId} />
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
            {t("ShowStationLayout")}
          </Button>
        )}
        {!!signals.length &&
          (stationArea ? (
            <Button fullWidth variant="solid" color="danger" onClick={hideStationArea}>
              {t("HideStationArea")}
            </Button>
          ) : (
            <Button fullWidth variant="solid" color="success" onClick={showStationArea}>
              {t("ShowStationArea")}
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
          <Typography level="h3" textAlign="center">
            {t("StationLayoutTitle", { stationName: station.Name })}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ margin: 1 }}>
            <Typography
              component="label"
              endDecorator={
                <Switch
                  disabled={isPending}
                  checked={stationLayoutShowTexts}
                  onChange={(e) => startTransition(() => setStationLayoutShowTexts(e.target.checked))}
                />
              }>
              {t("ShowTexts")}
            </Typography>
          </Stack>

          {layoutOptions.length > 1 && (
            <Tabs
              value={stationLayoutVariant}
              onChange={(_e, v) => startTransition(() => setStationLayoutVariant(v as string))}>
              <TabList>
                {layoutOptions.map((variant) => (
                  <Tab key={variant} disabled={isPending} value={variant}>
                    {t("StationLayout.Names." + (variant.endsWith("-inverted") ? variant.slice(0, -9) : variant))}
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
            <Suspense fallback={<Loading color="neutral" />}>
              {layout && layoutDefs && (
                <StationLayout layout={layout} defs={layoutDefs} showText={stationLayoutShowTexts} />
              )}
            </Suspense>
          </Box>
          <Typography level="body-sm">
            <Trans
              i18nKey="StationMarkerPopup.HelpText"
              components={[
                <Typography key="helper-success" color="success" />,
                <Typography key="helper-body-xs" level="body-xs" />,
              ]}
            />
          </Typography>
        </Sheet>
      </Modal>
    </>
  );
};

export default StationMarkerPopup;
