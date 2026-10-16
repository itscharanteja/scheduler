"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  Package,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Search,
  Plus,
  ArrowUpDown,
  RefreshCw,
  Box,
  Layers,
  Sparkles,
} from "lucide-react";

interface InventoryItem {
  id: string;
  locationId: string;
  itemName: string;
  currentStock: number;
  criticalThreshold: number;
  lowThreshold: number;
  unit: string;
  status: "ok" | "low" | "critical";
  lastUpdated?: string;
}

export default function InventoryPage() {
  const { hasRole } = useAuth();
  const { locationId } = useLocation();
  const { lang } = useLanguage();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "ok" | "low" | "critical">("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Restock modal state
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(50);
  const [restockLoading, setRestockLoading] = useState(false);

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/inventory?locationId=${locationId}`);
      if (!res.ok) throw new Error("Failed to fetch inventory");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error("[InventoryPage:fetch]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchInventory, 5000);
    return () => clearInterval(interval);
  }, [locationId]);

  // Connect to SSE for real-time stock depletion ticker
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/sim/stream");
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "inventory" && payload.data) {
            setItems((prev) =>
              prev.map((item) =>
                item.itemName === payload.data.itemName
                  ? {
                      ...item,
                      currentStock: payload.data.currentStock,
                      status: payload.data.status,
                    }
                  : item
              )
            );
          }
        } catch {}
      };
    } catch {}

    return () => {
      eventSource?.close();
    };
  }, []);

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem || restockAmount <= 0) return;
    setRestockLoading(true);

    const newStock = Math.round((restockItem.currentStock + restockAmount) * 100) / 100;

    try {
      const res = await fetch("/api/inventory/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: restockItem.id,
          newStock,
          locationId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Restocked ${restockItem.itemName}`, {
          description: `Added ${restockAmount} ${restockItem.unit}. New level: ${newStock} ${restockItem.unit}.`,
        });
        setItems((prev) =>
          prev.map((i) =>
            i.id === restockItem.id
              ? {
                  ...i,
                  currentStock: newStock,
                  status:
                    newStock <= i.criticalThreshold
                      ? "critical"
                      : newStock <= i.lowThreshold
                      ? "low"
                      : "ok",
                }
              : i
          )
        );
        setRestockItem(null);
      } else {
        toast.error(data.error || "Failed to restock item");
      }
    } catch {
      toast.error("Network error while updating inventory");
    } finally {
      setRestockLoading(false);
    }
  };

  const getCategory = (itemName: string = ""): string => {
    const name = (itemName || "").toLowerCase();
    if (name.includes("beef") || name.includes("chicken") || name.includes("wings") || name.includes("halloumi")) return "meat";
    if (name.includes("bun") || name.includes("wrap") || name.includes("box") || name.includes("cup")) return "bakery_packaging";
    if (name.includes("lettuce") || name.includes("tomato") || name.includes("onion") || name.includes("potato") || name.includes("pickle")) return "produce";
    if (name.includes("sauce") || name.includes("mayo") || name.includes("ketchup") || name.includes("relish") || name.includes("bbq")) return "sauces";
    if (name.includes("cola") || name.includes("soda") || name.includes("ice cream") || name.includes("coffee")) return "beverages";
    return "other";
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const name = item?.itemName || (item as any)?.item_name || (item as any)?.name || "";
      const matchesSearch = name.toLowerCase().includes((searchQuery || "").toLowerCase());
      const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
      const category = getCategory(name);
      const matchesCategory = selectedCategory === "all" || category === selectedCategory;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [items, searchQuery, selectedStatus, selectedCategory]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      ok: items.filter((i) => i.status === "ok").length,
      low: items.filter((i) => i.status === "low").length,
      critical: items.filter((i) => i.status === "critical").length,
    };
  }, [items]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {lang === "sv" ? "Lager- & Råvaruhantering" : "Inventory & Stock Operations"}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              <Sparkles className="w-3.5 h-3.5" />
              {lang === "sv" ? "Receptstyrd förbrukning" : "Recipe Depletion Live"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {lang === "sv"
              ? "Realtidsövervakning av råvaronivåer, automatiska tröskelvarningar och påfyllnadshantering."
              : "Live stock tracking, automated threshold warnings, and instant replenishment connected to sales orders."}
          </p>
        </div>

        <button
          onClick={fetchInventory}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {lang === "sv" ? "Uppdatera" : "Refresh"}
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Spårade Råvaror" : "Total Tracked Items"}
            </span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
            <div className="text-xs text-slate-500 mt-1">Aktiva receptingredienser</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Normal Lagernivå" : "Normal Stock (OK)"}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">{summary.ok}</div>
            <div className="text-xs text-slate-500 mt-1">Över säkerhetströskel</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Varning: Låg Lagernivå" : "Low Stock Alert"}
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600">{summary.low}</div>
            <div className="text-xs text-amber-700 font-medium mt-1">Beställning rekommenderas</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Kritisk Nivå (Akut)" : "Critical Stock"}
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">{summary.critical}</div>
            <div className="text-xs text-rose-700 font-medium mt-1">Risk för slutförsäljning</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={lang === "sv" ? "Sök artikel eller ingrediens..." : "Search ingredients..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: "all", label: lang === "sv" ? "Alla" : "All" },
              { id: "ok", label: "OK" },
              { id: "low", label: lang === "sv" ? "Låg" : "Low" },
              { id: "critical", label: lang === "sv" ? "Kritisk" : "Critical" },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatus === st.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto stroke-1 mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Inga artiklar matchar din sökning.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isCritical = item.status === "critical";
            const isLow = item.status === "low";
            const targetSafeLevel = item.lowThreshold * 2;
            const fillPercent = Math.min(100, Math.round((item.currentStock / targetSafeLevel) * 100));

            return (
              <div
                key={item.id || item.itemName}
                className={`bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
                  isCritical
                    ? "border-rose-300 ring-1 ring-rose-300 bg-rose-50/20"
                    : isLow
                    ? "border-amber-300 bg-amber-50/20"
                    : "border-slate-200/80"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {item.itemName || (item as any).item_name || (item as any).name || "Item"}
                    </h3>
                    <span className="text-[11px] font-mono uppercase text-slate-400">
                      Enhet: {item.unit}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isCritical
                        ? "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse"
                        : isLow
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    }`}
                  >
                    {isCritical ? "Kritisk" : isLow ? "Låg nivå" : "OK"}
                  </span>
                </div>

                {/* Current Stock Meter */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-500 font-medium">Nuvarande lager:</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {item.currentStock} <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      style={{ width: `${fillPercent}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCritical ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                    <span>Kritisk: {item.criticalThreshold} {item.unit}</span>
                    <span>Låg: {item.lowThreshold} {item.unit}</span>
                  </div>
                </div>

                {/* Restock Button */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setRestockItem(item);
                      setRestockAmount(item.unit === "kg" || item.unit === "L" ? 10 : 50);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> {lang === "sv" ? "Fyll på lager" : "Restock"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Restock Modal Dialog */}
      {restockItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Fyll på råvarulager</h3>
                <p className="text-xs text-slate-500">
                  {restockItem.itemName || (restockItem as any).item_name || (restockItem as any).name}
                </p>
              </div>
              <button
                onClick={() => setRestockItem(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Välj mängd att lägga till ({restockItem.unit}):
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[10, 25, 50].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRestockAmount(amt)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        restockAmount === amt
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      +{amt} {restockItem.unit}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Nuvarande nivå:</span>
                  <span className="font-mono font-semibold">{restockItem.currentStock} {restockItem.unit}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Ny beräknad nivå:</span>
                  <span className="font-mono">{Math.round((restockItem.currentStock + restockAmount) * 100) / 100} {restockItem.unit}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={restockLoading}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm disabled:opacity-50"
                >
                  {restockLoading ? "Sparar..." : "Bekräfta påfyllning"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
