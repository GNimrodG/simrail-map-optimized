import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState } from "react";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "../../i18n";
import SettingsIcon from "../icons/SettingsIcon";
import SettingCheckbox from "./SettingCheckbox";

const Settings: FunctionComponent = () => {
  const { t, i18n } = useTranslation("translation", { keyPrefix: "Settings" });
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Tooltip
        title={t("Title")}
        placement="left"
        variant="outlined"
        arrow>
        <IconButton
          variant="outlined"
          sx={{ backgroundColor: "var(--joy-palette-background-surface)" }}
          color="neutral"
          onClick={() => setIsOpen((isOpen) => !isOpen)}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen((isOpen) => !isOpen)}
        aria-labelledby="modal-title"
        sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Sheet
          variant="outlined"
          sx={{
            maxWidth: 500,
            borderRadius: "md",
            p: 3,
            boxShadow: "lg",
          }}>
          <ModalClose
            variant="plain"
            sx={{ m: 1 }}
          />
          <Typography
            component="h2"
            id="modal-title"
            level="h3"
            textColor="inherit"
            fontWeight="lg"
            mb={1}>
            {t("Title")}
          </Typography>

          <Stack
            direction="column"
            spacing={0.5}>
            <Typography
              sx={{ pt: 2 }}
              level="h4">
              {t("Language")}
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <Select
                value={i18n.language}
                onChange={(_e, v) => v && i18n.changeLanguage(v)}
                size="sm">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <Option
                    key={lang}
                    value={lang}>
                    {t("LanguageName", { lng: lang })}
                  </Option>
                ))}
              </Select>
            </Stack>
          </Stack>

          <Stack
            direction="column"
            spacing={0.5}>
            <Typography
              sx={{ pt: 2 }}
              level="h4">
              {t("General")}
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <SettingCheckbox settingKey="useAltTracking" />
            </Stack>
          </Stack>

          <Stack
            direction="column"
            spacing={0.5}>
            <Typography
              sx={{ pt: 2 }}
              level="h4">
              {t("TrainWindow")}
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <SettingCheckbox settingKey="expandScheduleDefault" />
              <SettingCheckbox settingKey="hideTrainPictures" />
              <SettingCheckbox settingKey="showLineToNextSignal" />

              <Typography
                sx={{ pt: 1 }}
                level="body-lg">
                {t("CollapsedTrainWindow")}
              </Typography>
              <Stack
                direction="column"
                spacing={1}>
                <SettingCheckbox settingKey="showSpeedInfoCollapsed" />
                <SettingCheckbox settingKey="showSignalInfoCollapsed" />
                <SettingCheckbox settingKey="showNextStationInfoCollapsed" />
              </Stack>
            </Stack>
          </Stack>

          <Stack
            direction="column"
            spacing={0.5}>
            <Typography
              sx={{ pt: 2 }}
              level="h4">
              {t("MapTheme")}
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <SettingCheckbox settingKey="alternativeTheme" />
            </Stack>
          </Stack>
        </Sheet>
      </Modal>
    </>
  );
};

export default Settings;
