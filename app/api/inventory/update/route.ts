/*
  POST /api/inventory/update
  Updates stock level for an inventory item.
  If new stock is below critical threshold
  automatically posts alert to managers
  chat channel.
  Body: { id, newStock, updatedBy, locationId }
*/

import { NextRequest, NextResponse } from "next/server";
import {
  updateInventoryItem,
  getInventory,
  getChannels,
  sendMessage,
} from "@/lib/supabase";
import type { InventoryItem } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { id, newStock, updatedBy, locationId } = body;

    // STEP 1 — Validate request
    if (!id || !updatedBy || !locationId || newStock === undefined) {
      return NextResponse.json(
        {
          error:
            "id, newStock, updatedBy and locationId are required",
        },
        { status: 400 },
      );
    }

    if (typeof newStock !== "number" || newStock < 0) {
      return NextResponse.json(
        {
          error: "newStock must be a number greater than or equal to 0",
        },
        { status: 400 },
      );
    }

    // STEP 2 — Get current item state
    const inventory = await getInventory(locationId);
    const currentItem = inventory.find((item) => item.id === id);

    if (!currentItem) {
      return NextResponse.json(
        { error: "Inventory item not found" },
        { status: 404 },
      );
    }

    const wasAlreadyCritical =
      currentItem.currentStock <= currentItem.criticalThreshold;

    // STEP 3 — Update stock
    const updatedItem = await updateInventoryItem({
      id,
      newStock,
      updatedBy,
    });

    if (!updatedItem) {
      return NextResponse.json(
        { error: "Failed to update stock" },
        { status: 500 },
      );
    }

    // Compute new status
    let status: "ok" | "low" | "critical";
    if (newStock <= currentItem.criticalThreshold) {
      status = "critical";
    } else if (newStock <= currentItem.lowThreshold) {
      status = "low";
    } else {
      status = "ok";
    }

    // STEP 4 — Cross-module trigger
    let alertSent = false;
    let alertMessage: string | null = null;

    const shouldTrigger =
      newStock <= currentItem.criticalThreshold && !wasAlreadyCritical;

    if (shouldTrigger) {
      // Find managers channel
      const channels = await getChannels(locationId);
      const managersChannel = channels.find((c) => c.slug === "managers");

      if (managersChannel) {
        alertMessage =
          `⚠️ STOCK ALERT: ${currentItem.itemName} ` +
          `is critically low — ` +
          `${newStock} ${currentItem.unit} remaining ` +
          `(critical threshold: ` +
          `${currentItem.criticalThreshold} ` +
          `${currentItem.unit}). Please reorder.`;

        const messageResult = await sendMessage({
          channelId: managersChannel.id,
          senderId: updatedBy,
          message: alertMessage,
        });

        alertSent = messageResult !== null;
      } else {
        console.warn("[inventory/update] Managers channel not found");
      }
    }

    // STEP 5 — Return response
    return NextResponse.json(
      {
        success: true,
        item: updatedItem,
        previousStock: currentItem.currentStock,
        newStock,
        status,
        alertSent,
        alertMessage: alertMessage || null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[inventory/update]", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 },
    );
  }
}
