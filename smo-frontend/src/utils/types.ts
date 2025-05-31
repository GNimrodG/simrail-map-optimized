export interface ServerStatus {
  ServerCode: string;
  ServerName: string;
  ServerRegion: string;
  IsActive: boolean;
  id: string;
}

export interface Train {
  TrainNoLocal: string;
  TrainName: string;
  StartStation: string;
  EndStation: string;
  Vehicles: string[];
  ServerCode: string;
  TrainData: TrainData;
  Id: string;
  Type: "user" | "bot";
}

export interface TrainData {
  Velocity: number;
  SignalInFront: string;
  DistanceToSignalInFront: number;
  SignalInFrontSpeed: number;

  ControlledBySteamID: string;
  InBorderStationArea: boolean;
  Latitude: number;
  Longitude: number;
  VDDelayedTimetableIndex: number;
  RequiredMapDLCs: number[][] | null;
}

export interface PartialTrainData {
  Id: string;

  Type: "user" | "bot";
  Velocity: number;
  SignalInFront: string;
  DistanceToSignalInFront: number;
  SignalInFrontSpeed: number;
  ControlledBySteamID: string;
  InBorderStationArea: boolean;
  Latitude: number;
  Longitude: number;
  VDDelayedTimetableIndex: number;
  RequiredMapDLCs: number[][] | null;
}

export interface Station {
  Name: string;
  Prefix: string;
  DifficultyLevel: number;
  Latitude: number;
  Longitude: number;
  MainImageUrl: string;
  AdditionalImage1Url: string;
  AdditionalImage2Url: string;
  DispatchedBy:
    | [
        {
          ServerCode: string;
          SteamId: string;
        },
      ]
    | never[];
  Id: string;
  RemoteControlled?: string;
}

export interface PartialStation {
  Id: string;
  DispatchedBy: [
    {
      ServerCode: string;
      SteamId: string;
    },
  ];
}

export interface Signal {
  Name: string;
  Location: { X: number; Y: number };
  Extra: string;
  Accuracy: number;
  Type?: string | null;
  Role?: string | null;
  PrevFinalized: boolean;
  NextFinalized: boolean;
  PrevSignals: { Name: string; Vmax: number | null }[];
  NextSignals: { Name: string; Vmax: number | null }[];
}

export interface SignalStatusData {
  Name: string;
  Trains: string[] | null;
  TrainsAhead: string[] | null;
  NextSignalWithTrainAhead: string | null;
}

export type SignalStatus = Signal & SignalStatusData;

export interface TrainRoute {
  route: string;
  points: [number, number][];
}

export interface TimeData {
  Time: number;
  Timezone: number;
  LastUpdated: string;
}

export interface Timetable {
  TrainNoLocal: string;
  TrainNoInternational: string;
  TrainName: string;
  StartStation: string;
  StartsAt: `${number}:${number}:${number}`;
  EndStation: string;
  EndsAt: `${number}:${number}:${number}`;
  LocoType: string;
  TrainLength: number;
  TrainWeight: number;
  ContinuesAs: string;
  TimetableEntries: TimetableEntry[];
}

export interface TimetableEntry {
  NameOfPoint: string;
  NameForPerson: string;
  PointId: string;
  SupervisedBy: string;
  RadioChannels: string;
  DisplayedTrainNumber: string;
  ArrivalTime: `${number}-${number}-${number} ${number}:${number}:${number}` | null;
  DepartureTime: `${number}-${number}-${number} ${number}:${number}:${number}` | null;
  StopType: "NoStopOver" | "CommercialStop" | "NoncommercialStop";
  Line: number;
  Platform: string | null;
  Track: number | null;
  TrainType: string;
  Mileage: number;
  MaxSpeed: number;
  StationCategory: "A" | "B" | "C" | "D" | null;
}

export interface SimplifiedTimtableEntry {
  stationName: string;
  stationCategory: "A" | "B" | "C" | "D" | "E";

  trainNoLocal: string;
  trainType: string;

  arrivalTime: string | null;
  departureTime: string | null;
  stopType: "NoStopOver" | "CommercialStop" | "NoncommercialStop";

  line: number;
  platform: string | null;
  track: number | null;

  previousStation: string | null;
  nextStation: string | null;

  index: number;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type CommonOsmTags = "name" | "operator" | (string & {});

export interface OsmNode {
  id: number;
  lat: number;
  lon: number;
  tags: Record<CommonOsmTags, string>;
}

export interface SteamProfileResponse {
  Avatar: string;
  PersonaName: string;
}

export interface SteamProfileStats {
  Achievements: { Name: string; Achieved: number }[];
  Stats: { Name: string; Value: number }[];
}
