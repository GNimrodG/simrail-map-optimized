import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { findSideView, loadSideViews, type SideView } from "../../../utils/side-views";
import ChevronIcon from "../../icons/ChevronIcon";
import { formatVehicleName } from "../../utils/general-utils";

export interface TrainSideViewProps {
  consist: string[];
}

const PLACEHOLDER_LENGTH = 16; // m, a vehicle without a picture
const PICTURE_HEIGHT = 6.15; // m, every picture's height (render_prefabs.py SIDE_TOP - SIDE_BOTTOM: a raised pantograph)
const RAIL_HEIGHT = 0.15; // m, the rails above the pictures' bottom edge
const HEIGHT = 32; // px, the strip's height: every train at the same scale, a longer one scrolls
const SCALE = HEIGHT / PICTURE_HEIGHT; // px per metre

function cargoName(vehicle: string) {
  const cargo = /@(.+)$/.exec(vehicle)?.[1];
  return cargo ? ` - ${cargo.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2")}` : "";
}

/** The train from the side, vagonWEB style: every vehicle (every car of a unit) drawn to length, front on the left. */
const TrainSideView: FunctionComponent<TrainSideViewProps> = ({ consist }) => {
  const [manifest, setManifest] = useState<Awaited<ReturnType<typeof loadSideViews>> | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadSideViews().then((m) => active && setManifest(m));
    return () => {
      active = false;
    };
  }, []);

  // the mouse wheel scrolls a long train sideways (the strip has no vertical scrolling)
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (element.scrollWidth <= element.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // no scrollbar: buttons on the sides with more of the train (the browser's middle-click scrolling stays)
  const [more, setMore] = useState({ left: false, right: false });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () =>
      setMore({
        left: element.scrollLeft > 1,
        right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [manifest]);

  const scrollBy = (direction: -1 | 1) =>
    scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  // dragging with the left button scrolls too
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType !== "mouse" || !scroller.current) return;
    drag.current = { x: event.clientX, scrollLeft: scroller.current.scrollLeft, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || !scroller.current) return;
    const dx = event.clientX - start.x;
    if (!start.moved && Math.abs(dx) < 3) return;
    scroller.current.scrollLeft = start.scrollLeft - dx;
    if (!start.moved) {
      try {
        scroller.current.setPointerCapture(event.pointerId); // keep dragging outside the strip
      } catch {
        // not an active pointer
      }
    }
    start.moved = true;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.moved && scroller.current?.hasPointerCapture(event.pointerId)) {
      scroller.current.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  };

  const vehicles = useMemo(
    () =>
      consist.map((vehicle) => ({
        vehicle,
        view: manifest ? findSideView(manifest, vehicle) : null,
      })) as { vehicle: string; view: SideView | null }[],
    [consist, manifest],
  );

  const length = vehicles.reduce((sum, { view }) => sum + (view?.length ?? PLACEHOLDER_LENGTH), 0);
  const scale = SCALE;
  const height = HEIGHT;

  const scrollButton = (direction: -1 | 1) => (
    <IconButton
      size="sm"
      variant="soft"
      aria-label={direction < 0 ? "Scroll left" : "Scroll right"}
      onClick={() => scrollBy(direction)}
      sx={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [direction < 0 ? "left" : "right"]: 0,
        zIndex: 1,
        minHeight: 0,
        minWidth: 20,
        px: 0.25,
        borderRadius: "sm",
        opacity: 0.3,
        backgroundOpacity: 0,
        ["&:hover"]: { opacity: 1, backgroundOpacity: 0.15 },
        transition: "opacity 0.2s, background-color 0.2s",
      }}>
      <ChevronIcon direction={direction < 0 ? "left" : "right"} />
    </IconButton>
  );

  return (
    <Box sx={{ position: "relative", maxWidth: "100%" }}>
      {more.left && scrollButton(-1)}
      {more.right && scrollButton(1)}
      <Box
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        sx={{
          "overflowX": "auto",
          "overflowY": "hidden",
          "maxWidth": "100%",
          "scrollbarWidth": "none",
          "&::-webkit-scrollbar": { display: "none" },
          "cursor": more.left || more.right ? "grab" : undefined,
          "userSelect": "none",
        }}>
        {manifest && consist.length > 0 && (
          <Box
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "flex-end",
              width: length * scale,
              height,
              // the rails under the whole train
              backgroundImage: (theme) =>
                `linear-gradient(${theme.vars.palette.neutral.outlinedBorder}, ${theme.vars.palette.neutral.outlinedBorder})`,
              backgroundSize: `100% 2px`,
              backgroundPosition: `0 ${height - RAIL_HEIGHT * scale}px`,
              backgroundRepeat: "no-repeat",
            }}>
            {vehicles.map(({ vehicle, view }, index) => {
              const title = formatVehicleName(vehicle) + cargoName(vehicle);
              return view ? (
                <Box
                  key={index}
                  component="img"
                  src={view.url}
                  alt={title}
                  title={title}
                  loading="lazy"
                  draggable={false}
                  sx={{ display: "block", flex: "none", width: view.length * scale, height }}
                />
              ) : (
                <Box
                  key={index}
                  title={title}
                  sx={{
                    flex: "none",
                    width: PLACEHOLDER_LENGTH * scale,
                    height: 3.2 * scale,
                    mb: `${(RAIL_HEIGHT + 0.6) * scale}px`,
                    mx: "1px",
                    borderRadius: "sm",
                    border: "1px dashed",
                    borderColor: "neutral.outlinedBorder",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}>
                  <Typography level="body-xs" noWrap sx={{ px: 0.5 }}>
                    {formatVehicleName(vehicle)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default TrainSideView;
