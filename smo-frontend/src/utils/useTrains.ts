import { useEffect, useState } from "react";

import { DataCallback, offData, onData, Train } from "./data-manager";

const useTrains = () => {
  const [trains, setTrains] = useState<Train[]>([]);

  useEffect(() => {
    const handler: DataCallback = (data) => {
      setTrains(data.trains || []);
    };

    onData(handler);

    return () => {
      offData(handler);
    };
  }, []);

  return trains;
};

export default useTrains;
