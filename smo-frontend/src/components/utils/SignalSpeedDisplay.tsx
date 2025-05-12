import Typography from "@mui/joy/Typography";
import { type FunctionComponent, memo } from "react";

import { BaseTrain } from "../../utils/types";
import { getColorTrainMarker } from "../../utils/ui";

export interface SignalSpeedDisplayProps {
  train: BaseTrain;
}

const SignalSpeedDisplay: FunctionComponent<SignalSpeedDisplayProps> = ({ train }) => {
  if (typeof train?.TrainData?.SignalInFrontSpeed === "undefined" || train?.TrainData?.SignalInFrontSpeed === null) {
    return (
      <Typography component="span" color="warning" variant="outlined" textAlign="center">
        N/A
      </Typography>
    );
  }

  return train.TrainData.SignalInFrontSpeed > 200 ? (
    <Typography component="span" color="success" variant="outlined" textAlign="center">
      VMAX
    </Typography>
  ) : (
    <Typography
      component="span"
      color={getColorTrainMarker(train.TrainData.SignalInFrontSpeed)}
      variant="outlined"
      textAlign="center">
      {Math.round(train.TrainData.SignalInFrontSpeed)} km/h
    </Typography>
  );
};

export default memo(SignalSpeedDisplay, (prevProps, nextProps) => {
  return prevProps.train?.TrainData?.SignalInFrontSpeed === nextProps.train?.TrainData?.SignalInFrontSpeed;
});
