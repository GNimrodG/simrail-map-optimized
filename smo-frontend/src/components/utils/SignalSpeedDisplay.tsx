import Typography from "@mui/joy/Typography";
import { type FunctionComponent, memo } from "react";

import { Train } from "../../utils/types";
import { getColorTrainMarker } from "../../utils/ui";

export interface SignalSpeedDisplayProps {
  train: Train;
}

// translate="no": browser page translation replaces text nodes, which crashes React when the value changes
const SignalSpeedDisplay: FunctionComponent<SignalSpeedDisplayProps> = ({ train }) => {
  if (typeof train?.TrainData?.SignalInFrontSpeed === "undefined" || train?.TrainData?.SignalInFrontSpeed === null) {
    return (
      <Typography translate="no" component="span" color="warning" variant="outlined" textAlign="center">
        N/A
      </Typography>
    );
  }

  return train.TrainData.SignalInFrontSpeed > 200 ? (
    <Typography translate="no" component="span" color="success" variant="outlined" textAlign="center">
      VMAX
    </Typography>
  ) : (
    <Typography
      translate="no"
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
