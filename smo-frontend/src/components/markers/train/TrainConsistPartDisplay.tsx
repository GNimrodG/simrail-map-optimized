import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { formatVehicleName, getThumbnailUrl } from "../../utils/general-utils";

export interface TrainConsistPartDisplayProps {
  vehicles: string[];
}

function formatCargoName(cargo: string): string {
  return cargo
    .replace(/([A-Z])/g, " $1")
    .replace(/(\D)(\d+x\d+)/g, "$1 $2")
    .trim();
}

const TrainConsistPartDisplay: FunctionComponent<TrainConsistPartDisplayProps> = ({ vehicles }) => {
  if (vehicles.length === 0) {
    return null;
  }

  const [shortName] = vehicles[0].split("/");

  const allSame = vehicles.every((x) => x === vehicles[0]);

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: "100%" }} gap={1}>
      <Stack>
        <Typography level="title-md">{shortName}</Typography>
        {(allSame ? [vehicles[0]] : vehicles).map((x, i) => (
          <Typography key={i + x} fontFamily="monospace" level="body-sm">
            {formatVehicleName(x)}

            {x.includes("@") && (
              <>
                {" - "}
                {formatCargoName(x.replace(/.+@(.+)$/, "$1").replace(/_/g, " "))}
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
