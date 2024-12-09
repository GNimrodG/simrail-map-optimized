import Box from "@mui/joy/Box";
import List from "@mui/joy/List";
import ListDivider from "@mui/joy/ListDivider";
import ListItem from "@mui/joy/ListItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Fragment, type FunctionComponent, useMemo } from "react";

import TrainConsistPartDisplay from "./TrainConsistPartDisplay";

export interface TrainConsistDisplayProps {
  consist: string[];
}

const TrainConsistDisplay: FunctionComponent<TrainConsistDisplayProps> = ({ consist }) => {
  const consistData = useMemo(
    () =>
      consist.reduce(
        (acc, vehicle) => {
          const [shortName] = vehicle.split("/");
          const lastItem = acc[acc.length - 1];

          if (!lastItem || lastItem.shortName !== shortName) {
            acc.push({ count: 1, shortName, vehicles: [vehicle] });
          } else {
            lastItem.count++;
            lastItem.vehicles.push(vehicle);
          }

          return acc;
        },
        [] as { count: number; shortName: string; vehicles: string[] }[],
      ),
    [consist],
  );

  return (
    <List sx={{ p: 1 }} size="sm">
      {consistData.map(({ count, vehicles, shortName }, index) => (
        <Fragment key={index + shortName}>
          {index > 0 && <ListDivider />}
          <ListItem>
            <Stack sx={{ width: "100%" }} gap={1} alignItems="flex-start" direction="row">
              <Box
                sx={{
                  width: "3rem",
                }}>
                <Typography level="title-lg">{count}x</Typography>
              </Box>

              <TrainConsistPartDisplay vehicles={vehicles} />
            </Stack>
          </ListItem>
        </Fragment>
      ))}
    </List>
  );
};

export default TrainConsistDisplay;
