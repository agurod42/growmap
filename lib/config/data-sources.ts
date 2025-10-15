import { CannabisCategory, RestrictedCategory } from "@/types/map";

export type PlaceQueryConfig = {
  textQuery: string;
  type?: string;
  keyword?: string;
  fields?: string[];
};

export const CANNABIS_QUERIES: Record<CannabisCategory, PlaceQueryConfig> = {
  grow_shop: {
    textQuery: "cannabis grow shop",
    keyword: "hydroponics,grow shop,cannabis cultivation",
    type: "store"
  },
  dispensary: {
    textQuery: "cannabis dispensary",
    type: "store",
    keyword: "dispensary,cannabis dispensary"
  },
  medical: {
    textQuery: "medical cannabis clinic",
    type: "doctor",
    keyword: "medical cannabis,medical marijuana"
  },
  headshop: {
    textQuery: "headshop cannabis accessories",
    type: "store",
    keyword: "headshop,cannabis accessories"
  },
  event: {
    textQuery: "cannabis event",
    keyword: "cannabis expo,420 event,cannabis workshop"
  },
  other: {
    textQuery: "cannabis club",
    keyword: "cannabis club,private cannabis lounge"
  }
};

export const RESTRICTED_QUERIES: Record<RestrictedCategory, PlaceQueryConfig> = {
  school: {
    textQuery: "schools",
    type: "school"
  },
  cultural_center: {
    textQuery: "cultural center",
    type: "tourist_attraction",
    keyword: "cultural center,community center,library"
  },
  rehab_center: {
    textQuery: "drug rehabilitation center",
    keyword: "rehabilitation center,drug treatment,detox center"
  }
};

export const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "rating",
  "userRatingCount",
  "businessStatus",
  "websiteUri",
  "internationalPhoneNumber"
];
