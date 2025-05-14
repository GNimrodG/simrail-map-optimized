import { useLocalStorage } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
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
import {
  type FunctionComponent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";

import _stationLayouts from "../../assets/station-layouts.json";
import _wikiLinks from "../../assets/wiki-links.json";
import { dataProvider } from "../../utils/data-manager";
import { getSignalsForStation, getStationGeometry, goToSignal } from "../../utils/geom-utils";
import { ProfileResponse } from "../../utils/steam";
import { SimplifiedTimtableEntry, Station } from "../../utils/types";
import InfoIcon from "../icons/InfoIcon";
import Loading from "../Loading";
import MapTimeDisplay from "../MapTimeDisplay";
import SteamProfileDisplay from "../SteamProfileDisplay";
import SignalSpeedDisplay from "../utils/SignalSpeedDisplay";
import RemoteControlStationDisplay from "./RemoteControlStationDisplay";
import StationTimetableDisplay from "./StationTimetableDisplay";

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
const WikiLinks = _wikiLinks as Record<string, string>;

const useStationTimetableEntries = (stationName: string) => {
  const [stationTimetable, setStationTimetable] = useState<SimplifiedTimtableEntry[] | null>(null);

  useEffect(() => {
    dataProvider.getStationTimetable(stationName).then((entries) => {
      setStationTimetable(entries);
    });

    return () => {
      setStationTimetable(null);
    };
  }, [stationName]);

  return stationTimetable;
};

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
  const [stationArea, setStationArea] = useState<L.Polygon | null>(STATION_AREA_MAP.get(station.Id) || null);
  const signals = useMemo(() => getSignalsForStation(station), [station]);

  const [stationLayoutModalOpen, setStationLayoutModalOpen] = useState(false);
  const [stationLayoutVariant, setStationLayoutVariant] = useState<string | null>(null);
  const [stationLayoutShowTexts, setStationLayoutShowTexts] = useLocalStorage({
    key: "station-layout-show-texts",
    defaultValue: true,
  });

  const [timetableModalOpen, setTimetableModalOpen] = useState(false);

  const stationTimetable = useStationTimetableEntries(station.Name);

  const showStationArea = useCallback(() => {
    const polygon = L.polygon(getStationGeometry(station), {
      color: "blue",
      fillColor: "#03f",
      fillOpacity: 0.5,
    });

    polygon.addTo(map);

    STATION_AREA_MAP.set(station.Id, polygon);
    setStationArea(polygon);
  }, [station, map]);

  const hideStationArea = useCallback(() => {
    if (stationArea) {
      map.removeLayer(stationArea);
      STATION_AREA_MAP.delete(station.Id);
      setStationArea(null);
    }
  }, [map, station.Id, stationArea]);

  const layoutDefs = useMemo(() => {
    const defs = (station.Name && StationLayouts[station.Name]?._defs) || null;
    if (!defs) return null;

    if (stationLayoutVariant?.endsWith("-inverted")) {
      return Object.fromEntries(
        Object.entries(defs).map(([key, [s1, s2, t, s1l, s2l]]) => [key, [s2, s1, t, s2l, s1l]]),
      );
    }

    return defs;
  }, [station.Name, stationLayoutVariant]);

  const layoutOptions = useMemo(
    () =>
      (station.Name && Object.keys(StationLayouts[station.Name] || {}).filter((x) => !!x && !x.startsWith("_"))) || [],
    [station.Name],
  );

  const layout: string[] | null = useMemo(
    () => (stationLayoutVariant && StationLayouts[station.Name][stationLayoutVariant]) || null,
    [station.Name, stationLayoutVariant],
  );

  return (
    <>
      {(isPending || !stationTimetable) && <Loading color="warning" />}
      <Stack alignItems="center" spacing={1}>
        {station.MainImageUrl && <img style={{ width: 300 }} src={station.MainImageUrl} alt={station.Name} />}

        <Typography level="h4" endDecorator={station.Prefix && <Chip>{station.Prefix}</Chip>}>
          {station.Name}
        </Typography>

        {station.DifficultyLevel >= 0 ? (
          <Typography>{t("Difficulty", { difficulty: station.DifficultyLevel })}</Typography>
        ) : station.RemoteControlled ? (
          <Typography level="body-lg" color="primary" variant="solid" noWrap>
            {t("RemoteControlled")}
          </Typography>
        ) : (
          <Typography level="body-lg" color="warning" variant="solid" noWrap>
            {t("UnplayableStation")}
          </Typography>
        )}

        <RemoteControlStationDisplay station={station} onClosePopup={onClosePopup} />

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography component="div">{t("SignalCount", { signalCount: signals.length })}</Typography>
          {signals.length !== 0 && (
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
                        .toSorted((a, b) => {
                          const nameA = RegExp(/(.+?\D+)(\d+)$/).exec(a.Name);
                          const nameB = RegExp(/(.+?\D+)(\d+)$/).exec(b.Name);
                          if (nameA && nameB) {
                            if (nameA[1] === nameB[1]) {
                              return parseInt(nameA[2], 10) - parseInt(nameB[2], 10);
                            }
                            return nameA[1].localeCompare(nameB[1]);
                          }
                          return a.Name.localeCompare(b.Name);
                        })
                        .map((signal) => (
                          <tr
                            style={{ cursor: "pointer" }}
                            key={signal.Name}
                            onClick={() => {
                              onClosePopup();
                              goToSignal(signal, map);
                            }}>
                            <td>{signal.Name}</td>
                            <td>{signal.Role}</td>
                            <td>
                              <Typography>
                                {!!signal.Trains?.length && (
                                  <SignalSpeedDisplay
                                    train={
                                      dataProvider.trainsData$.value.find((t) => t.TrainNoLocal === signal.Trains![0])!
                                    }
                                  />
                                )}
                              </Typography>
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
          )}
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

        {!!stationTimetable?.length && (
          <Button
            fullWidth
            variant="solid"
            color="neutral"
            onClick={() => startTransition(() => setTimetableModalOpen(true))}>
            {t("Timetable.Button")}
          </Button>
        )}

        {WikiLinks[station.Name] && (
          <Button
            fullWidth
            variant="solid"
            color="neutral"
            component="a"
            href={WikiLinks[station.Name]}
            target="_blank"
            sx={{
              textTransform: "none",
              color: (theme) => theme.palette.text.primary + " !important",
            }}
            rel="noopener noreferrer">
            {t("WikiLink")}
          </Button>
        )}
      </Stack>

      {/* Station Layout Modal */}
      <Modal
        hideBackdrop
        open={stationLayoutModalOpen}
        onClose={() =>
          startTransition(() => {
            setStationLayoutModalOpen(false);
            setStationLayoutVariant(null);
          })
        }
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

      <Modal open={timetableModalOpen} onClose={() => startTransition(() => setTimetableModalOpen(false))}>
        <ModalDialog sx={{ width: "min(1280px, 95vw)" }}>
          <ModalClose
            variant="plain"
            sx={{
              position: "absolute",
              top: (theme) => theme.spacing(1),
              right: (theme) => theme.spacing(1),
            }}
          />

          <DialogTitle
            sx={(theme) => ({
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              alignItems: "center",
              [theme.breakpoints.down("md")]: {
                gridTemplateColumns: "1fr 1fr",
                mr: 4,
              },
            })}
            component="div">
            {t("Timetable.Title", { stationName: station.Name })} <MapTimeDisplay />
          </DialogTitle>

          {timetableModalOpen && stationTimetable && <StationTimetableDisplay timetable={stationTimetable} />}
        </ModalDialog>
      </Modal>
    </>
  );
};

export default StationMarkerPopup;
