import { createContext } from "react";

const SelectedStationTimetableContext = createContext<{
  selectedStationTimetable: string | null;
  setSelectedStationTimetable: (value: string | null) => void;
}>({ selectedStationTimetable: null, setSelectedStationTimetable: () => {} });

export default SelectedStationTimetableContext;
