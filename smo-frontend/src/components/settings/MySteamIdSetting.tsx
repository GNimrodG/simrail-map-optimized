import Avatar from "@mui/joy/Avatar";
import FormHelperText from "@mui/joy/FormHelperText";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { useProfileData } from "../../hooks/useProfileData";
import { useSetting } from "../../hooks/useSetting";
import { isSteamId } from "../../utils/steam-id";
import XMarkIcon from "../icons/xmark-solid.svg?react";
import SettingCheckbox from "./SettingCheckbox";
import SteamIdForm from "./SteamIdForm";

/**
 * The user's own Steam ID (from a profile link or the raw ID): their train or station is followed automatically.
 */
const MySteamIdSetting: FunctionComponent = () => {
  const { t } = useTranslation("translation", { keyPrefix: "Settings.mySteamId" });
  const [mySteamId, setMySteamId] = useSetting("mySteamId");
  const savedId = isSteamId(mySteamId) ? mySteamId : null;
  const { userData } = useProfileData(savedId);

  return (
    <Stack spacing={1}>
      <Typography level="body-lg">{t("Label")}</Typography>
      {savedId ? (
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar size="sm" src={userData?.Avatar || undefined} alt="" />
            <Typography level="body-md" sx={{ flexGrow: 1, overflowWrap: "anywhere" }}>
              {userData?.PersonaName || savedId}
            </Typography>
            <IconButton size="sm" variant="soft" color="danger" title={t("Clear")} onClick={() => setMySteamId("")}>
              <XMarkIcon />
            </IconButton>
          </Stack>
          <FormHelperText>{t("Description")}</FormHelperText>
        </Stack>
      ) : (
        <SteamIdForm helperText={t("Description")} />
      )}
      {savedId && <SettingCheckbox settingKey="autoFollowMe" />}
    </Stack>
  );
};

export default MySteamIdSetting;
