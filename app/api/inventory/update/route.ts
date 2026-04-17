/*
  POST /api/inventory/update
  Updates stock level for an inventory item. Requires user_lead or above.
  If new stock drops below critical threshold, posts alert to managers channel.
  Body: { id, newStock, locationId }
  updatedBy is derived from the session — not trusted from the body.
*/

import { NextRequest, NextResponse } from "next/server";
import { updateInventoryItem, getInventory, getChannels, sendMessage } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/types";
import { getCallerSession, hasRole, unauthorized, forbidden, resolveLocationId } from "@/lib/api-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCallerSession(request);
  if (!caller) return unauthorized();
  if (!hasRole(caller, "user_lead", "admin", "super_admin")) return forbidden();

  try {
    const body = await request.json();
    const { id, newStock } = body;
    const locationId = resolveLocationId(caller, body.locationId);

    if (!id || newStock === undefined) {
      return NextResponse.json(
        { error: "id and newStock are required" },
        { status: 400 },
      );
    }
    if (!locationId) {
      return NextResponse.json(
        { error: "No location associated with your account." },
        { status: 403 },
      );
    }

    if (typeof newStock !== "number" || newStock < 0) {
      return NextResponse.json(
        { error: "newStock must be a number greater than or equal to 0" },
        { status: 400 },
      );
    }

    const inventory = await getInventory(locationId);
    const currentItem = inventory.find((item: InventoryItem) => item.id === id);

    if (!currentItem) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
    }

    const wasAlreadyCritical = currentItem.currentStock <= currentItem.criticalThreshold;

    const updatedItem = await updateInventoryItem({
      id,
      newStock,
      updatedBy: caller.employeeId ?? caller.userId,
    });

    if (!updatedItem) {
      return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
    }

    let status: "ok" | "low" | "critical";
    if (newStock <= currentItem.criticalThreshold) status = "critical";
    else if (newStock <= currentItem.lowThreshold) status = "low";
    else status = "ok";

    let alertSent = false;
    let alertMessage: string | null = null;

    if (newStock <= currentItem.criticalThreshold && !wasAlreadyCritical) {
      const channels = await getChannels(locationId);
      const managersChannel = channels.find((c) => c.slug === "managers");

      if (managersChannel && caller.employeeId) {
        alertMessage =
          `⚠️ STOCK ALERT: ${currentItem.itemName} is critically low — ` +
          `${newStock} ${currentItem.unit} remaining ` +
          `(critical threshold: ${currentItem.criticalThreshold} ${currentItem.unit}). Please reorder.`;

        const messageResult = await sendMessage({
          channelId: managersChannel.id,
          senderId: caller.employeeId,
          message: alertMessage,
        });
        alertSent = messageResult !== null;
      }
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
      previousStock: currentItem.currentStock,
      newStock,
      status,
      alertSent,
      alertMessage: alertMessage || null,
    });
  } catch (error) {
    console.error("[inventory/update]", error);
    return NextResponse.json({ error: "Internal server error", success: false }, { status: 500 });
  }
}
