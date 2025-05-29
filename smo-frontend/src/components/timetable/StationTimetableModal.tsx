import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { SimplifiedTimtableEntry } from "../../utils/types";
import MapTimeDisplay from "../MapTimeDisplay";
import StationTimetableDisplay from "./StationTimetableDisplay";

export interface StationTimetableModalProps {
  open: boolean;
  onClose: () => void;
  stationName: string;
  stationTimetable?: SimplifiedTimtableEntry[] | null;
}

const StationTimetableModal: FunctionComponent<StationTimetableModalProps> = ({
  open,
  onClose,
  stationName,
  stationTimetable,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "StationMarkerPopup" });

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ width: "min(1280px, 95vw)" }}>
        <ModalClose
          variant="plain"
          sx={{
            position: "absolute",
            top: (theme) => theme.spacing(1),
            right: (theme) => theme.spacing(1),
          }}
        />

        <DialogTitle
          sx={(theme) => ({
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            alignItems: "center",
            [theme.breakpoints.down("md")]: {
              gridTemplateColumns: "1fr 1fr",
              mr: 4,
            },
          })}
          component="div">
          {t("Timetable.Title", { stationName })} <MapTimeDisplay />
        </DialogTitle>

        {open && stationTimetable && <StationTimetableDisplay timetable={stationTimetable} />}
      </ModalDialog>
    </Modal>
  );
};

export default StationTimetableModal;
