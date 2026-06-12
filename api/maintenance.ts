import { get } from "@vercel/edge-config";

const MAINTENANCE_KEY = "maintenanceMode";

export const config = {
  runtime: "edge",
};

function jsonResponse(body: { maintenanceMode: boolean }) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export default async function handler() {
  try {
    const maintenanceMode = await get<boolean>(MAINTENANCE_KEY);
    return jsonResponse({ maintenanceMode: maintenanceMode === true });
  } catch (error) {
    console.error("Failed to read maintenance mode from Edge Config", error);
    return jsonResponse({ maintenanceMode: false });
  }
}
