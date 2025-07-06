import {useHotkeys} from "@mantine/hooks";
import {Fragment, type FunctionComponent, useContext} from "react";
import {LayerGroup, Polyline, Tooltip} from "react-leaflet";

import MapLinesContext from "../../utils/map-lines-context";

const MapLinesLayer: FunctionComponent = () => {
  const { mapLines, setMapLines } = useContext(MapLinesContext);

  useHotkeys([
    [
      "Escape",
      () => {
        mapLines && setMapLines(null);
      },
    ],
    [
      "mod+E",
      () => {
        // export the lines to a file in WKT format
        if (!mapLines) return;
        const lines = mapLines.lines.map((line) => {
          const coords = line.coords
            .map(([x, y]) => `${y} ${x}`) // swap lat and lon
            .toReversed()
            .join(",");
          return `(${coords})`;
        });

        const wkt = `SRID=4326;MULTILINESTRING(${lines.join(",")})`;

        const blob = new Blob([wkt], { type: "text/plain;charset=utf-8" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "map-lines.wkt";

        a.click();
      },
    ],
  ]);

  return (
    <LayerGroup pane="mapLinesPane">
      {mapLines?.lines.map((line) => (
        <Fragment
          key={`selected-signal-line-${line.index}-${line.color}-${line.label}-${line.coords[0][0]}-${line.coords[0][1]}`}>
          {line.color2 && (
            // Background line with color2
            <Polyline positions={line.coords} color={line.color} interactive={false} weight={5} pane="mapLinesPane" />
          )}
          {/* Foreground line with color (dashed if color2 exists) */}
          <Polyline
            positions={line.coords}
            color={line.color2 || line.color}
            dashArray={line.color2 ? "10, 20" : undefined}
            lineCap={line.color2 ? "butt" : undefined}
            interactive={false}
            weight={line.width || 5}
            pane="mapLinesPane">
            {line.label && (
                <Tooltip permanent direction="center">
                  {line.label}
                </Tooltip>
            )}
          </Polyline>
        </Fragment>
      ))}
    </LayerGroup>
  );
};

export default MapLinesLayer;
