import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import Input from "@mui/joy/Input";
import { type FunctionComponent, type SubmitEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "../../hooks/useSetting";
import { dataProvider } from "../../utils/data-manager";
import { parseSteamIdInput } from "../../utils/steam-id";

type InputError = "Invalid" | "NotFound" | null;

export interface SteamIdFormProps {
  /** Shown under the field while there's no error */
  helperText?: string;
  onSaved?: () => void;
}

/**
 * Sets the mySteamId setting from a Steam profile link (steamcommunity.com/profiles/… or /id/…) or a raw Steam ID.
 */
const SteamIdForm: FunctionComponent<SteamIdFormProps> = ({ helperText, onSaved }) => {
  const { t } = useTranslation("translation", { keyPrefix: "Settings.mySteamId" });
  const [, setMySteamId] = useSetting("mySteamId");

  const [text, setText] = useState("");
  const [error, setError] = useState<InputError>(null);
  const [resolving, setResolving] = useState(false);

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = parseSteamIdInput(text);
    if (!parsed) {
      setError("Invalid");
      return;
    }

    let steamId: string | null;
    if ("steamId" in parsed) {
      steamId = parsed.steamId;
    } else {
      setResolving(true);
      steamId = await dataProvider.resolveSteamVanityUrl(parsed.vanityName);
      setResolving(false);
    }

    if (!steamId) {
      setError("NotFound");
      return;
    }

    setMySteamId(steamId);
    setText("");
    onSaved?.();
  };

  const helper = error ? t(`Errors.${error}`) : helperText;

  return (
    <FormControl error={!!error}>
      <form onSubmit={save}>
        <Input
          size="sm"
          name="mySteamId"
          placeholder={t("Placeholder")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          endDecorator={
            <Button size="sm" type="submit" loading={resolving} disabled={!text.trim()}>
              {t("Save")}
            </Button>
          }
        />
      </form>
      {helper && <FormHelperText>{helper}</FormHelperText>}
    </FormControl>
  );
};

export default SteamIdForm;
