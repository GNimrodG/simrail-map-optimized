import Box from "@mui/joy/Box";
import ModalClose from "@mui/joy/ModalClose";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "../../i18n";
import LayerOpacitySlider from "./LayerOpacitySlider";
import SettingCheckbox from "./SettingCheckbox";

const Settings: FunctionComponent = () => {
  const { t, i18n } = useTranslation("translation", { keyPrefix: "Settings" });

  return (
    <Sheet
      variant="outlined"
      sx={{
        maxWidth: 500,
        maxHeight: "90vh",
        overflowY: "auto",
        borderRadius: "md",
        p: 3,
        boxShadow: "lg",
        position: "relative",
      }}>
      <Box
        sx={(theme) => ({
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: theme.palette.background.surface,
          boxShadow: `0px 0px 16px 16px ${theme.palette.background.surface}`,
        })}>
        <Typography component="h2" id="modal-title" level="h3" textColor="inherit" fontWeight="lg" mb={1}>
          {t("Title")}
        </Typography>
        <ModalClose
          variant="plain"
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
      </Box>

      <Stack direction="column" spacing={0.5}>
        <Typography sx={{ pt: 2 }} level="h4">
          {t("Language")}
        </Typography>
        <Stack direction="column" spacing={1}>
          <Select value={i18n.language} onChange={(_e, v) => v && i18n.changeLanguage(v)} size="sm">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Option key={lang} value={lang}>
                {t("LanguageName", { lng: lang })}
              </Option>
            ))}
          </Select>
        </Stack>
      </Stack>

      <Stack direction="column" spacing={0.5}>
        <Typography sx={{ pt: 2 }} level="h4">
          {t("General")}
        </Typography>
        <Stack direction="column" spacing={1}>
          <SettingCheckbox settingKey="useAltTracking" />
          <SettingCheckbox settingKey="disableSlidingMarkers" />
        </Stack>
      </Stack>

      <Stack direction="column" spacing={0.5}>
        <Typography sx={{ pt: 2 }} level="h4">
          {t("LayerOpacity")}
        </Typography>
        <Stack direction="column" spacing={1}>
          <LayerOpacitySlider layerId="orm-infra" layerType="Background" />
          <LayerOpacitySlider layerId="orm-maxspeed" layerType="Background" />
          <LayerOpacitySlider layerId="orm-signals" layerType="Background" />
          <LayerOpacitySlider layerId="orm-electrification" layerType="Background" />
          <LayerOpacitySlider layerId="stations" layerType="Overlay" />
          <LayerOpacitySlider layerId="trains" layerType="Overlay" />
          <LayerOpacitySlider layerId="active-signals" layerType="Overlay" />
          <LayerOpacitySlider layerId="passive-signals" layerType="Overlay" />
          <LayerOpacitySlider layerId="selected-route" layerType="Overlay" />
          <LayerOpacitySlider layerId="unplayable-stations" layerType="Overlay" />
        </Stack>
      </Stack>

      <Stack direction="column" spacing={0.5}>
        <Typography sx={{ pt: 2 }} level="h4">
          {t("TrainWindow")}
        </Typography>
        <Stack direction="column" spacing={1}>
          <SettingCheckbox settingKey="expandScheduleDefault" />
          <SettingCheckbox settingKey="hideTrainPictures" />
          <SettingCheckbox settingKey="showLineToNextSignal" />

          <Typography sx={{ pt: 1 }} level="body-lg">
            {t("CollapsedTrainWindow")}
          </Typography>
          <Stack direction="column" spacing={1}>
            <SettingCheckbox settingKey="showSpeedInfoCollapsed" />
            <SettingCheckbox settingKey="showSignalInfoCollapsed" />
            <SettingCheckbox settingKey="showNextStationInfoCollapsed" />
          </Stack>
        </Stack>
      </Stack>

      <Stack direction="column" spacing={0.5}>
        <Typography sx={{ pt: 2 }} level="h4">
          {t("MapTheme")}
        </Typography>
        <Stack direction="column" spacing={1}>
          <SettingCheckbox settingKey="alternativeTheme" />
        </Stack>
      </Stack>
    </Sheet>
  );
};

export default Settings;
