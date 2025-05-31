import Avatar from "@mui/joy/Avatar";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { SteamProfileResponse } from "../utils/types";

export interface SteamProfileDisplayProps {
  profile: SteamProfileResponse;
  steamId: string;
}

const SteamProfileDisplay: FunctionComponent<SteamProfileDisplayProps> = ({ profile, steamId }) => {
  return (
    <Sheet variant="outlined" sx={{ p: 1, borderRadius: 10 }}>
      <Stack
        component="a"
        href={`https://steamcommunity.com/profiles/${steamId}`}
        target="_blank"
        sx={{ textDecoration: "none", color: "inherit" }}
        direction="row"
        spacing={1}
        alignItems="center">
        <Avatar src={profile.Avatar} alt={profile.PersonaName} />
        <Typography level="h3">{profile.PersonaName}</Typography>
      </Stack>
    </Sheet>
  );
};

export default SteamProfileDisplay;
