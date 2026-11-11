import type { NextRequest } from "next/server";
import { getCallerSession, requestClient } from "@/lib/api-auth";
import { readSuggestionAssignments } from "@/lib/schedule-suggestions";
import {
  createScheduleSuggestionService, handleScheduleSuggestionRequest, ScheduleLocationError,
} from "@/lib/server/schedule-suggestions";

const suggest = createScheduleSuggestionService();

export async function POST(request: NextRequest) {
  return handleScheduleSuggestionRequest(request, () => getCallerSession(request), (date, locationId, language) => {
    const client = requestClient(request);
    let verifiedLocation = false;
    return suggest(date, locationId, language, async () => {
      if (!client) throw new Error("Schedule database unavailable");
      const signal = AbortSignal.timeout(5000);
      if (!verifiedLocation) {
        const { data, error } = await client.from("locations")
          .select("id").eq("id", locationId).abortSignal(signal).maybeSingle();
        if (error) throw error;
        if (!data) throw new ScheduleLocationError();
        verifiedLocation = true;
      }
      return readSuggestionAssignments(client, locationId, date, signal);
    });
  });
}
