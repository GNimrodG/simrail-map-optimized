import Box from "@mui/joy/Box";
import List from "@mui/joy/List";
import ListDivider from "@mui/joy/ListDivider";
import ListItem from "@mui/joy/ListItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Fragment, type FunctionComponent, useMemo } from "react";
import { useTranslation } from "react-i18next";

import TrainConsistPartDisplay from "./TrainConsistPartDisplay";

export interface TrainConsistDisplayProps {
  consist: string[];
}

const TrainConsistDisplay: FunctionComponent<TrainConsistDisplayProps> = ({ consist }) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainMakerPopup" });

  const consistData = useMemo(
    () =>
      consist.reduce(
        (acc, vehicle) => {
          const [shortName] = vehicle.split("/");
          const lastItem = acc.at(-1);

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
    <Box
      sx={{
        maxHeight: "90vh",
        overflowY: "auto",
        position: "relative",
      }}>
      <Typography
        level="body-lg"
        textAlign="center"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: (theme) => theme.palette.background.surface,
          boxShadow: (theme) => `0px 4px 10px ${theme.palette.background.surface}`,
        }}>
        {t("Consist")}
      </Typography>
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
    </Box>
  );
};

export default TrainConsistDisplay;
