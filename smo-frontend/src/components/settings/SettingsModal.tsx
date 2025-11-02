import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { useNewSettingsNotification } from "../../hooks/useNewSettingsNotification";
import ErrorBoundary from "../ErrorBoundary";
import SettingsIcon from "../icons/SettingsIcon";
import Loading from "../Loading";

const Settings = lazy(() => import("./Settings"));

const SettingsModal: FunctionComponent = () => {
  const { t } = useTranslation("translation", { keyPrefix: "Settings" });
  const [isOpen, setIsOpen] = useState(false);
  const { hasNewSettings, markAsSeen } = useNewSettingsNotification();

  const handleOpen = () => {
    setIsOpen(true);
    if (hasNewSettings) {
      markAsSeen();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <Tooltip title={t("Title")} placement="left" variant="outlined" arrow>
        <IconButton
          variant="outlined"
          sx={{
            backgroundColor: "var(--joy-palette-background-surface)",
            position: "relative",
          }}
          color="neutral"
          onClick={handleOpen}>
          <SettingsIcon />
          {hasNewSettings && (
            <Box
              sx={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "var(--joy-palette-primary-500)",
                border: "2px solid var(--joy-palette-background-surface)",
              }}
            />
          )}
        </IconButton>
      </Tooltip>

      <Modal
        open={isOpen}
        onClose={handleClose}
        aria-labelledby="modal-title"
        sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Suspense fallback={<Loading />}>
          <ErrorBoundary location="Settings">{isOpen && <Settings />}</ErrorBoundary>
        </Suspense>
      </Modal>
    </>
  );
};

export default SettingsModal;
