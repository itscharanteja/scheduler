export type SimScenarioName = "rush_hour" | "weather_spike" | "stockout" | "call_out";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: "burgers" | "sides" | "drinks" | "desserts";
  recipe: Record<string, number>; // inventoryItemName -> quantity
}

export interface SimOrder {
  id: string;
  locationId: string;
  timestamp: string;
  items: string[];
  amount: number;
  orderNumber: number;
  todayRevenue?: number;
  todayOrders?: number;
  hourlyRevenue?: number[];
  peakLabel?: string;
}

export interface SimState {
  currentTime: string;
  running: boolean;
  speed: number;
  realSecondsPerSimMinute: number;
  activeScenarios: {
    rushHour: boolean;
    weatherSpike: boolean;
  };
  metrics: {
    todayRevenue: number;
    todayOrders: number;
    averageOrderValue: number;
    laborCost: number;
    peakLabel: string;
    hourlyRevenue: number[];
  };
}

export type SimEvent =
  | { type: "connected"; data: SimState }
  | { type: "order"; data: SimOrder }
  | { type: "alert"; data: { id: string; tone: "warning" | "critical" | "info" | "success"; title: string; message: string; createdAt: string } }
  | { type: "activity"; data: { id: string; employeeId?: string; type: string; title: string; detail: string; timestamp: string } }
  | { type: "clock"; data: { currentTime: string; running: boolean; speed: number; scenarios: { rushHour: boolean; weatherSpike: boolean }; metrics?: SimState["metrics"] } }
  | { type: "inventory"; data: { itemName: string; currentStock: number; status: "ok" | "low" | "critical" } }
  | { type: "simulation"; data: { action: string; currentTime: string; metrics?: SimState["metrics"] } };
