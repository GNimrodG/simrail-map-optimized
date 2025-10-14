import Button, { type ButtonProps } from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography, { type TypographyProps } from "@mui/joy/Typography";
import { type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

interface SelectedRouteControlProps {
  title: string;
  value: string;
  valueColor?: TypographyProps["color"];
  onValueClick: () => void;
  onHide: () => void;
  hideButtonColor?: ButtonProps["color"];
}

const SelectedRouteControl: FunctionComponent<SelectedRouteControlProps> = ({
  title,
  value,
  valueColor = "primary",
  onValueClick,
  onHide,
  hideButtonColor = "danger",
}) => {
  const { t } = useTranslation();

  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 1,
        borderRadius: "var(--joy-radius-sm)",
      }}>
      <Stack>
        <Typography level="body-md" textAlign="center">
          {title}
        </Typography>
        <Stack spacing={1} direction="row" alignItems="center">
          <Typography
            level="body-lg"
            variant="outlined"
            color={valueColor}
            sx={{ "&:hover": { borderWidth: 2, padding: "1px" }, "cursor": "pointer", "padding": "2px" }}
            onClick={onValueClick}>
            {value}
          </Typography>
          <Button size="sm" variant="outlined" color={hideButtonColor} onClick={onHide}>
            {t("Hide")}
          </Button>
        </Stack>
      </Stack>
    </Sheet>
  );
};

export default SelectedRouteControl;
