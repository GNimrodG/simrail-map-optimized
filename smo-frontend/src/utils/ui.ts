import { DefaultColorPalette } from "@mui/joy/styles/types";

export function getColorTrainMarker(velocity: number): DefaultColorPalette {
  if (velocity < 10) {
    return "danger";
  } else if (velocity < 60) {
    return "warning";
  } else if (velocity < 180) {
    return "success";
  }

  return "primary";
}

export function getDistanceColorForSignal(distance: number): DefaultColorPalette {
  if (distance < 200) {
    return "danger";
  } else if (distance < 500) {
    return "warning";
  } else if (distance < 1000) {
    return "success";
  }

  return "primary";
}

export function getSpeedColorForSignal(velocity: number): DefaultColorPalette {
  if (velocity < 10) {
    return "danger";
  } else if (velocity < 120) {
    return "warning";
  }

  return "success";
}

export function normalizeString(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("Ł", "L")
    .replaceAll("ł", "l")
    .replaceAll("ą", "a")
    .replaceAll("ę", "e")
    .replaceAll("ó", "o")
    .replaceAll("ś", "s");
}
