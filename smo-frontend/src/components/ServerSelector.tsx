import { useLocalStorage } from "@mantine/hooks";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import { type FunctionComponent, memo, useCallback, useContext, useEffect, useState } from "react";

import {
  getServerStatus,
  offServerList,
  onServerList,
  selectServer,
  ServerListCallback,
} from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";

const ServerSelector: FunctionComponent = memo(() => {
  const { setSelectedTrain } = useContext(SelectedTrainContext);
  const { setSelectedRoute } = useContext(SelectedRouteContext);
  const [selectedServer, setSelectedServer] = useLocalStorage({
    key: "selectedServer",
    defaultValue: "en1",
  });

  const handleServerChange = useCallback(
    (serverCode: string) => {
      setSelectedTrain(null);
      setSelectedRoute(null);
      setSelectedServer(serverCode);
      selectServer(serverCode);
    },
    [setSelectedRoute, setSelectedServer, setSelectedTrain]
  );

  const [servers, setServers] = useState(getServerStatus());

  useEffect(() => {
    const handler: ServerListCallback = (data) => {
      setServers(data);
    };

    onServerList(handler);

    return () => {
      offServerList(handler);
    };
  }, []);

  return (
    <Select
      value={selectedServer}
      onChange={(_e, v) => handleServerChange(v!)}>
      {servers.map((server) => (
        <Option
          key={server.id}
          value={server.ServerCode}>
          {server.ServerName}
        </Option>
      ))}
    </Select>
  );
});

export default ServerSelector;
