import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, memo } from "react";
import { useTranslation } from "react-i18next";

import InfoIcon from "../icons/InfoIcon";

export interface TrainTypeDisplayProps {
  type: string;
}

const TrainTypeDisplay: FunctionComponent<TrainTypeDisplayProps> = ({ type }) => {
  const { t, i18n } = useTranslation("translation", { keyPrefix: "TrainTypes" });

  const actualType = type.replace(/^([A-Z]{3}) - ".+/g, "$1");

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <span>{type}</span>
      {i18n.exists(`TrainTypes.${actualType}`) && (
        <Tooltip arrow variant="outlined" placement="right" describeChild title={t(actualType)}>
          <Stack alignItems="center" justifyContent="center">
            <InfoIcon />
          </Stack>
        </Tooltip>
      )}
    </Stack>
  );
};

export default memo(TrainTypeDisplay);
