import { useDebouncedValue } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import DialogTitle from "@mui/joy/DialogTitle";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog, { modalDialogClasses } from "@mui/joy/ModalDialog";
import { type FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SimplifiedTimtableEntry } from "../../utils/types";
import CollapseIcon from "../icons/CollapseIcon";
import ExpandIcon from "../icons/ExpandIcon";
import CloseIcon from "../icons/xmark-solid.svg?react";
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
  const [collapsedHeight, setCollapsedHeight] = useState(350);
  const isDraggingRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");

  const [debouncedSearch] = useDebouncedValue(search, 100);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingRef.current && modalRef.current) {
      e.preventDefault();
      const rect = modalRef.current.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      setCollapsedHeight(Math.max(200, Math.min(newHeight, window.innerHeight * 0.8)));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const filteredTimetable = useMemo(() => {
    if (!stationTimetable || !debouncedSearch) return stationTimetable;

    const searchLower = debouncedSearch.toLowerCase();
    return stationTimetable.filter(
      (entry) =>
        entry.trainNoLocal.toLowerCase().includes(searchLower) || entry.note?.toLowerCase().includes(searchLower),
    );
  }, [stationTimetable, debouncedSearch]);

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
      <ModalDialog
        ref={modalRef}
        sx={{
          width: { xs: "95vw", sm: "90vw" },
          height: isCollapsed ? `${collapsedHeight}px` : "100%",
          overflow: "auto",
        }}>
        {isCollapsed && (
          <Box
            role="button"
            tabIndex={0}
            onMouseDown={handleMouseDown}
            aria-label="Resize handle"
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "12px",
              cursor: "ns-resize",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderTopLeftRadius: "inherit",
              borderTopRightRadius: "inherit",
            }}>
            <Box
              sx={{
                width: "40px",
                height: "4px",
                borderRadius: "2px",
                backgroundColor: "var(--joy-palette-neutral-500)",
              }}
            />
          </Box>
        )}

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
            value={search}
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
            endDecorator={
              <IconButton variant="plain" size="sm" color="neutral" onClick={() => setSearch("")} disabled={!search}>
                <CloseIcon />
              </IconButton>
            }
          />
        </DialogTitle>

        {open && filteredTimetable && (
          <StationTimetableDisplay timetable={filteredTimetable} onClose={onClose} isCollapsed={isCollapsed} />
        )}
      </ModalDialog>
    </Modal>
  );
};

export default StationTimetableModal;
