import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";

import CrossingSignsData from "../assets/crossing-signs.json";
import useBehaviorSubj from "../hooks/useBehaviorSubj";
import { dataProvider } from "../utils/data-manager";
import SelectedTrainContext from "../utils/selected-train-context";
import { CrossingSign } from "../utils/types";
import { findUpcomingWhistleSign, isWhistleSign, WhistleSignType } from "../utils/whistle-signs";
import W6Icon from "./markers/icons/crossing-sign-w6.svg?raw";
import W6bIcon from "./markers/icons/crossing-sign-w6b.svg?raw";

const SIGNS = (CrossingSignsData as CrossingSign[]).filter(isWhistleSign);

const ICONS: Record<WhistleSignType, { svg: string; height: string }> = {
  W6: { svg: W6Icon, height: "2.4rem" },
  W6b: { svg: W6bIcon, height: "4.8rem" },
};

/**
 * Warns about the next W6 / W6b sign (the driver gives the "Attention" signal there) ahead of the followed train, with
 * the distance to it, like a navigation app warns about a speed camera. Enabled by the "whistleSignWarnings" setting.
 */
const WhistleSignWarning: FunctionComponent = () => {
  const { t } = useTranslation();
  const { selectedTrain } = useContext(SelectedTrainContext);
  const trains = useBehaviorSubj(dataProvider.trainsData$);

  const train = selectedTrain?.follow ? trains.find((t) => t.TrainNoLocal === selectedTrain.trainNo) : undefined;
  const latitude = train?.TrainData.Latitude;
  const longitude = train?.TrainData.Longitude;
  const heading = train?.TrainData.Heading;
  const velocity = train?.TrainData.Velocity ?? 0;

  const upcoming = useMemo(
    () =>
      latitude != null && longitude != null
        ? findUpcomingWhistleSign(SIGNS, latitude, longitude, heading, velocity)
        : null,
    [latitude, longitude, heading, velocity],
  );

  if (!upcoming) {
    return null;
  }

  const { sign, distance, warningDistance } = upcoming;
  const icon = ICONS[sign.type];

  return (
    <Alert
      variant="solid"
      color="warning"
      role="status"
      startDecorator={
        <Box
          aria-hidden
          sx={{
            "width": "2.8rem",
            "height": icon.height,
            "& svg": { display: "block", width: "100%", height: "100%" },
          }}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      }
      sx={{
        alignItems: "center",
        gap: "1rem",
        width: "min(90vw, 360px)",
        position: "relative",
        overflow: "hidden",
        boxShadow: "lg",
      }}>
      <Box sx={{ flex: 1 }}>
        <Typography level="title-md" textColor="inherit">
          {t(`WhistleSignWarning.${sign.type}`)}
        </Typography>
        <Typography level="h3" textColor="inherit">
          {t("WhistleSignWarning.Distance", { distance: Math.max(10, Math.round(distance / 10) * 10) })}
        </Typography>
      </Box>
      {/* how close the sign is: empties as the train gets there */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: "4px",
          width: `${Math.min(100, (distance / warningDistance) * 100)}%`,
          backgroundColor: "warning.solidColor",
          opacity: 0.8,
          transition: "width 1s linear",
        }}
      />
    </Alert>
  );
};

export default WhistleSignWarning;
