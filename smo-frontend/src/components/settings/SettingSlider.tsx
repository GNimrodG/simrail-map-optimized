import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Slider from "@mui/joy/Slider";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { TSettings, useSetting } from "../../utils/use-setting";
import { FilterFlags } from "../utils/general-utils";

export interface SettingSliderProps {
  settingKey: FilterFlags<TSettings, number | number[]>;
  min: number;
  max: number;
  step: number;
  minDistance?: number;
}

const SettingSlider: FunctionComponent<SettingSliderProps> = ({ settingKey: key, min, max, step, minDistance }) => {
  const { t, i18n } = useTranslation("translation", { keyPrefix: "Settings" });

  const [value, setValue] = useSetting(key);

  return (
    <FormControl>
      <FormLabel>
        <Typography level="body-lg">{t(`${key}.Label`)}</Typography>
      </FormLabel>
      <Slider
        name={key}
        min={min}
        max={max}
        step={step}
        valueLabelDisplay="auto"
        value={value}
        onChange={(_e, v) => {
          if (minDistance && Array.isArray(v)) {
            if (v[1] - v[0] < minDistance) {
              if (v[0] + minDistance > max) {
                setValue([max - minDistance, max]);
              } else {
                setValue([v[0], v[0] + minDistance]);
              }

              return;
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setValue(v as unknown as any);
        }}
      />
      {i18n.exists(`Settings.${key}.Description`) && <FormHelperText>{t(`${key}.Description`)}</FormHelperText>}
    </FormControl>
  );
};

export default SettingSlider;
