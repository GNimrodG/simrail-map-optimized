import { useLocalStorage } from "@mantine/hooks";
import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useState } from "react";

import SettingsIcon from "./icons/SettingsIcon";

const Settings: FunctionComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  const [expandScheduleDefault, setExpandScheduleDefault] = useLocalStorage({
    key: "expandScheduleDefault",
    defaultValue: false,
  });

  const [hideTrainPictures, setHideTrainPictures] = useLocalStorage({
    key: "hideTrainPictures",
    defaultValue: false,
  });

  const [showSignalInfoCollapsed, setShowSignalInfoCollapsed] = useLocalStorage({
    key: "showSignalInfoCollapsed",
    defaultValue: true,
  });

  const [showSpeedInfoCollapsed, setShowSpeedInfoCollapsed] = useLocalStorage({
    key: "showSpeedInfoCollapsed",
    defaultValue: true,
  });

  const [showNextStationInfoCollapsed, setShowNextStationInfoCollapsed] = useLocalStorage({
    key: "showNextStationInfoCollapsed",
    defaultValue: false,
  });

  const [showLineToNextSignal, setShowLineToNextSignal] = useLocalStorage({
    key: "showLineToNextSignal",
    defaultValue: false,
  });

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
              Train Window
            </Typography>
            <Stack
              direction="column"
              spacing={1}>
              <Checkbox
                key="expandScheduleDefault"
                value="expandScheduleDefault"
                label="Expand schedule by default"
                name="expandScheduleDefault"
                checked={expandScheduleDefault}
                onChange={(e) => setExpandScheduleDefault(e.target.checked)}
              />
              <Checkbox
                key="hideTrainPictures"
                value="hideTrainPictures"
                label="Hide train pictures"
                name="hideTrainPictures"
                checked={hideTrainPictures}
                onChange={(e) => setHideTrainPictures(e.target.checked)}
              />
              <Checkbox
                key="showLineToNextSignal"
                value="showLineToNextSignal"
                label="Show line to next signal"
                name="showLineToNextSignal"
                checked={showLineToNextSignal}
                onChange={(e) => setShowLineToNextSignal(e.target.checked)}
              />

              <Typography
                sx={{ pt: 1 }}
                level="body-lg">
                Collapsed Train Window
              </Typography>
              <Stack
                direction="column"
                spacing={1}>
                <Checkbox
                  key="showSpeedInfoCollapsed"
                  value="showSpeedInfoCollapsed"
                  label="Show speed"
                  name="showSpeedInfoCollapsed"
                  checked={showSpeedInfoCollapsed}
                  onChange={(e) => setShowSpeedInfoCollapsed(e.target.checked)}
                />
                <Checkbox
                  key="showSignalInfoCollapsed"
                  value="showSignalInfoCollapsed"
                  label="Show signal info"
                  name="showSignalInfoCollapsed"
                  checked={showSignalInfoCollapsed}
                  onChange={(e) => setShowSignalInfoCollapsed(e.target.checked)}
                />
                <Checkbox
                  key="showNextStationInfoCollapsed"
                  value="showNextStationInfoCollapsed"
                  label="Show next station info"
                  name="showNextStationInfoCollapsed"
                  checked={showNextStationInfoCollapsed}
                  onChange={(e) => setShowNextStationInfoCollapsed(e.target.checked)}
                />
              </Stack>
            </Stack>
          </Stack>
        </Sheet>
      </Modal>
    </>
  );
};

export default Settings;
