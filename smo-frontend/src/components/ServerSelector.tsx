import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import { type FunctionComponent, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";

import { selectServer, serverData$ } from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import { useSetting } from "../utils/use-setting";
import useBehaviorSubj from "../utils/useBehaviorSubj";

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
      selectServer(serverCode);
    },
    [setSelectedRoute, setSelectedServer, setSelectedTrain]
  );

  const servers = useBehaviorSubj(serverData$);

  return (
    <Select
      sx={{ width: "14rem" }}
      value={selectedServer}
      placeholder={!servers?.length ? t("Loading") : selectedServer || t("SelectServer")}
      onChange={(_e, v) => handleServerChange(v!)}>
      {servers?.map((server) => (
        <Option
          key={server.id}
          value={server.ServerCode}
          disabled={!server.IsActive}>
          {server.ServerName}
        </Option>
      ))}
      {!servers?.length && (
        <Option
          value="loading"
          disabled>
          {t("Loading")}
        </Option>
      )}
    </Select>
  );
};

export default ServerSelector;
