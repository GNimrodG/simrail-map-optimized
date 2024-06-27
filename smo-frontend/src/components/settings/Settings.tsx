import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState } from "react";

import SettingsIcon from "../icons/SettingsIcon";
import SettingCheckbox from "./SettingCheckbox";

const Settings: FunctionComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Tooltip
        title="Settings"
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
            Settings
          </Typography>

          <Stack
            direction="column"
            spacing={0.5}>
            <Typography
              sx={{ pt: 2 }}
              level="h4">
              General
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <SettingCheckbox
                settingKey="useAltTracking"
                label="Use alternative following method"
                description="Use alternative method to follow trains on the map. This method is less smooth but uses less CPU."
              />
            </Stack>
          </Stack>

          <Stack
            direction="column"
            spacing={0.5}>
            <Typography
              sx={{ pt: 2 }}
              level="h4">
              Train Window
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <SettingCheckbox
                settingKey="expandScheduleDefault"
                label="Expand schedule by default"
              />
              <SettingCheckbox
                settingKey="hideTrainPictures"
                label="Hide train pictures"
              />
              <SettingCheckbox
                settingKey="showLineToNextSignal"
                label="Show line to next signal"
              />

              <Typography
                sx={{ pt: 1 }}
                level="body-lg">
                Collapsed Train Window
              </Typography>
              <Stack
                direction="column"
                spacing={1}>
                <SettingCheckbox
                  settingKey="showSpeedInfoCollapsed"
                  label="Show speed"
                />
                <SettingCheckbox
                  settingKey="showSignalInfoCollapsed"
                  label="Show signal info"
                />
                <SettingCheckbox
                  settingKey="showNextStationInfoCollapsed"
                  label="Show next station info"
                />
              </Stack>
            </Stack>
          </Stack>

          <Stack
            direction="column"
            spacing={0.5}>
            <Typography
              sx={{ pt: 2 }}
              level="h4">
              Map Theme(For Dark Mode)
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <SettingCheckbox
                settingKey="alternativeTheme"
                label="Monochrome map"
              />
            </Stack>
          </Stack>
        </Sheet>
      </Modal>
    </>
  );
};

export default Settings;
