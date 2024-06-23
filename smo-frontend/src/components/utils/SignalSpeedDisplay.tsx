import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { BaseTrain } from "../../utils/data-manager";
import { getColorTrainMarker } from "../../utils/ui";

export interface SignalSpeedDisplayProps {
  train: BaseTrain;
}

const SignalSpeedDisplay: FunctionComponent<SignalSpeedDisplayProps> = ({ train }) => {
  return train.TrainData.SignalInFrontSpeed > 200 ? (
    <Typography
      component="span"
      color="success"
      variant="outlined">
      VMAX
    </Typography>
  ) : (
    <Typography
      component="span"
      color={getColorTrainMarker(train.TrainData.SignalInFrontSpeed)}
      variant="outlined">
      {Math.round(train.TrainData.SignalInFrontSpeed)} km/h
    </Typography>
  );
};

export default SignalSpeedDisplay;
