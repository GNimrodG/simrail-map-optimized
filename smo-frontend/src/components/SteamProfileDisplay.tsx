import Avatar from "@mui/joy/Avatar";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { ProfileResponse } from "../utils/steam";

export interface SteamProfileDisplayProps {
  profile: ProfileResponse;
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
        alignItems="center"
      >
        <Avatar src={profile.avatar} alt={profile.personaname} />
        <Typography level="h3">{profile.personaname}</Typography>
      </Stack>
    </Sheet>
  );
};

export default SteamProfileDisplay;
