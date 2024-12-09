import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import SettingsIcon from "../icons/SettingsIcon";
import Loading from "../Loading";

const Settings = lazy(() => import("./Settings"));

const SettingsModal: FunctionComponent = () => {
  const { t } = useTranslation("translation", { keyPrefix: "Settings" });
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Tooltip title={t("Title")} placement="left" variant="outlined" arrow>
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
        <Suspense fallback={<Loading />}>{isOpen && <Settings />}</Suspense>
      </Modal>
    </>
  );
};

export default SettingsModal;
