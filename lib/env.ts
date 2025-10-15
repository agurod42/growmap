import { z } from "zod";

const envSchema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().min(1, "GOOGLE_MAPS_API_KEY is required"),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required for client rendering"),
  NEXT_PUBLIC_DEFAULT_LOCATION: z.string().optional()
});

const parsed = envSchema.safeParse({
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_DEFAULT_LOCATION: process.env.NEXT_PUBLIC_DEFAULT_LOCATION
});

if (!parsed.success) {
  console.warn(
    "Environment variables validation failed. Some features may not work until you configure the following:"
  );
  for (const issue of parsed.error.issues) {
    console.warn(`- ${issue.message}`);
  }
}

export const env = parsed.success
  ? parsed.data
  : {
      GOOGLE_MAPS_API_KEY: "",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      NEXT_PUBLIC_DEFAULT_LOCATION: undefined
    };
