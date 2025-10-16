import type { CityId } from "@/types/map";
import montevideoGeometry from "./montevideo.json";

export const cityLandGeometry: Record<CityId, typeof montevideoGeometry> = {
  montevideo: montevideoGeometry
};
