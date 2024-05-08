import { useLocalStorage } from "@mantine/hooks";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import { type FunctionComponent, memo, useCallback, useContext } from "react";

import { selectServer, serverData$ } from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import useBehaviorSubj from "../utils/useBehaviorSubj";

const ServerSelector: FunctionComponent = memo(() => {
  const { setSelectedTrain } = useContext(SelectedTrainContext);
  const { setSelectedRoute } = useContext(SelectedRouteContext);
  const [selectedServer, setSelectedServer] = useLocalStorage({
    key: "selectedServer",
    defaultValue: "en1",
  });

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
      sx={{ width: "12rem" }}
      value={selectedServer}
      placeholder={servers.length === 0 ? "Loading..." : selectedServer || "Select Server"}
      onChange={(_e, v) => handleServerChange(v!)}>
      {servers.map((server) => (
        <Option
          key={server.id}
          value={server.ServerCode}
          disabled={!server.IsActive}>
          {server.ServerName}
        </Option>
      ))}
      {servers.length === 0 && (
        <Option
          value="loading"
          disabled>
          Loading...
        </Option>
      )}
    </Select>
  );
});

export default ServerSelector;
