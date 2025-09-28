import Box from "@mui/joy/Box";
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

  let title: string | undefined;

  if (i18n.exists(`TrainTypes.Special.${type}`)) {
    title = t(`TrainTypes.Special.${type}`);
  } else {
    const [main, mod] = [type.slice(0, 2), type[2]];

    let mainKey = `Main.${main}`;
    let modKey = `Modifiers.${mod}`;
    let formatKey = "Format";

    if (!i18n.exists(`TrainTypes.${mainKey}`)) {
      mainKey = `Locomotive.${main}`;
      modKey = `LocomotiveModifires.${mod}`;
      formatKey = "LocomotiveFormat";
    }

    const mainText = i18n.exists(`TrainTypes.${mainKey}`) ? t(mainKey) : "";
    const modText = mod && i18n.exists(`TrainTypes.${modKey}`) ? t(modKey) : "";

    if (mainText) {
      const format = i18n.exists(`TrainTypes.${formatKey}`) ? t(formatKey) : "{main} {mod}";
      title = format.replace("{main}", mainText).replace("{mod}", modText).trim();
    }
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box component="span" sx={{ textWrap: "nowrap" }}>
        {type}
      </Box>
      {title && (
        <Tooltip arrow variant="outlined" placement="right" describeChild title={title}>
          <Stack alignItems="center" justifyContent="center">
            <InfoIcon />
          </Stack>
        </Tooltip>
      )}
    </Stack>
  );
};

export default memo(TrainTypeDisplay);
