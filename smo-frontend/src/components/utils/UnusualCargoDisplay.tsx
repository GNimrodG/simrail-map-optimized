import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import { ColorPaletteProp } from "@mui/joy/styles";
import Typography from "@mui/joy/Typography";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, memo } from "react";
import { UnusualCargoFlags } from "../../utils/types";
import { useTranslation } from "react-i18next";

export interface UnusualCargoDisplayProps {
  cargo: UnusualCargoFlags | undefined;
  displayMode?: "text" | "chip";
  /** With more flags than this, the optional ones are collapsed into a "+N" label */
  maxChips?: number;
}

const DEBUG_SHOW_ALL_FLAGS = false;

interface Flag {
  flag: keyof UnusualCargoFlags;
  translationKey: string;
  color: ColorPaletteProp;
  solid?: boolean;
  optional?: boolean;
}

const FLAGS: Flag[] = [
  { flag: "IsQualityTracked", translationKey: "QualityTracked", color: "neutral", optional: true },
  { flag: "IsOverGauge", translationKey: "OverGauge", color: "warning" },
  { flag: "IsOverWeight", translationKey: "OverWeight", color: "warning" },
  { flag: "IsOtherExceptional", translationKey: "OtherExceptional", color: "warning", optional: true },
  { flag: "IsHighRiskCargo", translationKey: "HighRiskCargo", color: "danger", solid: true },
  { flag: "IsDangerousCargo", translationKey: "DangerousCargo", color: "danger" },
];

const TrainFlag: FunctionComponent<Omit<Flag, "flag"> & { displayMode: "text" | "chip" }> = ({
  translationKey,
  color,
  solid,
  displayMode,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "UnusualCargo" });

  const label = t(`${translationKey}.label`);
  const description = t(`${translationKey}.description`);

  return (
    <Tooltip arrow variant="outlined" placement="top" describeChild title={description}>
      {displayMode === "chip" ? (
        <Chip size="sm" variant={solid ? "solid" : "soft"} color={color}>
          {label}
        </Chip>
      ) : (
        <Typography
          component="span"
          variant={solid ? "solid" : "outlined"}
          color={color}
          level="body-sm"
          textAlign="center"
          sx={{ whiteSpace: "nowrap" }}>
          {label}
        </Typography>
      )}
    </Tooltip>
  );
};

const UnusualCargoDisplay: FunctionComponent<UnusualCargoDisplayProps> = ({
  cargo,
  displayMode = "text",
  maxChips = FLAGS.length,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "UnusualCargo" });

  const flags = DEBUG_SHOW_ALL_FLAGS ? FLAGS : FLAGS.filter(({ flag }) => cargo?.[flag]);
  if (flags.length === 0) return null;

  const collapse = flags.length > maxChips;
  const visible = collapse ? flags.filter(({ optional }) => !optional) : flags;
  const hidden = collapse ? flags.filter(({ optional }) => optional) : [];

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
      }}>
      {visible.map(({ flag, ...rest }) => (
        <TrainFlag key={flag} {...rest} displayMode={displayMode} />
      ))}
      {hidden.length > 0 && (
        <Tooltip
          arrow
          variant="outlined"
          placement="top"
          describeChild
          title={hidden.map(({ translationKey }) => t(`${translationKey}.description`)).join(", ")}>
          {displayMode === "chip" ? (
            <Chip size="sm" variant="soft" color="neutral">
              +{hidden.length}
            </Chip>
          ) : (
            <Typography component="span" variant="outlined" color="neutral" level="body-sm">
              +{hidden.length}
            </Typography>
          )}
        </Tooltip>
      )}
    </Box>
  );
};

export default memo(UnusualCargoDisplay);
