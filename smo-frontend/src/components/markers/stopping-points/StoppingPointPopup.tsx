import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useContext, useTransition } from "react";
import { useTranslation } from "react-i18next";

import useStationTimetableEntries from "../../../hooks/useStationTimetableEntries";
import SelectedStationTimetableContext from "../../../utils/selected-station-timetable-context";
import { OsmNode } from "../../../utils/types";
import Loading from "../../Loading";

export interface StoppingPointPopupProps {
  stop: OsmNode;
}

const StoppingPointPopup: FunctionComponent<StoppingPointPopupProps> = ({ stop }) => {
  const { t, i18n } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const { setSelectedStationTimetable } = useContext(SelectedStationTimetableContext);

  const { stationTimetable, loading: timetableLoading } = useStationTimetableEntries(stop.tags.name);

  return (
    <>
      {isPending && <Loading color="warning" />}
      <Stack alignItems="center" spacing={1}>
        <Typography level="title-lg">{stop.tags.name}</Typography>
        {stop.tags[`name:${i18n.language}`] && stop.tags[`name:${i18n.language}`] !== stop.tags.name && (
          <Typography level="title-md" color="neutral">
            {stop.tags[`name:${i18n.language}`]}
          </Typography>
        )}
        {stop.tags.operator && (
          <Typography level="body-sm" color="neutral">
            {stop.tags.operator}
          </Typography>
        )}
        <Button
          fullWidth
          loading={timetableLoading}
          disabled={!stationTimetable?.length}
          variant="solid"
          color="neutral"
          onClick={() => startTransition(() => setSelectedStationTimetable(stop.tags.name))}>
          {t(
            stationTimetable && !stationTimetable.length
              ? "StationMarkerPopup.Timetable.Unavailabe"
              : "StationMarkerPopup.Timetable.Button",
          )}
        </Button>
      </Stack>
    </>
  );
};

export default StoppingPointPopup;
