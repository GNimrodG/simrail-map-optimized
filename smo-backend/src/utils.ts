import { Train } from "./api-helper";

export function getTrainId(train: Train) {
  return `${train.TrainNoLocal}@${train.ServerCode}-${train.id}`;
}
