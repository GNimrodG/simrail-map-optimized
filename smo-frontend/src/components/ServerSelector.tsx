import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
import useNow from "../hooks/useNow";
import { useServerRestarts } from "../hooks/useServerRestarts";
import { useSetting } from "../hooks/useSetting";
import { dataProvider } from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";

const ServerSelector: FunctionComponent = () => {
  const { t } = useTranslation();
  const { setSelectedTrain } = useContext(SelectedTrainContext);
  const { setSelectedRoute } = useContext(SelectedRouteContext);
  const [selectedServer, setSelectedServer] = useSetting("selectedServer");

  const handleServerChange = useCallback(
    (serverCode: string) => {
      if (!serverCode) return;
      setSelectedTrain(null);
      setSelectedRoute(null);
      setSelectedServer(serverCode);
      dataProvider.selectServer(serverCode);
    },
    [setSelectedRoute, setSelectedServer, setSelectedTrain],
  );

  const servers = useBehaviorSubj(dataProvider.serverData$);
  const nextRestarts = useServerRestarts();
  useNow(); // keeps the "in ... minutes" current

  const activeServer = servers?.find((server) => server.ServerCode === selectedServer);

  const isServerInactive = !!activeServer && !activeServer.IsActive;

  const selectedServerRestart = activeServer?.IsActive ? nextRestarts.get(activeServer.ServerCode) : undefined;

  let select = (
    <Select
      sx={{
        width: "14rem",
        ...(isServerInactive && {
          "backgroundColor": "var(--joy-palette-danger-solidBg)",
          "--variant-outlinedHoverBg": "var(--joy-palette-danger-solidHoverBg)",
          "--variant-outlinedColor": "var(--joy-palette-danger-solidColor)",
          "--variant-outlinedBorder": "var(--joy-palette-danger-solidBg)",
        }),
      }}
      value={selectedServer}
      placeholder={!servers?.length ? t("Loading") : selectedServer || t("SelectServer")}
      onChange={(_e, v) => handleServerChange(v!)}
      renderValue={(option) => option && servers?.find((s) => s.ServerCode === option.value)?.ServerName}>
      {servers?.map((server) => {
        const nextRestart = server.IsActive ? nextRestarts.get(server.ServerCode) : undefined;

        return (
          <Option key={server.id} value={server.ServerCode} disabled={!server.IsActive}>
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="baseline" width="100%">
              <span>{server.ServerName}</span>
              {nextRestart && (
                <Typography level="body-xs" textColor="text.tertiary" translate="no" noWrap>
                  {t("ServerRestart.Short", { time: nextRestart.format("LT") })}
                </Typography>
              )}
            </Stack>
          </Option>
        );
      })}
      {!servers?.length && (
        <Option value="loading" disabled>
          {t("Loading")}
        </Option>
      )}
    </Select>
  );

  if (isServerInactive) {
    select = (
      <Tooltip arrow title={t("ServerInactive")} color="danger">
        {select}
      </Tooltip>
    );
  }

  if (!selectedServerRestart) return select;

  return (
    <Stack spacing={0.5} alignItems="flex-start">
      {select}
      <Sheet variant="outlined" sx={{ px: 1, py: 0.25, borderRadius: "sm", maxWidth: "14rem" }}>
        <Typography level="body-xs" translate="no">
          {selectedServerRestart.isBefore()
            ? t("ServerRestart.Due", { time: selectedServerRestart.format("LT") })
            : t("ServerRestart.Next", {
                time: selectedServerRestart.format("LT"),
                relative: selectedServerRestart.fromNow(),
              })}
        </Typography>
      </Sheet>
    </Stack>
  );
};

export default ServerSelector;
