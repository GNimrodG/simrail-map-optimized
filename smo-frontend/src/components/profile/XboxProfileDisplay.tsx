import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { UserProfileResponse } from "../../utils/types";
import Avatar from "@mui/joy/Avatar";

export interface XboxProfileDisplayProps {
  profile: UserProfileResponse;
  xboxId: string;
}

const XboxProfileDisplay: FunctionComponent<XboxProfileDisplayProps> = ({ profile, xboxId }) => {
  return (
    // translate="no": a player name, which also changes from the ID to the gamertag once the profile loads
    <Sheet translate="no" variant="outlined" sx={{ p: 1, borderRadius: 10 }}>
      <Stack
        component="a"
        href={profile.PersonaName ? `https://www.xbox.com/en-US/play/user/${profile.PersonaName}` : undefined}
        target="_blank"
        sx={{ textDecoration: "none", color: "inherit" }}
        direction="row"
        spacing={1}
        alignItems="center">
        {profile.PersonaName && <Avatar src={profile.Avatar} alt={profile.PersonaName} />}
        <Typography level="h3">{profile.PersonaName || xboxId}</Typography>
      </Stack>
    </Sheet>
  );
};

export default XboxProfileDisplay;
