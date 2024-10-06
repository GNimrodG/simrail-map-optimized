import Checkbox from "@mui/joy/Checkbox";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { TSettings, useSetting } from "../../utils/use-setting";

// Utility type to filter keys by value type
type FilterFlags<Base, Condition> = {
  [K in keyof Base]: Base[K] extends Condition ? K : never;
}[keyof Base];

export interface SettingCheckboxProps {
  settingKey: FilterFlags<TSettings, boolean>;
}

const SettingCheckbox: FunctionComponent<SettingCheckboxProps> = ({ settingKey: key }) => {
  const { t, i18n } = useTranslation("translation", { keyPrefix: "Settings" });
  const [value, setValue] = useSetting(key);

  if (i18n.exists(`Settings.${key}.Description`)) {
    return (
      <FormControl>
        <Checkbox
          value={key}
          label={t(`${key}.Label`)}
          name={key}
          checked={value}
          onChange={(e) => setValue(e.target.checked)}
        />
        <FormHelperText>{t(`${key}.Description`)}</FormHelperText>
      </FormControl>
    );
  }

  return (
    <Checkbox
      value={key}
      label={t(`${key}.Label`)}
      name={key}
      checked={value}
      onChange={(e) => setValue(e.target.checked)}
    />
  );
};

export default SettingCheckbox;
