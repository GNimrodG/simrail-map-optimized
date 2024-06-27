import Checkbox from "@mui/joy/Checkbox";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import { type FunctionComponent } from "react";

import { TSettings, useSetting } from "../../utils/use-setting";

// Utility type to filter keys by value type
type FilterFlags<Base, Condition> = {
  [K in keyof Base]: Base[K] extends Condition ? K : never;
}[keyof Base];

export interface SettingCheckboxProps {
  settingKey: FilterFlags<TSettings, boolean>;
  label: string;
  description?: string;
}

const SettingCheckbox: FunctionComponent<SettingCheckboxProps> = ({
  settingKey: key,
  label,
  description,
}) => {
  const [value, setValue] = useSetting(key);

  if (description) {
    return (
      <FormControl>
        <Checkbox
          value={key}
          label={label}
          name={key}
          checked={value}
          onChange={(e) => setValue(e.target.checked)}
        />
        <FormHelperText>{description}</FormHelperText>
      </FormControl>
    );
  }

  return (
    <Checkbox
      value={key}
      label={label}
      name={key}
      checked={value}
      onChange={(e) => setValue(e.target.checked)}
    />
  );
};

export default SettingCheckbox;
