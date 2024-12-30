import { type FunctionComponent, useContext, useMemo } from "react";
import { Button, Stack, Typography } from "@mui/joy";
import { useTranslation } from "react-i18next";

import { Train, TrainConsistPart } from "../../utils/data-manager";
import SelectedTrainContext from "../../utils/selected-train-context";
import { getColorTrainMarker } from "../../utils/ui";
import { useSetting } from "../../utils/use-setting";
import SteamProfileDisplay from "../SteamProfileDisplay";
import SignalSpeedDisplay from "../utils/SignalSpeedDisplay";
import AutoZoomCheckbox from "../AutoZoomCheckbox";

export interface TrainMarkerPopupProps {
  train: Train;
  userData: any;
  showTrainRouteButton?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const TrainMarkerPopup: FunctionComponent<TrainMarkerPopupProps> = ({
  train,
  userData,
  showTrainRouteButton,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainMakerPopup" });
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const [expandScheduleDefault] = useSetting("expandScheduleDefault");

  const isSelected = useMemo(() => selectedTrain?.trainNo === train.TrainNoLocal, [selectedTrain, train.TrainNoLocal]);

  const handleFollowToggle = () => {
    if (isSelected) {
      setSelectedTrain(
        selectedTrain?.trainNo
          ? { trainNo: selectedTrain.trainNo, follow: !selectedTrain.follow, paused: false }
          : null,
      );
    } else {
      setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true, paused: false });
    }
  };

  const handlePinToggle = () => {
    if (isSelected) {
      setSelectedTrain(
        selectedTrain?.trainNo ? { trainNo: selectedTrain.trainNo, follow: selectedTrain.follow, paused: false } : null,
      );
    } else {
      setSelectedTrain({ trainNo: train.TrainNoLocal, follow: false, paused: false });
    }
  };

  return (
    <Stack spacing={1}>
      <Typography level="h6" textAlign="center">
        {train.TrainNoLocal} - {train.TrainData.TrainName}
      </Typography>
      {userData && <SteamProfileDisplay userData={userData} />}
      <Typography level="body2" textAlign="center">
        {t("NextSignal")} <SignalSpeedDisplay train={train} />
      </Typography>
      <Typography level="body2" textAlign="center">
        {t("Consist")}
      </Typography>
      <Stack spacing={0.5}>
        {train.TrainData.Consist.map((part: TrainConsistPart, index: number) => (
          <Typography key={index} level="body2" textAlign="center">
            {part.Type} - {part.Name}
          </Typography>
        ))}
      </Stack>
      {train.TrainData.OOB && (
        <Typography level="body2" textAlign="center" color="danger">
          {t("OOB")}
        </Typography>
      )}
      <Stack direction="row" spacing={1} justifyContent="center">
        <Button variant="outlined" color="neutral" onClick={handleFollowToggle}>
          {isSelected && selectedTrain?.follow ? t("Unfollow") : t("Follow")}
        </Button>
        <Button variant="outlined" color="neutral" onClick={handlePinToggle}>
          {isSelected ? t("Unpin") : t("Pin")}
        </Button>
      </Stack>
      <AutoZoomCheckbox />
      {showTrainRouteButton && (
        <Button variant="outlined" color="neutral" onClick={onToggleCollapse}>
          {isCollapsed ? t("ShowRoute") : t("HideRoute")}
        </Button>
      )}
    </Stack>
  );
};

export default TrainMarkerPopup;
