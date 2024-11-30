import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { getThumbnailUrl } from "../utils/general-utils";

export interface TrainConsistPartDisplayProps {
  vehicles: string[];
}

const TrainConsistPartDisplay: FunctionComponent<TrainConsistPartDisplayProps> = ({ vehicles }) => {
  if (vehicles.length === 0) {
    return null;
  }

  const [shortName] = vehicles[0].split("/");

  const allSame = vehicles.every((x) => x === vehicles[0]);

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ width: "100%" }}
      gap={1}>
      <Stack>
        <Typography level="title-md">{shortName}</Typography>
        {(allSame ? [vehicles[0]] : vehicles).map((x, i) => (
          <Typography
            key={i + x}
            fontFamily="monospace"
            level="body-sm">
            {x
              .replace(/.+\/(.+?)(@.+)?$/, "$1")
              .replace(
                /(.+)_(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})[-_]?(\d)(:(\w:\d+))?/,
                "$2 $3 $4-$5 $6-$7 ($1) $9"
              )
              .trim()}

            {x.includes("@") && (
              <>
                {" - "}
                {x.replace(/.+@(.+)$/, "$1").replace(/_/g, " ")}
              </>
            )}
          </Typography>
        ))}
      </Stack>

      <Box
        component="img"
        aria-hidden
        sx={{
          height: "3rem",
        }}
        src={getThumbnailUrl(vehicles[0])}
        alt=""
      />
    </Stack>
  );
};

export default TrainConsistPartDisplay;
