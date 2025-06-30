import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";

import useBehaviorSubj from "../hooks/useBehaviorSubj";
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

  const activeServer = servers?.find((server) => server.ServerCode === selectedServer);

  const isServerInactive = !!activeServer && !activeServer.IsActive;

  const select = (
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
      onChange={(_e, v) => handleServerChange(v!)}>
      {servers?.map((server) => (
        <Option key={server.id} value={server.ServerCode} disabled={!server.IsActive}>
          {server.ServerName}
        </Option>
      ))}
      {!servers?.length && (
        <Option value="loading" disabled>
          {t("Loading")}
        </Option>
      )}
    </Select>
  );

  if (isServerInactive) {
    return (
      <Tooltip arrow title={t("ServerInactive")} color="danger">
        {select}
      </Tooltip>
    );
  }

  return select;
};

export default ServerSelector;
