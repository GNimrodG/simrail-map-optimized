export interface ServerStatus {
  ServerCode: string;
  ServerName: string;
  ServerRegion: string;
  IsActive: boolean;
  id: string;
}

export interface ServerRestartPrediction {
  ServerCode: string;
  /** The predicted next restart, null when the server has no regular restart schedule. */
  NextProbableRestartTime: Date | null;
  /** The chance (0..1) that the prediction is right (within 15 minutes). */
  Confidence: number | null;
}

/** Whether a train in the spawn list is still to spawn, is late to spawn or has spawned. */
export type SpawnStatus = "Upcoming" | "Overdue" | "Spawned";

/** A train that spawns (enters the map) at a border station, from the backend's spawn list. */
export interface SpawnListEntry {
  trainNoLocal: string;
  trainName: string;
  trainType: string;
  startStation: string;
  endStation: string;
  /** The border station: the last timetable point before the train spawns, or its first point. */
  border: string;
  /** The first timetable point the train runs to after spawning. */
  entry: string;
  /** The scheduled time at the border station in the server's time ("yyyy-MM-dd HH:mm:ss"). */
  scheduledTime: string;
  /** When the train is expected to spawn (or spawned), in the server's time ("yyyy-MM-dd HH:mm:ss"). */
  expectedTime: string;
  /** When the train is expected to spawn (or spawned), ISO UTC. */
  expectedAt: string;
  status: SpawnStatus;
  /** The locomotive type from the timetable. */
  locoType: string;
  /** The train length from the timetable, in meters. */
  trainLength: number;
  /** The train weight from the timetable, in tonnes. */
  trainWeight: number;
  /** The live consist of a spawned train, otherwise the one from the last time the train ran. Null when unknown. */
  consist: string[] | null;
  /** Whether the consist is from the last time the train ran (the next run may differ). */
  consistFromLastRun: boolean;
}

export interface Train extends UnusualCargoFlags {
  TrainNoLocal: string;
  TrainName: string;
  TrainType: string;
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

  ControlledBySteamID: string | null;
  ControlledByXboxID: string | null;
  InBorderStationArea: boolean;
  Latitude: number;
  Longitude: number;
  /** Direction of travel in degrees (0 = north, clockwise), null until the train moved */
  Heading?: number | null;
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
  ControlledBySteamID: string | null;
  ControlledByXboxID: string | null;
  InBorderStationArea: boolean;
  Latitude: number;
  Longitude: number;
  /** Direction of travel in degrees (0 = north, clockwise), null until the train moved */
  Heading?: number | null;
  VDDelayedTimetableIndex: number;
  RequiredMapDLCs: number[][] | null;
}

export interface Station {
  Name: string;
  Prefix: string;
  DifficultyLevel: number;
  Latitude: number;
  Longitude: number;
  MainImageUrl?: string;
  AdditionalImage1Url?: string;
  AdditionalImage2Url?: string;
  DispatchedBy:
    | [
        {
          ServerCode: string;
          // Note: SteamId uses "null" as a string for null values
          SteamId: string;
          XboxId: string | null;
        },
      ]
    | never[];
  Id: string;
  RemoteControlled?: string;
  SubStations?: string[];
  IgnoredStations?: string[];
}

export interface PartialStation {
  Id: string;
  DispatchedBy: [
    {
      ServerCode: string;
      SteamId: string;
      XboxId: string | null;
    },
  ];
}

export interface Signal {
  Name: string;
  Location: { X: number; Y: number };
  Extra: string;
  Accuracy: number;
  /** The direction of travel the signal applies to, degrees from north (only known for signals from the game files) */
  Heading?: number | null;
  /** "main", "block", "repeater" / "distant" (show what the main signal ahead shows, see getMainSignalName),
   * "shunting" or null */
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

  subStationEntries?: SimplifiedTimtableEntry[];
  note?: string | null;

  isQualityTracked?: boolean;
  isOverGauge?: boolean;
  isOverWeight?: boolean;
  isOtherExceptional?: boolean;
  isHighRiskCargo?: boolean;
  isDangerousCargo?: boolean;
}

export interface UnusualCargoFlags {
  IsQualityTracked?: boolean;
  IsOverGauge?: boolean;
  IsOverWeight?: boolean;
  IsOtherExceptional?: boolean;
  IsHighRiskCargo?: boolean;
  IsDangerousCargo?: boolean;
}

export type CommonOsmTags = "name" | "operator" | (string & {});

export interface OsmTagged {
  tags: Record<CommonOsmTags, string>;
}

export interface OsmNode extends OsmTagged {
  id: number;
  lat: number;
  lon: number;
}

/**
 * A level crossing of the game's map: "barriers" (categories A and B), "lights" (warning lights only, C) or
 * "passive" (signs only, D).
 */
export interface Crossing {
  id: string;
  lat: number;
  lon: number;
  type: "barriers" | "lights" | "passive";
  /** The railway line ("14", "LHS") and the kilometre ("2.409") the stations call the crossing by, when it's known */
  line?: string;
  km?: string;
}

/**
 * A sign before a level crossing: W6a crossing ahead, W6b give signal Rp1 ("Attention") with a crossing ahead, W6
 * give signal Rp1
 */
export interface CrossingSign {
  id: string;
  lat: number;
  lon: number;
  type: "W6" | "W6a" | "W6b";
  /** The direction of travel the sign is for, degrees clockwise from north */
  heading: number;
}

export interface UserProfileResponse {
  Avatar: string;
  PersonaName: string;
}

export interface SteamProfileStats {
  Achievements: { Name: string; Achieved: number }[];
  Stats: { Name: string; Value: number }[];
}
