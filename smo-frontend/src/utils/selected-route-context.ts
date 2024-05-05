import { createContext } from "react";
const SelectedRouteContext = createContext<{
  selectedRoute: string | null;
  setSelectedRoute: (value: string | null) => void;
}>({ selectedRoute: null, setSelectedRoute: () => {} });

export default SelectedRouteContext;
