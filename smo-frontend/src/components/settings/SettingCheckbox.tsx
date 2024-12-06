import Checkbox from "@mui/joy/Checkbox";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { TSettings, useSetting } from "../../utils/use-setting";
import { FilterFlags } from "../utils/general-utils";

export interface SettingCheckboxProps {
  settingKey: FilterFlags<TSettings, boolean>;
}

const SettingCheckbox: FunctionComponent<SettingCheckboxProps> = ({ settingKey: key }) => {
  const { t, i18n } = useTranslation("translation", { keyPrefix: "Settings" });
  const [value, setValue] = useSetting(key);

  const checkbox = (
    <Checkbox
      value={key}
      label={t(`${key}.Label`)}
      name={key}
      checked={value}
      onChange={(e) => setValue(e.target.checked)}
    />
  );

  if (i18n.exists(`Settings.${key}.Description`)) {
    return (
      <FormControl>
        {checkbox}
        <FormHelperText>{t(`${key}.Description`)}</FormHelperText>
      </FormControl>
    );
  }

  return checkbox;
};

export default SettingCheckbox;
