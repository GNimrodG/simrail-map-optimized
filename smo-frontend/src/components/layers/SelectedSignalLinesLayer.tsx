import { type FunctionComponent, useContext } from "react";
import { LayerGroup, Polyline, Tooltip } from "react-leaflet";

import SignalLinesContext, { SignalLineData } from "../../utils/signal-lines-context";

function getLineColor(type: SignalLineData["lines"][0]["type"]) {
  switch (type) {
    case "prev":
      return "red";
    case "prev-further":
      return "orange";
    case "next":
      return "blue";
    case "next-further":
      return "purple";
  }
}

const SelectedSignalLinesLayer: FunctionComponent = () => {
  const { signalLines } = useContext(SignalLinesContext);

  return (
    <LayerGroup>
      {signalLines?.lines.map((line) => (
        <Polyline
          key={`selected-signal-line-${line.index}-${line.type}-${line.signal}`}
          positions={line.coords}
          color={getLineColor(line.type)}
          weight={5}>
          <Tooltip
            permanent
            direction="center">
            {line.signal}
          </Tooltip>
        </Polyline>
      ))}
    </LayerGroup>
  );
};

export default SelectedSignalLinesLayer;
