import { LOCATION_ID } from "@/lib/constants";
import { supabaseClient } from "@/lib/supabase/client";
import { MENU_ITEMS, HOURLY_ORDER_RATES } from "./menu-recipes";
import type { MenuItem, SimEvent, SimOrder, SimScenarioName, SimState } from "./types";

interface InventoryState {
  id: string;
  name: string;
  currentStock: number;
  criticalThreshold: number;
  lowThreshold: number;
  unit: string;
  status: "ok" | "low" | "critical";
}

const DEFAULT_INVENTORY: InventoryState[] = [
  { id: "inv-beef", name: "Beef patties", currentStock: 120, criticalThreshold: 20, lowThreshold: 45, unit: "pcs", status: "ok" },
  { id: "inv-buns", name: "Brioche buns", currentStock: 140, criticalThreshold: 25, lowThreshold: 50, unit: "pcs", status: "ok" },
  { id: "inv-cheddar", name: "Cheddar slices", currentStock: 200, criticalThreshold: 30, lowThreshold: 60, unit: "pcs", status: "ok" },
  { id: "inv-chicken", name: "Chicken breasts", currentStock: 60, criticalThreshold: 12, lowThreshold: 25, unit: "pcs", status: "ok" },
  { id: "inv-halloumi", name: "Halloumi portions", currentStock: 40, criticalThreshold: 10, lowThreshold: 20, unit: "pcs", status: "ok" },
  { id: "inv-wings", name: "Chicken wings", currentStock: 180, criticalThreshold: 30, lowThreshold: 60, unit: "pcs", status: "ok" },
  { id: "inv-potatoes", name: "Potatoes", currentStock: 75, criticalThreshold: 15, lowThreshold: 30, unit: "kg", status: "ok" },
  { id: "inv-lettuce", name: "Lettuce", currentStock: 18, criticalThreshold: 3, lowThreshold: 6, unit: "kg", status: "ok" },
  { id: "inv-tomatoes", name: "Tomatoes", currentStock: 22, criticalThreshold: 4, lowThreshold: 8, unit: "kg", status: "ok" },
  { id: "inv-onions", name: "Onions", currentStock: 15, criticalThreshold: 2.5, lowThreshold: 5, unit: "kg", status: "ok" },
  { id: "inv-pickles", name: "Pickles", currentStock: 12, criticalThreshold: 2, lowThreshold: 4, unit: "kg", status: "ok" },
  { id: "inv-house-sauce", name: "House sauce", currentStock: 14, criticalThreshold: 2, lowThreshold: 4, unit: "L", status: "ok" },
  { id: "inv-truffle-mayo", name: "Truffle mayo", currentStock: 8, criticalThreshold: 1.5, lowThreshold: 3, unit: "L", status: "ok" },
  { id: "inv-jalapeno", name: "Jalapeño relish", currentStock: 6, criticalThreshold: 1, lowThreshold: 2, unit: "L", status: "ok" },
  { id: "inv-mayo", name: "Mayonnaise", currentStock: 12, criticalThreshold: 2, lowThreshold: 4, unit: "L", status: "ok" },
  { id: "inv-ketchup", name: "Ketchup", currentStock: 16, criticalThreshold: 3, lowThreshold: 5, unit: "L", status: "ok" },
  { id: "inv-bbq", name: "BBQ sauce", currentStock: 10, criticalThreshold: 2, lowThreshold: 3.5, unit: "L", status: "ok" },
  { id: "inv-cola-syrup", name: "Cola syrup", currentStock: 25, criticalThreshold: 4, lowThreshold: 8, unit: "L", status: "ok" },
  { id: "inv-orange-syrup", name: "Orange soda syrup", currentStock: 20, criticalThreshold: 3, lowThreshold: 6, unit: "L", status: "ok" },
  { id: "inv-ice-cream", name: "Ice cream mix", currentStock: 30, criticalThreshold: 5, lowThreshold: 10, unit: "L", status: "ok" },
  { id: "inv-coffee", name: "Coffee beans", currentStock: 10, criticalThreshold: 1.5, lowThreshold: 3, unit: "kg", status: "ok" },
  { id: "inv-wraps", name: "Burger paper wraps", currentStock: 350, criticalThreshold: 50, lowThreshold: 100, unit: "pcs", status: "ok" },
  { id: "inv-boxes", name: "Packaging boxes", currentStock: 220, criticalThreshold: 35, lowThreshold: 70, unit: "pcs", status: "ok" },
  { id: "inv-cups", name: "Paper cups", currentStock: 280, criticalThreshold: 40, lowThreshold: 80, unit: "pcs", status: "ok" },
];

export class SimulationEngine {
  public locationId: string = LOCATION_ID;
  public currentTime: Date;
  public running: boolean = true;
  public speed: number = 1.0;
  public realSecondsPerSimMinute: number = 2.5; // 2.5 real seconds per sim minute for smooth demo pacing
  
  private rushUntil: Date | null = null;
  private weatherUntil: Date | null = null;
  private orderCounter: number = 1000;
  private subscribers: Set<(event: SimEvent) => void> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  // Daily Sales accumulator (calibrated for 35,000 - 45,000 SEK / day)
  public todayRevenue: number = 0;
  public todayOrders: number = 0;
  public hourlyRevenue: number[] = new Array(24).fill(0);
  public comparisonRevenue: number = 39200;
  
  // Inventory tracking
  public inventory: Map<string, InventoryState> = new Map();
  public topSellingItems: Map<string, { name: string; category: string; count: number; revenue: number }> = new Map();

  constructor() {
    const now = new Date();
    // Default to today at 08:00
    this.currentTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
    this.initInventory();
    this.initPreloadSales();
    this.startClock();
  }

  private initInventory() {
    this.inventory.clear();
    DEFAULT_INVENTORY.forEach((item) => {
      this.inventory.set(item.name, { ...item });
    });
  }

  private initPreloadSales() {
    // Preload morning activity (08:00 - 11:00) calibrated for ~35k-45k daily total
    const hour = this.currentTime.getUTCHours();
    const morningWeights: Record<number, number> = { 8: 650, 9: 950, 10: 1600 };
    for (let h = 8; h < Math.min(hour, 11); h++) {
      const rev = morningWeights[h] || 700;
      this.hourlyRevenue[h] = rev;
      this.todayRevenue += rev;
      this.todayOrders += Math.round(rev / 130);
    }
  }

  public subscribe(callback: (event: SimEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private emit(event: SimEvent) {
    this.subscribers.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error("[simulator:emit]", err);
      }
    });
  }

  public startClock() {
    if (this.timer) clearInterval(this.timer);
    this.running = true;
    const intervalMs = Math.max(100, Math.round((this.realSecondsPerSimMinute * 1000) / this.speed));
    this.timer = setInterval(() => {
      if (this.running && !this.isProcessing) {
        this.tick().catch(console.error);
      }
    }, intervalMs);
  }

  public pause() {
    this.running = false;
    this.emit({
      type: "clock",
      data: {
        currentTime: this.currentTime.toISOString(),
        running: false,
        speed: this.speed,
        scenarios: {
          rushHour: this.isRushActive(),
          weatherSpike: this.isWeatherActive(),
        },
        metrics: this.getStatus().metrics,
      },
    });
  }

  public resume() {
    this.running = true;
    this.startClock();
    this.emit({
      type: "clock",
      data: {
        currentTime: this.currentTime.toISOString(),
        running: true,
        speed: this.speed,
        scenarios: {
          rushHour: this.isRushActive(),
          weatherSpike: this.isWeatherActive(),
        },
        metrics: this.getStatus().metrics,
      },
    });
  }

  public setSpeed(multiplier: number) {
    this.speed = Math.max(0.1, Math.min(50, multiplier));
    this.startClock();
    this.emit({
      type: "clock",
      data: {
        currentTime: this.currentTime.toISOString(),
        running: this.running,
        speed: this.speed,
        scenarios: {
          rushHour: this.isRushActive(),
          weatherSpike: this.isWeatherActive(),
        },
        metrics: this.getStatus().metrics,
      },
    });
  }

  public isRushActive(): boolean {
    return !!(this.rushUntil && this.currentTime < this.rushUntil);
  }

  public isWeatherActive(): boolean {
    return !!(this.weatherUntil && this.currentTime < this.weatherUntil);
  }

  public activateScenario(name: SimScenarioName, durationMinutes = 45) {
    if (name === "rush_hour") {
      this.rushUntil = new Date(this.currentTime.getTime() + durationMinutes * 60000);
      this.emit({
        type: "alert",
        data: {
          id: crypto.randomUUID(),
          tone: "warning",
          title: "🔥 Rush Hour Scenario Triggered",
          message: `Order rate increased by 3.0x for the next ${durationMinutes} simulated minutes.`,
          createdAt: this.currentTime.toISOString(),
        },
      });
    } else if (name === "weather_spike") {
      this.weatherUntil = new Date(this.currentTime.getTime() + durationMinutes * 60000);
      this.emit({
        type: "alert",
        data: {
          id: crypto.randomUUID(),
          tone: "info",
          title: "🌧️ Weather Spike Scenario",
          message: `Sudden rain shower — delivery and pickup volume surged by 1.8x.`,
          createdAt: this.currentTime.toISOString(),
        },
      });
    } else if (name === "stockout") {
      // Force Brioche buns and Beef patties to critical
      const buns = this.inventory.get("Brioche buns");
      if (buns) {
        buns.currentStock = 12;
        buns.status = "critical";
        this.emit({
          type: "alert",
          data: {
            id: crypto.randomUUID(),
            tone: "critical",
            title: "CRITICAL STOCKOUT: Brioche buns",
            message: `Brioche buns dropped to ${buns.currentStock} pcs (critical threshold: ${buns.criticalThreshold}). Restock immediately!`,
            createdAt: this.currentTime.toISOString(),
          },
        });
      }
    } else if (name === "call_out") {
      this.emit({
        type: "activity",
        data: {
          id: crypto.randomUUID(),
          type: "attendance",
          title: "Employee Call-Out / Early Departure",
          detail: `Line Cook clocked out unexpectedly due to illness. Shift leader notified to seek coverage.`,
          timestamp: this.currentTime.toISOString(),
        },
      });
      this.emit({
        type: "alert",
        data: {
          id: crypto.randomUUID(),
          tone: "warning",
          title: "Staffing Alert: Shift Down 1 Staff",
          message: `Mid-shift call-out. Current coverage is below optimal schedule target.`,
          createdAt: this.currentTime.toISOString(),
        },
      });
    }
  }

  public getPeakLabel(): string {
    let peakHour = 12;
    let peakVal = 0;
    this.hourlyRevenue.forEach((val, h) => {
      if (val > peakVal) {
        peakVal = val;
        peakHour = h;
      }
    });
    return `${peakHour.toString().padStart(2, "0")}:00–${(peakHour + 1).toString().padStart(2, "0")}:00`;
  }

  public async reset(): Promise<void> {
    const now = new Date();
    this.currentTime = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
    this.running = true;
    this.speed = 1.0;
    this.rushUntil = null;
    this.weatherUntil = null;
    this.todayRevenue = 0;
    this.todayOrders = 0;
    this.hourlyRevenue = new Array(24).fill(0);
    this.topSellingItems.clear();
    this.initInventory();
    this.initPreloadSales();

    this.emit({
      type: "simulation",
      data: {
        action: "reset",
        currentTime: this.currentTime.toISOString(),
        metrics: this.getStatus().metrics,
      },
    });
    this.startClock();
  }

  public async tick(minutesToAdvance = 1): Promise<SimEvent[]> {
    this.isProcessing = true;
    const generatedEvents: SimEvent[] = [];

    try {
      for (let m = 0; m < minutesToAdvance; m++) {
        const hour = this.currentTime.getUTCHours();
        let multiplier = 1.0;
        if (this.isRushActive()) multiplier *= 3.0;
        if (this.isWeatherActive()) multiplier *= 1.8;

        const baseRate = HOURLY_ORDER_RATES[hour] || 0.1;
        let expectedOrders = baseRate * multiplier;

        // Daily cap enforcement (35,000 - 45,000 SEK max)
        if (this.todayRevenue >= 45000) {
          expectedOrders = 0;
        } else if (this.todayRevenue >= 42000) {
          expectedOrders *= 0.25;
        }

        const orderCount = this.samplePoisson(expectedOrders);

        for (let i = 0; i < orderCount; i++) {
          if (this.todayRevenue < 45000) {
            const order = this.generateOrder();
            if (order) {
              generatedEvents.push({ type: "order", data: order });
              this.emit({ type: "order", data: order });
            }
          }
        }

        // Staffing shift boundary events (at top of hours)
        if (this.currentTime.getUTCMinutes() === 0) {
          const staffingEvent = this.checkStaffingBoundary(hour);
          if (staffingEvent) {
            generatedEvents.push(staffingEvent);
            this.emit(staffingEvent);
          }
        }

        // Advance 1 minute
        this.currentTime = new Date(this.currentTime.getTime() + 60000);

        // Day rollover at midnight (23:59 -> 08:00 next day)
        if (this.currentTime.getUTCHours() === 0 && this.currentTime.getUTCMinutes() === 0) {
          this.currentTime = new Date(Date.UTC(this.currentTime.getUTCFullYear(), this.currentTime.getUTCMonth(), this.currentTime.getUTCDate(), 8, 0, 0));
          this.todayRevenue = 0;
          this.todayOrders = 0;
          this.hourlyRevenue = new Array(24).fill(0);
        }
      }

      // Emit clock tick event with live status metrics
      const clockEvent: SimEvent = {
        type: "clock",
        data: {
          currentTime: this.currentTime.toISOString(),
          running: this.running,
          speed: this.speed,
          scenarios: {
            rushHour: this.isRushActive(),
            weatherSpike: this.isWeatherActive(),
          },
          metrics: this.getStatus().metrics,
        },
      };
      this.emit(clockEvent);
      generatedEvents.push(clockEvent);

      // Asynchronously sync to Supabase (best effort, non-blocking)
      this.syncToSupabase().catch(() => {});
    } finally {
      this.isProcessing = false;
    }

    return generatedEvents;
  }

  private generateOrder(): SimOrder | null {
    if (MENU_ITEMS.length === 0) return null;

    // Pick 1 to 3 items
    const numItems = Math.random() < 0.65 ? 1 : Math.random() < 0.88 ? 2 : 3;
    const selected: MenuItem[] = [];
    for (let i = 0; i < numItems; i++) {
      const idx = Math.floor(Math.random() * MENU_ITEMS.length);
      selected.push(MENU_ITEMS[idx]);
    }

    const orderAmount = selected.reduce((sum, item) => sum + item.price, 0);
    const hour = this.currentTime.getUTCHours();

    this.orderCounter++;
    this.todayRevenue = Math.round((this.todayRevenue + orderAmount) * 100) / 100;
    this.todayOrders += 1;
    this.hourlyRevenue[hour] = Math.round((this.hourlyRevenue[hour] + orderAmount) * 100) / 100;

    // Track top selling items
    selected.forEach((item) => {
      const existing = this.topSellingItems.get(item.name) || {
        name: item.name,
        category: item.category,
        count: 0,
        revenue: 0,
      };
      existing.count += 1;
      existing.revenue += item.price;
      this.topSellingItems.set(item.name, existing);
    });

    // Deplete inventory based on recipes
    selected.forEach((item) => {
      Object.entries(item.recipe).forEach(([ingredientName, qty]) => {
        const inv = this.inventory.get(ingredientName);
        if (inv) {
          const prevStatus = inv.status;
          inv.currentStock = Math.max(0, Math.round((inv.currentStock - qty) * 1000) / 1000);
          
          if (inv.currentStock <= inv.criticalThreshold) {
            inv.status = "critical";
          } else if (inv.currentStock <= inv.lowThreshold) {
            inv.status = "low";
          } else {
            inv.status = "ok";
          }

          if (inv.status !== prevStatus && inv.status !== "ok") {
            this.emit({
              type: "alert",
              data: {
                id: crypto.randomUUID(),
                tone: inv.status === "critical" ? "critical" : "warning",
                title: `${inv.status.toUpperCase()} STOCK: ${inv.name}`,
                message: `${inv.name} is down to ${inv.currentStock} ${inv.unit} (threshold: ${inv.status === "critical" ? inv.criticalThreshold : inv.lowThreshold} ${inv.unit}).`,
                createdAt: this.currentTime.toISOString(),
              },
            });
            this.emit({
              type: "inventory",
              data: {
                itemName: inv.name,
                currentStock: inv.currentStock,
                status: inv.status,
              },
            });
          }
        }
      });
    });

    return {
      id: crypto.randomUUID(),
      locationId: this.locationId,
      timestamp: this.currentTime.toISOString(),
      items: selected.map((s) => s.name),
      amount: orderAmount,
      orderNumber: this.orderCounter,
      todayRevenue: this.todayRevenue,
      todayOrders: this.todayOrders,
      hourlyRevenue: [...this.hourlyRevenue],
      peakLabel: this.getPeakLabel(),
    };
  }

  private checkStaffingBoundary(hour: number): SimEvent | null {
    if (hour === 8) {
      return {
        type: "activity",
        data: {
          id: crypto.randomUUID(),
          type: "attendance",
          title: "Morning Shift Clock-in",
          detail: "Opening team (Shift Leader & 2 Service Staff) clocked in for service preparation.",
          timestamp: this.currentTime.toISOString(),
        },
      };
    } else if (hour === 11) {
      return {
        type: "activity",
        data: {
          id: crypto.randomUUID(),
          type: "attendance",
          title: "Lunch Rush Reinforcement",
          detail: "2 Peak-hour Team Members clocked in for lunch service.",
          timestamp: this.currentTime.toISOString(),
        },
      };
    } else if (hour === 16) {
      return {
        type: "activity",
        data: {
          id: crypto.randomUUID(),
          type: "attendance",
          title: "Evening Shift Handover",
          detail: "Dinner crew clocked in; morning service staff clocked out after shift handover.",
          timestamp: this.currentTime.toISOString(),
        },
      };
    }
    return null;
  }

  private samplePoisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let p = 1.0;
    let k = 0;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  private async syncToSupabase(): Promise<void> {
    if (!supabaseClient) return;
    try {
      const dateStr = this.currentTime.toISOString().split("T")[0];
      const avgOrder = this.todayOrders > 0 ? Math.round((this.todayRevenue / this.todayOrders) * 10) / 10 : 0;
      const laborCost = Math.round(this.todayRevenue * 0.245 * 100) / 100;
      const peakLabel = this.getPeakLabel();

      await supabaseClient
        .from("daily_sales")
        .upsert(
          {
            location_id: this.locationId,
            date: dateStr,
            revenue: this.todayRevenue,
            orders: this.todayOrders,
            average_order_value: avgOrder,
            labor_cost: laborCost,
            comparison_revenue: this.comparisonRevenue,
            peak_label: peakLabel,
            hourly_revenue: this.hourlyRevenue,
          },
          { onConflict: "location_id,date" }
        );
    } catch {
      // Ignored for graceful degradation
    }
  }

  public restockItem(itemName: string, amount: number): boolean {
    const item = this.inventory.get(itemName);
    if (!item) return false;
    item.currentStock = Math.round((item.currentStock + amount) * 1000) / 1000;
    if (item.currentStock > item.lowThreshold) {
      item.status = "ok";
    } else if (item.currentStock > item.criticalThreshold) {
      item.status = "low";
    }
    this.emit({
      type: "inventory",
      data: {
        itemName: item.name,
        currentStock: item.currentStock,
        status: item.status,
      },
    });
    this.emit({
      type: "activity",
      data: {
        id: crypto.randomUUID(),
        type: "stock",
        title: `Restocked: ${item.name}`,
        detail: `Added ${amount} ${item.unit}. New level: ${item.currentStock} ${item.unit}.`,
        timestamp: this.currentTime.toISOString(),
      },
    });
    return true;
  }

  public getStatus(): SimState {
    const avgOrder = this.todayOrders > 0 ? Math.round((this.todayRevenue / this.todayOrders) * 10) / 10 : 0;
    const laborCost = Math.round(this.todayRevenue * 0.245 * 100) / 100;
    const peakLabel = this.getPeakLabel();

    return {
      currentTime: this.currentTime.toISOString(),
      running: this.running,
      speed: this.speed,
      realSecondsPerSimMinute: this.realSecondsPerSimMinute,
      activeScenarios: {
        rushHour: this.isRushActive(),
        weatherSpike: this.isWeatherActive(),
      },
      metrics: {
        todayRevenue: this.todayRevenue,
        todayOrders: this.todayOrders,
        averageOrderValue: avgOrder,
        laborCost,
        peakLabel,
        hourlyRevenue: [...this.hourlyRevenue],
      },
    };
  }
}

// Global Singleton
declare global {
  var __skift_simulator: SimulationEngine | undefined;
}

export function getSimulator(): SimulationEngine {
  if (!globalThis.__skift_simulator) {
    globalThis.__skift_simulator = new SimulationEngine();
  }
  return globalThis.__skift_simulator;
}
