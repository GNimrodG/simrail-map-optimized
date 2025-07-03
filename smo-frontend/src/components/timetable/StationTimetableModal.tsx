import { useDebouncedState } from "@mantine/hooks";
import DialogTitle from "@mui/joy/DialogTitle";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog, { modalDialogClasses } from "@mui/joy/ModalDialog";
import { type FunctionComponent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SimplifiedTimtableEntry } from "../../utils/types";
import CollapseIcon from "../icons/CollapseIcon";
import ExpandIcon from "../icons/ExpandIcon";
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [search, setSearch] = useDebouncedState("", 300);

  const filteredTimetable = useMemo(() => {
    if (!stationTimetable || !search) return stationTimetable;

    const searchLower = search.toLowerCase();
    return stationTimetable.filter(
      (entry) =>
        entry.trainNoLocal.toLowerCase().includes(searchLower) || entry.note?.toLowerCase().includes(searchLower),
    );
  }, [stationTimetable, search]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideBackdrop={isCollapsed}
      sx={{
        pointerEvents: isCollapsed ? "none" : null,
        [`& .${modalDialogClasses.root}`]: {
          pointerEvents: isCollapsed ? "all" : null,
          top: isCollapsed ? "unset" : "50%",
          bottom: isCollapsed ? (theme) => theme.spacing(4) : "auto",
          transform: isCollapsed ? "translateX(-50%)" : null,
        },
      }}>
      <ModalDialog sx={{ width: "min(1280px, 95vw)", height: isCollapsed ? "max(20vh, 350px)" : "100%" }}>
        <ModalClose
          variant="plain"
          sx={{
            position: "absolute",
            top: (theme) => theme.spacing(1),
            right: (theme) => theme.spacing(1),
          }}
        />

        <IconButton
          size="sm"
          onClick={() => setIsCollapsed((prev) => !prev)}
          sx={{
            position: "absolute",
            top: (theme) => theme.spacing(3),
            left: (theme) => theme.spacing(2),
          }}>
          {isCollapsed ? <ExpandIcon /> : <CollapseIcon />}
        </IconButton>

        <DialogTitle
          sx={(theme) => ({
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            alignItems: "center",
            [theme.breakpoints.down("md")]: {
              gridTemplateColumns: "1fr 1fr",
              mr: 4,
            },
            ml: 4,
          })}
          component="div">
          {t("Timetable.Title", { stationName })} <MapTimeDisplay />
          <Input
            variant="soft"
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Timetable.SearchPlaceholder")}
            sx={(theme) => ({
              ml: 4,
              mr: 4,
              [theme.breakpoints.down("md")]: {
                gridRow: 2,
                gridColumn: "1 / -1",
              },
            })}
            slotProps={{
              input: {
                "aria-label": t("Timetable.SearchPlaceholder"),
              },
            }}
          />
        </DialogTitle>

        {open && filteredTimetable && <StationTimetableDisplay timetable={filteredTimetable} onClose={onClose} />}
      </ModalDialog>
    </Modal>
  );
};

export default StationTimetableModal;
