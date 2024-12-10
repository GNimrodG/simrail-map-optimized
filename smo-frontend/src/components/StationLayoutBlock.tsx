import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import { styled } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { Train } from "../utils/data-manager";
import { getColorTrainMarker, getDistanceColorForSignal } from "../utils/ui";
import { usePrevious } from "../utils/use-previous";
import CargoIcon from "./icons/boxes-stacked.svg?react";
import InfoIcon from "./icons/InfoIcon";
import PersonIcon from "./icons/person.svg?react";
import SidingIcon from "./icons/siding.svg?react";
import SignalIcon from "./markers/icons/signal.svg?react";
import TrainMarkerPopup from "./markers/TrainMarkerPopup";
import SignalSpeedDisplay from "./utils/SignalSpeedDisplay";

export interface StationLayoutBlockProps {
  data: string[];
  defs: Record<string, string[]>;
  train: Train | null;
}

const SignalContainer = styled(IconButton)(({ theme, disabled }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1rem",
  height: "1rem",
  backgroundColor: disabled ? "transparent" : theme.palette.background.level1,
  ["&:hover,&:active,&:focus,&:focus-visible"]: {
    backgroundColor: disabled ? "transparent" : theme.palette.background.level1,
  },
  cursor: "default",
}));

const Signal = styled(SignalIcon, {
  shouldForwardProp: (p) => p !== "color",
})<{ color: "danger" | "warning" | "success" | "neutral" }>(({ theme, color }) => ({
  width: "1rem",
  height: "1rem",
  fill: theme.palette[color].solidHoverBg,
  transition: "fill 1s",
}));

// if isPrev is true, then show pulsing animation
const TrainDisplay = styled(Input, { shouldForwardProp: (p) => p !== "isPrev" })<{
  isPrev: boolean;
}>(({ isPrev, theme }) => ({
  animation: isPrev ? `${theme.palette.mode === "dark" ? "pulse-dark" : "pulse-light"} 2s infinite` : "none",
  // this is a fix for the animation getting stuck on the light theme if you toggle the theme
  ...(theme.palette.mode === "light"
    ? {
        "@keyframes pulse-light": {
          "0%": {
            backgroundColor: theme.palette.neutral.softBg,
          },
          "50%": {
            backgroundColor: theme.palette.neutral.softHoverBg,
          },
          "100%": {
            backgroundColor: theme.palette.neutral.softBg,
          },
        },
      }
    : {
        "@keyframes pulse-dark": {
          "0%": {
            backgroundColor: theme.palette.neutral.softBg,
          },
          "50%": {
            backgroundColor: theme.palette.neutral.softHoverBg,
          },
          "100%": {
            backgroundColor: theme.palette.neutral.softBg,
          },
        },
      }),
  transition: "background-color 1s",
}));

const StationLayoutBlock: FunctionComponent<StationLayoutBlockProps> = ({ data, defs, train }) => {
  const { t } = useTranslation("translation", { keyPrefix: "StationMarkerPopup.StationLayout" });
  const [_prevTrain, prevTrainTime] = usePrevious(train, true);
  const blockName = data[0];
  const colSpan = +data[1];

  if (data.length !== 2) {
    console.warn("Invalid data for StationLayoutBlock", data);
  }

  if (!defs[blockName]) {
    console.error("No definition for block", blockName);
    return null;
  }

  const signal1 = defs[blockName][0] || null;
  const signal2 = defs[blockName][1] || null;
  const platformType = defs[blockName][2] || null;
  const lengthSignal1 = +defs[blockName][3] || null;
  const lengthSignal2 = +defs[blockName][4] || null;
  const track = defs[blockName]?.[5] || null;
  const platform = defs[blockName]?.[6] || null;

  // Show previous train if it was within 30 seconds
  const prevTrain = Date.now() - prevTrainTime < 30000 ? _prevTrain : null;

  return (
    <Box component="td" colSpan={colSpan}>
      <FormControl
        sx={{
          borderRadius: "sm",
          border: "1px solid",
          borderColor: "neutral.600",
          p: 0.5,
          minWidth: "200px",
        }}>
        <FormLabel
          sx={{
            position: "relative",
            display: "inline-block",
            width: "100%",
            textAlign: "center",
          }}>
          {lengthSignal1 && (
            <Typography
              component="span"
              color="neutral"
              sx={{
                position: "absolute",
                left: 1,
                top: 0,
              }}>
              {lengthSignal1}m
            </Typography>
          )}
          {blockName}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              position: "absolute",
              right: 1,
              top: 0,
            }}>
            {track && platform && (
              <Typography component="span" color="neutral">
                {track}/{platform}
              </Typography>
            )}
            {lengthSignal2 && (
              <Typography component="span" color="neutral">
                {lengthSignal2}m
              </Typography>
            )}
            {platformType === "c" && (
              <Tooltip title={t("Cargo")} arrow>
                <div>
                  <CargoIcon />
                </div>
              </Tooltip>
            )}
            {platformType === "p" && (
              <Tooltip title={t("Passenger")} arrow>
                <div>
                  <PersonIcon />
                </div>
              </Tooltip>
            )}
            {platformType === "s" && (
              <Tooltip title={t("Siding")} arrow>
                <div>
                  <SidingIcon />
                </div>
              </Tooltip>
            )}
          </Stack>
        </FormLabel>
        <TrainDisplay
          isPrev={!train && !!prevTrain}
          startDecorator={
            <Tooltip
              variant="outlined"
              title={
                signal1 && (
                  <Stack justifyContent="center">
                    <Typography textAlign="center">{signal1}</Typography>
                    {!!train?.TrainData.SignalInFront?.startsWith(signal1) && (
                      <>
                        <SignalSpeedDisplay train={train} />
                        <Typography
                          textAlign="center"
                          color={getDistanceColorForSignal(train.TrainData.DistanceToSignalInFront)}>
                          {Math.round(train.TrainData.DistanceToSignalInFront)}m
                        </Typography>
                      </>
                    )}
                  </Stack>
                )
              }
              arrow>
              <SignalContainer disabled={!signal1}>
                {signal1 && (
                  <Signal
                    id={`sl_signal_${signal1}`}
                    color={
                      !train?.TrainData.SignalInFront?.startsWith(signal1)
                        ? "neutral"
                        : train.TrainData.SignalInFrontSpeed === 0
                          ? "danger"
                          : train.TrainData.SignalInFrontSpeed > 200
                            ? "success"
                            : "warning"
                    }
                  />
                )}
              </SignalContainer>
            </Tooltip>
          }
          endDecorator={
            <>
              {!!train && (
                <Tooltip
                  variant="outlined"
                  describeChild
                  enterDelay={500}
                  keepMounted
                  title={<TrainMarkerPopup train={train} hideButtons />}
                  arrow>
                  <Stack
                    sx={{
                      position: "absolute",
                      right: (theme) => theme.spacing(5),
                      top: 0,
                      bottom: 0,
                      color: "neutral.200",
                    }}
                    alignItems="center"
                    justifyContent="center">
                    <InfoIcon />
                  </Stack>
                </Tooltip>
              )}
              <Tooltip
                variant="outlined"
                title={
                  signal2 && (
                    <Stack justifyContent="center">
                      <Typography textAlign="center">{signal2}</Typography>
                      {!!train?.TrainData.SignalInFront?.startsWith(signal2) && (
                        <>
                          <SignalSpeedDisplay train={train} />
                          <Typography
                            textAlign="center"
                            color={getDistanceColorForSignal(train.TrainData.DistanceToSignalInFront)}>
                            {Math.round(train.TrainData.DistanceToSignalInFront)}m
                          </Typography>
                        </>
                      )}
                    </Stack>
                  )
                }
                arrow>
                <SignalContainer disabled={!signal2}>
                  {signal2 && (
                    <Signal
                      id={`sl_signal_${signal2}`}
                      color={
                        !train?.TrainData.SignalInFront?.startsWith(signal2)
                          ? "neutral"
                          : train.TrainData.SignalInFrontSpeed === 0
                            ? "danger"
                            : train.TrainData.SignalInFrontSpeed > 200
                              ? "success"
                              : "warning"
                      }
                    />
                  )}
                </SignalContainer>
              </Tooltip>
            </>
          }
          readOnly
          size="sm"
          placeholder="-"
          sx={{
            ["& .MuiInput-input"]: {
              textAlign: "center",
            },
          }}
          variant={train ? "solid" : prevTrain ? "soft" : "outlined"}
          color={train ? getColorTrainMarker(train.TrainData.Velocity) : "neutral"}
          value={
            train?.TrainNoLocal ||
            (prevTrain
              ? `${prevTrain.TrainData.SignalInFront?.split("@")[0] === signal1 ? "<" : ""}(${
                  prevTrain.TrainNoLocal
                })${prevTrain.TrainData.SignalInFront?.split("@")[0] === signal2 ? ">" : ""}`
              : "")
          }
        />
      </FormControl>
    </Box>
  );
};

export default StationLayoutBlock;
