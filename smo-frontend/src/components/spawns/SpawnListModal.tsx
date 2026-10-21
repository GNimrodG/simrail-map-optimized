import { useLocalStorage } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import DialogTitle from "@mui/joy/DialogTitle";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Table from "@mui/joy/Table";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import moment from "moment";
import { type FunctionComponent, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import useBehaviorSubj from "../../hooks/useBehaviorSubj";
import useNow from "../../hooks/useNow";
import useSpawnList, { SPAWN_LIST_HOURS } from "../../hooks/useSpawnList";
import { dataProvider } from "../../utils/data-manager";
import SelectedTrainContext from "../../utils/selected-train-context";
import { closeSpawnList, openSpawnList, spawnListRequest$ } from "../../utils/spawn-list";
import type { SpawnListEntry } from "../../utils/types";
import InfoIcon from "../icons/InfoIcon";
import SpawnIcon from "../icons/spawn.svg?react";
import LengthIcon from "../markers/icons/LengthIcon";
import WeightIcon from "../markers/icons/WeightIcon";
import TrainConsistDisplay from "../markers/train/TrainConsistDisplay";
import { summarizeConsist } from "../utils/general-utils";

const ALL_BORDERS = "__all__";

const STATUS_COLORS = {
  Upcoming: "neutral",
  Overdue: "warning",
  Spawned: "success",
} as const;

/** Whether a train's number, name, type, border, entry point or route contains the search text. */
const matchesSearch = (search: string) => (entry: SpawnListEntry) =>
  [
    entry.trainNoLocal,
    entry.trainName,
    entry.trainType,
    entry.border,
    entry.entry,
    entry.startStation,
    entry.endStation,
  ].some((text) => text.toLocaleLowerCase().includes(search));

/** Whether a train spawns at or into one of the timetable points. */
const matches = (names: string[]) => (entry: SpawnListEntry) =>
  names.includes(entry.border) || names.includes(entry.entry);

/**
 * The consist of a train: a summary with the vehicles in a tooltip, or the locomotive from the timetable when the
 * consist is unknown.
 */
const ConsistChip: FunctionComponent<{ entry: SpawnListEntry }> = ({ entry }) => {
  const { t } = useTranslation("translation", { keyPrefix: "SpawnList" });
  const summary = summarizeConsist(entry.consist);

  if (!entry.consist || !summary)
    return (
      <Chip size="sm" variant="soft" startDecorator={<InfoIcon />}>
        {entry.locoType}
      </Chip>
    );

  return (
    <Tooltip
      arrow
      variant="outlined"
      placement="right"
      describeChild
      title={
        <Stack spacing={0.5}>
          {entry.consistFromLastRun && (
            <Typography level="body-xs" textColor="text.tertiary">
              {t("ConsistFromLastRun")}
            </Typography>
          )}
          <TrainConsistDisplay consist={entry.consist} />
        </Stack>
      }>
      <Chip size="sm" variant={entry.consistFromLastRun ? "outlined" : "soft"} startDecorator={<InfoIcon />}>
        {summary}
      </Chip>
    </Tooltip>
  );
};

/**
 * The trains that spawn (enter the map) at the border stations soon, for the whole server or one border station.
 */
const SpawnListModal: FunctionComponent = () => {
  const { t } = useTranslation("translation", { keyPrefix: "SpawnList" });
  const { setSelectedTrain } = useContext(SelectedTrainContext);
  const request = useBehaviorSubj(spawnListRequest$);
  const selectedServer = useBehaviorSubj(dataProvider.selectedServerData$);
  const isOpen = request !== null;
  const entries = useSpawnList(isOpen);
  useNow(10_000); // keeps the countdowns current

  const [border, setBorder] = useState(request?.station ?? ALL_BORDERS);
  const [search, setSearch] = useState("");
  // a preference, kept across openings and reloads
  const [hideSpawned, setHideSpawned] = useLocalStorage({ key: "spawnListHideSpawned", defaultValue: false });
  // every opening starts fresh, an old search could hide the trains of the station it was opened for
  const [lastRequest, setLastRequest] = useState(request);
  if (request !== lastRequest) {
    setLastRequest(request);
    if (request) {
      setBorder(request.station ?? ALL_BORDERS);
      setSearch("");
    }
  }

  // the border stations with their number of upcoming trains, and the station the list was opened for
  const borderOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries ?? []) counts.set(entry.border, (counts.get(entry.border) ?? 0) + 1);
    // a station the list was opened for matches the trains spawning into it too, like the filter
    if (request?.station) counts.set(request.station, (entries ?? []).filter(matches(request.names)).length);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries, request]);

  const shownEntries = useMemo(() => {
    let shown = entries ?? [];

    if (hideSpawned) shown = shown.filter((e) => e.status !== "Spawned");

    if (border !== ALL_BORDERS) {
      // the station the list was opened for includes its sub-stations, the other options are border stations
      const names = border === request?.station ? request.names : [border];
      shown = shown.filter(matches(names));
    }

    const searchText = search.trim().toLocaleLowerCase();
    return searchText ? shown.filter(matchesSearch(searchText)) : shown;
  }, [entries, border, request, search, hideSpawned]);

  // the line after the last spawned train separates the trains that are on the map from the ones still to come
  const lastSpawnedIndex = shownEntries.findLastIndex((e) => e.status === "Spawned");

  const showTrain = (entry: SpawnListEntry) => {
    setSelectedTrain({ trainNo: entry.trainNoLocal, follow: true, paused: false });
    closeSpawnList();
  };

  return (
    <>
      <Tooltip title={t("ButtonTooltip")} placement="left" variant="outlined" arrow>
        <IconButton
          variant="outlined"
          color="neutral"
          sx={{ backgroundColor: "var(--joy-palette-background-surface)" }}
          onClick={() => (isOpen ? closeSpawnList() : openSpawnList())}>
          <SpawnIcon />
        </IconButton>
      </Tooltip>

      <Modal open={isOpen} onClose={closeSpawnList}>
        <ModalDialog
          sx={{
            width: "min(1200px, 95vw)",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
          <ModalClose variant="plain" />
          <Stack spacing={1.5} sx={{ flex: 1, overflow: "hidden" }}>
            <DialogTitle component="div">{t("Title", { server: selectedServer?.ServerName })}</DialogTitle>
            <Typography level="body-sm" textColor="text.tertiary">
              {t("Description", { hours: SPAWN_LIST_HOURS })}
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Select
                size="sm"
                value={border}
                onChange={(_e, value) => value && setBorder(value)}
                sx={{ flex: 1, maxWidth: { sm: "24rem" } }}>
                <Option value={ALL_BORDERS}>{t("AllBorders")}</Option>
                {borderOptions.map(([name, count]) => (
                  <Option key={name} value={name}>
                    <span translate="no">{name}</span> ({count})
                  </Option>
                ))}
              </Select>
              <Input
                size="sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("SearchPlaceholder")}
                slotProps={{ input: { "aria-label": t("SearchPlaceholder") } }}
                sx={{ flex: 1 }}
              />
              <Typography
                component="label"
                level="body-sm"
                sx={{ alignSelf: { sm: "center" }, whiteSpace: "nowrap" }}
                startDecorator={
                  <Switch
                    size="sm"
                    checked={hideSpawned}
                    onChange={(e) => setHideSpawned(e.target.checked)}
                    sx={{ mr: 0.5 }}
                  />
                }>
                {t("HideSpawned")}
              </Typography>
            </Stack>

            {entries === null && <LinearProgress variant="soft" thickness={2} />}

            <Box sx={{ flex: 1, overflowY: "auto" }}>
              {entries !== null && !shownEntries.length ? (
                <Typography level="body-md" sx={{ p: 2, textAlign: "center" }}>
                  {t(entries.length ? "EmptyForBorder" : "Empty")}
                </Typography>
              ) : (
                <Table
                  size="sm"
                  stickyHeader
                  hoverRow
                  sx={{
                    "& tr[data-last-spawned] > td": {
                      borderBottom: "2px solid var(--joy-palette-primary-solidBg)",
                    },
                  }}>
                  <thead>
                    <tr>
                      <th style={{ width: "10.5rem" }}>{t("Time")}</th>
                      <th style={{ width: "22rem" }}>{t("Train")}</th>
                      <th>{t("Border")}</th>
                      <th>{t("Route")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownEntries.map((entry, index) => (
                      <tr
                        key={`${entry.trainNoLocal}-${entry.scheduledTime}`}
                        data-last-spawned={index === lastSpawnedIndex || undefined}
                        onClick={entry.status === "Spawned" ? () => showTrain(entry) : undefined}
                        style={{ cursor: entry.status === "Spawned" ? "pointer" : undefined }}>
                        <td>
                          <Tooltip
                            title={t("ScheduledAtBorder", {
                              time: entry.scheduledTime.slice(11, 16),
                              border: entry.border,
                            })}
                            placement="right"
                            arrow>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ width: "fit-content" }}>
                              <Typography level="title-sm" translate="no">
                                {entry.expectedTime.slice(11, 16)}
                              </Typography>
                              {entry.status !== "Upcoming" && (
                                <Chip size="sm" variant="soft" color={STATUS_COLORS[entry.status]}>
                                  {t(`Status.${entry.status}`)}
                                </Chip>
                              )}
                            </Stack>
                          </Tooltip>
                          <Typography level="body-xs" textColor="text.tertiary" translate="no">
                            {t(`Relative.${entry.status}`, { relative: moment(entry.expectedAt).fromNow() })}
                          </Typography>
                        </td>
                        <td translate="no">
                          <Stack direction="row" spacing={0.75} alignItems="baseline">
                            <Typography level="title-sm">{entry.trainNoLocal}</Typography>
                            <Typography level="body-xs">
                              {entry.trainName}
                              {entry.trainType !== entry.trainName && ` · ${entry.trainType}`}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                            <ConsistChip entry={entry} />
                            <Chip size="sm" variant="soft" startDecorator={<LengthIcon />}>
                              {`${entry.trainLength} m`}
                            </Chip>
                            <Chip size="sm" variant="soft" startDecorator={<WeightIcon />}>
                              {`${entry.trainWeight} t`}
                            </Chip>
                          </Stack>
                        </td>
                        <td translate="no">
                          <Typography level="body-sm">{entry.border}</Typography>
                          <Typography level="body-xs" textColor="text.tertiary">
                            → {entry.entry}
                          </Typography>
                        </td>
                        <td translate="no">
                          <Typography level="body-sm">
                            {entry.startStation} → {entry.endStation}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>
    </>
  );
};

export default SpawnListModal;
