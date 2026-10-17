import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Typography from "@mui/joy/Typography";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, memo } from "react";
import { UnusualCargoFlags } from "../../utils/types";
import { useTranslation } from "react-i18next";

export interface UnusualCargoDisplayProps {
  cargo: UnusualCargoFlags | undefined;
  displayMode?: "text" | "chip";
}

const FLAG_COLORS = {
  purple: "#9333EA",
  yellow: "#CA8A04",
  orange: "#EA580C",
  darkRed: "#991B1B",
};

type FlagColor = keyof typeof FLAG_COLORS;

const DEBUG_SHOW_ALL_FLAGS = false;

const FLAGS: { flag: keyof UnusualCargoFlags; translationKey: string; color: FlagColor }[] = [
  { flag: "IsQualityTracked", translationKey: "QualityTracked", color: "purple" },
  { flag: "IsOverGauge", translationKey: "OverGauge", color: "yellow" },
  { flag: "IsOverWeight", translationKey: "OverWeight", color: "yellow" },
  { flag: "IsOtherExceptional", translationKey: "OtherExceptional", color: "yellow" },
  { flag: "IsHighRiskCargo", translationKey: "HighRiskCargo", color: "orange" },
  { flag: "IsDangerousCargo", translationKey: "DangerousCargo", color: "darkRed" },
];

const flagSx = (color: FlagColor) => ({
  color: `color-mix(in srgb, ${FLAG_COLORS[color]} 70%, var(--joy-palette-text-primary))`,
  backgroundColor: `color-mix(in srgb, ${FLAG_COLORS[color]} 15%, transparent)`,
  borderColor: FLAG_COLORS[color],
});

const TrainFlag: FunctionComponent<{
  flag: string;
  color: FlagColor;
  displayMode: "text" | "chip";
}> = ({ flag, color, displayMode }) => {
  const { t } = useTranslation("translation", { keyPrefix: "UnusualCargo" });

  const label = t(`${flag}.label`);
  const description = t(`${flag}.description`);

  return (
    <Tooltip arrow variant="outlined" placement="top" describeChild title={description}>
      {displayMode === "chip" ? (
        <Chip size="sm" variant="outlined" sx={flagSx(color)}>
          {label}
        </Chip>
      ) : (
        <Typography
          component="span"
          variant="outlined"
          level="body-sm"
          textAlign="center"
          sx={[flagSx(color), { whiteSpace: "nowrap" }]}>
          {label}
        </Typography>
      )}
    </Tooltip>
  );
};

const UnusualCargoDisplay: FunctionComponent<UnusualCargoDisplayProps> = ({ cargo, displayMode = "text" }) => {
  const flags = DEBUG_SHOW_ALL_FLAGS ? FLAGS : FLAGS.filter(({ flag }) => cargo?.[flag]);
  if (flags.length === 0) return null;

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
      }}>
      {flags.map(({ flag, translationKey, color }) => (
        <TrainFlag key={flag} flag={translationKey} color={color} displayMode={displayMode} />
      ))}
    </Box>
  );
};

export default memo(UnusualCargoDisplay);
