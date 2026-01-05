// ============================================
// Public Transit Route Generator (Server Action)
// ============================================

"use server";

import { auth } from "@clerk/nextjs/server";
import { tripInputSchema, type TripInputInput } from "@/lib/schemas/route";
import { generatePublicTransitRoute } from "@/lib/algorithms/public-transit";
import type { TripOutput } from "@/types";

export interface GenerateRouteResult {
  success: boolean;
  data?: TripOutput;
  error?: {
    code: "AUTH_ERROR" | "VALIDATION_ERROR" | "API_ERROR";
    message: string;
  };
}

export async function generateRoute(
  input: TripInputInput
): Promise<GenerateRouteResult> {
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Authentication required.",
      },
    };
  }

  const validationResult = tripInputSchema.safeParse(input);
  if (!validationResult.success) {
    const message = validationResult.error.errors
      .map((error) => error.message)
      .join(", ");
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message,
      },
    };
  }

  try {
    const route = await generatePublicTransitRoute(validationResult.data);
    return {
      success: true,
      data: route,
    };
  } catch (error) {
    console.error("[generateRoute] failed:", error);
    return {
      success: false,
      error: {
        code: "API_ERROR",
        message: "Failed to generate route.",
      },
    };
  }
}
