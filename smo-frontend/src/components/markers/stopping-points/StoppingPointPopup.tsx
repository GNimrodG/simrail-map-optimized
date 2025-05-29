import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

import { OsmNode } from "../../../utils/types";
import useStationTimetableEntries from "../../../utils/use-station-timetable-entries";
import Loading from "../../Loading";
import StationTimetableModal from "../../timetable/StationTimetableModal";

export interface StoppingPointPopupProps {
  stop: OsmNode;
}

const StoppingPointPopup: FunctionComponent<StoppingPointPopupProps> = ({ stop }) => {
  const { t, i18n } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [timetableModalOpen, setTimetableModalOpen] = useState(false);

  const stationTimetable = useStationTimetableEntries(stop.tags.name);

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
          loading={!stationTimetable}
          disabled={!stationTimetable?.length}
          variant="solid"
          color="neutral"
          onClick={() => startTransition(() => setTimetableModalOpen(true))}>
          {t(
            stationTimetable && !stationTimetable.length
              ? "StationMarkerPopup.Timetable.Unavailabe"
              : "StationMarkerPopup.Timetable.Button",
          )}
        </Button>
      </Stack>

      <StationTimetableModal
        open={timetableModalOpen}
        onClose={() => setTimetableModalOpen(false)}
        stationName={stop.tags.name}
        stationTimetable={stationTimetable}
      />
    </>
  );
};

export default StoppingPointPopup;
