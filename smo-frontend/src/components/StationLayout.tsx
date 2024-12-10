import Box from "@mui/joy/Box";
import { styled } from "@mui/joy/styles";
import { type FunctionComponent, useMemo } from "react";

import { Train, trainsData$ } from "../utils/data-manager";
import useBehaviorSubj from "../utils/use-behaviorSubj";
import StationLayoutBlock from "./StationLayoutBlock";
import StationLayoutGraphic from "./StationLayoutGraphic";

export type StationLayoutData = (string | [string, number, string | null, string | null] | null)[][];

export interface StationLayoutProps {
  layout: string[];
  defs: Record<string, string[]>;
  showText?: boolean;
}

const StationGrid = styled("table")({
  borderSpacing: 0,
  // good for debugging
  // ["& td"]: {
  //   borderRight: "1px solid #171919",
  //   borderBottom: "1px solid #171919",
  // },
});

function getTrainForTrack(trains: Train[], signals: (string | null)[] | null) {
  if (!signals) return null;
  return trains.find((train) => signals.includes(train.TrainData.SignalInFront?.split("@")[0])) || null;
}

const StationLayout: FunctionComponent<StationLayoutProps> = ({ layout: rawLayout, showText: _showText, defs }) => {
  const showText = _showText ?? true;
  const layout = useMemo(
    () =>
      rawLayout.map((row) =>
        row.split("|").map((x) => {
          const parts = x.split(";");
          return parts.length > 1 ? parts : x;
        }),
      ),
    [rawLayout],
  );
  const trains = useBehaviorSubj(trainsData$);
  const trainData = useMemo(
    () =>
      layout.map((row) =>
        row.map((cell) => (Array.isArray(cell) && getTrainForTrack(trains, defs[cell[0]]?.slice(0, 2))) || null),
      ),
    [layout, trains, defs],
  );

  const columns = useMemo(
    () =>
      Math.max(
        ...layout.map((x) =>
          x.reduce((acc, curr) => {
            if (Array.isArray(curr)) return acc + (+curr[1] || 1);
            return acc + 1;
          }, 0),
        ),
      ),
    [layout],
  );

  return (
    <StationGrid>
      <thead>
        <tr>
          {[]
            .constructor(columns)
            .fill(null)
            .map((_: null, i: number) => (
              <Box component="td" key={`slh_${i}_${columns}`}>
                <Box sx={{ width: 50 }} />
              </Box>
            ))}
        </tr>
      </thead>
      <tbody>
        {layout.map((row, i) => (
          <Box component="tr" sx={{ height: 70 }} key={`slr_${i}_${row.length}`}>
            {row.map((cell, j) => {
              if (!cell) return <td key={`slc_empty_${i}-${j}`} />;

              if (Array.isArray(cell)) {
                return (
                  <StationLayoutBlock key={`slc_block_${i}-${j}`} data={cell} defs={defs} train={trainData[i][j]} />
                );
              }

              return <StationLayoutGraphic key={`slc_graphic_${i}-${j}`} cell={cell} showText={showText} />;
            })}
          </Box>
        ))}
      </tbody>
    </StationGrid>
  );
};

export default StationLayout;
