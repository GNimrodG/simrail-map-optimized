import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import L from "leaflet";
import { type FunctionComponent, useCallback, useMemo, useState } from "react";
import { useMap } from "react-leaflet";

import { Station } from "../../utils/data-manager";
import { getSignalsForStation, getStationGeometry, goToSignal } from "../../utils/geom-utils";
import { ProfileResponse } from "../../utils/steam";
import InfoIcon from "../icons/InfoIcon";
import SteamProfileDisplay from "../SteamProfileDisplay";
import SignalSpeedDisplay from "../utils/SignalSpeedDisplay";

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
  const map = useMap();
  const [stationArea, setStationArea] = useState<L.Polygon | null>(
    STATION_AREA_MAP.get(station.id) || null
  );
  const signals = useMemo(() => getSignalsForStation(station), [station]);

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

  return (
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
              sx={{ maxWidth: "max(20vw, 200px)", height: "min(200px, 90vh)", overflowY: "auto" }}>
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
  );
};

export default StationMarkerPopup;
