import { ColorPaletteProp } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, memo } from "react";
import { useTranslation } from "react-i18next";

import { TimetableEntry } from "../../utils/types";

export interface StopTypeDisplayProps {
  stopType: TimetableEntry["StopType"];
}

const STOP_TYPE_TECHNICAL: Partial<Record<TimetableEntry["StopType"], string>> = {
  CommercialStop: "PH",
  NoncommercialStop: "PT",
};

const STOP_TYPE_COLOR: Partial<Record<TimetableEntry["StopType"], ColorPaletteProp>> = {
  CommercialStop: "primary",
  NoncommercialStop: "neutral",
};

const StopTypeDisplay: FunctionComponent<StopTypeDisplayProps> = ({ stopType }) => {
  const { t } = useTranslation("translation", { keyPrefix: "StationDisplay" });
  return (
    STOP_TYPE_TECHNICAL[stopType] && (
      <>
        {" "}
        <Tooltip arrow title={t(`StopType.${stopType}`)}>
          <Typography variant="outlined" level="body-sm" color={STOP_TYPE_COLOR[stopType]}>
            {STOP_TYPE_TECHNICAL[stopType]}
          </Typography>
        </Tooltip>
      </>
    )
  );
};

export default memo(StopTypeDisplay);
