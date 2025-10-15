import { NextResponse } from "next/server";
import { z } from "zod";

import { restrictedCategoryList } from "@/lib/constants/categories";
import {
  MissingPlaceDatasetError,
  queryRestrictedPlaces
} from "@/lib/services/place-repository";
import type { RestrictedCategory } from "@/types/map";

export const runtime = "nodejs";

const querySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().default(1500),
  categories: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined))
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { lat, lng, radius, categories } = parsed.data;

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng parameters are required" }, { status: 400 });
  }

  const allowed = new Set<string>(restrictedCategoryList);
  const requested = (categories ?? restrictedCategoryList).filter((category) =>
    allowed.has(category)
  ) as RestrictedCategory[];

  try {
    const response = await queryRestrictedPlaces({
      location: { lat, lng },
      radiusMeters: radius,
      categories: requested
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof MissingPlaceDatasetError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
