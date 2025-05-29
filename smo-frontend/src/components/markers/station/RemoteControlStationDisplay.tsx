import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import isEqual from "lodash/isEqual";
import { type FunctionComponent, memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";
import { withLatestFrom } from "rxjs";

import { dataProvider } from "../../../utils/data-manager";
import { goToStation } from "../../../utils/geom-utils";
import { Station } from "../../../utils/types";

export interface RemoteControlStationDisplayProps {
  station: Station;
  onClosePopup?: () => void;
}

const RemoteControlStationDisplay: FunctionComponent<RemoteControlStationDisplayProps> = ({
  station,
  onClosePopup,
}) => {
  const map = useMap();
  const { t } = useTranslation("translation", { keyPrefix: "StationMarkerPopup" });
  const [controlStation, setControlStation] = useState<Station | null>(null);
  const [subStations, setSubStations] = useState<Station[]>([]);

  useEffect(() => {
    if (station.RemoteControlled) {
      const subscription = dataProvider.stationsData$
        .pipe(withLatestFrom(dataProvider.unplayableStations$))
        .subscribe(([stations, unplayableStations]) => {
          const controlStation = [...stations, ...unplayableStations].find(
            (s) => s.Prefix === station.RemoteControlled,
          );

          if (controlStation) {
            setControlStation(controlStation);
          } else {
            setControlStation(null);
          }
        });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setSubStations(dataProvider.unplayableStations$.value.filter((s) => s.RemoteControlled === station.Prefix));
    }
  }, [station.Prefix, station.RemoteControlled]);

  const handleGoToControlStation = () => {
    goToStation(controlStation!, map);
    onClosePopup?.();
  };

  return (
    <>
      {controlStation && (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography level="body-sm" noWrap>
            {t("ControlledBy")}
          </Typography>
          <Chip onClick={handleGoToControlStation}>{controlStation.Name}</Chip>
        </Stack>
      )}

      {subStations.length > 0 && (
        <Stack direction="row" alignItems="center" justifyContent="center" gap={0.5} flexWrap="wrap">
          <Typography level="body-sm" noWrap>
            {t("SubStations")}
          </Typography>
          {subStations.map((s) => (
            <Chip key={s.Name} onClick={() => goToStation(s, map)}>
              {s.Name}
            </Chip>
          ))}
        </Stack>
      )}
    </>
  );
};

export default memo(RemoteControlStationDisplay, isEqual);
