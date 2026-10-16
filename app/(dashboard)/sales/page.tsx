"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Flame,
  CloudRain,
  AlertTriangle,
  UserX,
  TrendingUp,
  ShoppingBag,
  Clock,
  DollarSign,
  Activity,
  Zap,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface SimOrder {
  id: string;
  timestamp: string;
  items: string[];
  amount: number;
  orderNumber: number;
}

interface SimStatus {
  currentTime: string;
  running: boolean;
  speed: number;
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
  topSellingItems?: Array<{ name: string; category: string; count: number; revenue: number }>;
}

export default function SalesPage() {
  const { hasRole } = useAuth();
  const { locationId } = useLocation();
  const { lang } = useLanguage();

  const [status, setStatus] = useState<SimStatus | null>(null);
  const [recentOrders, setRecentOrders] = useState<SimOrder[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Array<{ id: string; tone: string; title: string; message: string; timestamp: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch initial simulator status
  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/sim/status");
      if (!res.ok) throw new Error("Failed to fetch simulation status");
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (err) {
      console.error("[SalesPage:fetchStatus]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Connect to live SSE Stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/sim/stream");

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "connected" && payload.data) {
            setStatus(payload.data);
          } else if (payload.type === "order" && payload.data) {
            setRecentOrders((prev) => [payload.data, ...prev.slice(0, 24)]);
            // Update today revenue with live server metrics
            setStatus((prev) => {
              if (!prev) return prev;
              const orderData = payload.data;
              const newRev =
                typeof orderData.todayRevenue === "number"
                  ? orderData.todayRevenue
                  : Math.round((prev.metrics.todayRevenue + (orderData.amount || 0)) * 100) / 100;
              const newOrders =
                typeof orderData.todayOrders === "number"
                  ? orderData.todayOrders
                  : prev.metrics.todayOrders + 1;
              const newHourly = orderData.hourlyRevenue || [...prev.metrics.hourlyRevenue];
              const peakLabel = orderData.peakLabel || prev.metrics.peakLabel;

              return {
                ...prev,
                metrics: {
                  ...prev.metrics,
                  todayRevenue: newRev,
                  todayOrders: newOrders,
                  averageOrderValue: newOrders > 0 ? Math.round((newRev / newOrders) * 10) / 10 : 0,
                  hourlyRevenue: newHourly,
                  peakLabel,
                },
              };
            });
          } else if (payload.type === "alert" && payload.data) {
            setRecentAlerts((prev) => [payload.data, ...prev.slice(0, 9)]);
            if (payload.data.tone === "critical") {
              toast.error(payload.data.title, { description: payload.data.message });
            } else {
              toast.info(payload.data.title, { description: payload.data.message });
            }
          } else if (payload.type === "clock" && payload.data) {
            setStatus((prev) =>
              prev
                ? {
                    ...prev,
                    currentTime: payload.data.currentTime,
                    running: payload.data.running,
                    speed: payload.data.speed,
                    activeScenarios: payload.data.scenarios,
                    metrics: payload.data.metrics || prev.metrics,
                  }
                : prev
            );
          } else if (payload.type === "simulation" && payload.data?.action === "reset") {
            setRecentOrders([]);
            setRecentAlerts([]);
            if (payload.data.metrics) {
              setStatus((prev) =>
                prev
                  ? {
                      ...prev,
                      currentTime: payload.data.currentTime,
                      metrics: payload.data.metrics,
                    }
                  : prev
              );
            } else {
              fetchStatus();
            }
            toast.success("Simulation reset to 08:00 UTC with initial baseline");
          }
        } catch {}
      };

      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch {}

    return () => {
      eventSource?.close();
    };
  }, []);

  // Simulator Controls
  const togglePlayPause = async () => {
    if (!status) return;
    setActionLoading(true);
    try {
      const endpoint = status.running ? "/api/sim/pause" : "/api/sim/start";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => (prev ? { ...prev, running: data.running } : prev));
        toast.success(status.running ? "Simulation paused" : "Simulation running");
      }
    } catch {
      toast.error("Failed to toggle simulation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSpeedChange = async (speed: number) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/sim/speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiplier: speed }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus((prev) => (prev ? { ...prev, speed } : prev));
        toast.success(`Speed updated to ${speed}x`);
      }
    } catch {
      toast.error("Failed to change speed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/sim/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRecentOrders([]);
        setRecentAlerts([]);
        await fetchStatus();
        toast.success("Simulation reset to opening state");
      }
    } catch {
      toast.error("Failed to reset simulation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdvanceTick = async (minutes: number) => {
    try {
      const res = await fetch("/api/sim/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Advanced +${minutes} minute${minutes > 1 ? "s" : ""}`);
        fetchStatus();
      }
    } catch {
      toast.error("Failed to advance time");
    }
  };

  const handleScenario = async (name: "rush_hour" | "weather_spike" | "stockout" | "call_out") => {
    try {
      const res = await fetch("/api/sim/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, durationMinutes: 45 }),
      });
      const data = await res.json();
      if (data.success) {
        const labels: Record<string, string> = {
          rush_hour: "🔥 Rush Hour Scenario Triggered (3x order volume)",
          weather_spike: "🌧️ Weather Spike Scenario Triggered (1.8x volume)",
          stockout: "⚠️ Stockout Triggered (Buns & Patties critical)",
          call_out: "🏃 Employee Call-out Shortage Triggered",
        };
        toast.success(labels[name] || "Scenario triggered");
        fetchStatus();
      }
    } catch {
      toast.error("Failed to inject scenario");
    }
  };

  const currentHour = useMemo(() => {
    if (!status?.currentTime) return 12;
    return new Date(status.currentTime).getUTCHours();
  }, [status?.currentTime]);

  const maxHourlyRevenue = useMemo(() => {
    if (!status?.metrics?.hourlyRevenue) return 1000;
    return Math.max(1000, ...status.metrics.hourlyRevenue);
  }, [status?.metrics?.hourlyRevenue]);

  const formattedTime = useMemo(() => {
    if (!status?.currentTime) return "08:00:00 UTC";
    const d = new Date(status.currentTime);
    return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  }, [status?.currentTime]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {lang === "sv" ? "Försäljningssimulator & Realtidsanalys" : "Sales Simulator & Live Operations"}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              {lang === "sv" ? "Direktsändning" : "Live QSR Simulator"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {lang === "sv"
              ? "Realtidsgenerering av order, intäkter, receptförbrukning och personalklockning."
              : "Continuous Poisson order engine, real-time revenue tracking, recipe stock depletion, and shift auto-punch."}
          </p>
        </div>

        {/* Live Clock & Quick Status */}
        <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm border border-slate-800">
          <Clock className="w-4 h-4 text-emerald-400" />
          <div className="text-right">
            <div className="text-xs text-slate-400 font-mono">SIMULATED TIME</div>
            <div className="text-sm font-mono font-bold text-emerald-400">{formattedTime}</div>
          </div>
        </div>
      </div>

      {/* Simulator Control Cockpit */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {lang === "sv" ? "Simuleringskontroll" : "Simulation Cockpit"}
            </span>

            {/* Play / Pause Toggle */}
            <button
              onClick={togglePlayPause}
              disabled={actionLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
                status?.running
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {status?.running ? (
                <>
                  <Pause className="w-4 h-4" /> {lang === "sv" ? "Pausa" : "Pause"}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> {lang === "sv" ? "Kör" : "Resume"}
                </>
              )}
            </button>

            {/* Step 1 min */}
            <button
              onClick={() => handleAdvanceTick(1)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-600" /> +1 Min
            </button>

            {/* Step 15 mins */}
            <button
              onClick={() => handleAdvanceTick(15)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            >
              <FastForward className="w-3.5 h-3.5 text-indigo-600" /> +15 Mins
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {lang === "sv" ? "Återställ" : "Reset"}
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Speed:</span>
            {[0.5, 1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  status?.speed === s
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Scenarios Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500 mr-1">
              {lang === "sv" ? "Scenarioinjicering:" : "Inject Scenario:"}
            </span>
            <button
              onClick={() => handleScenario("rush_hour")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                status?.activeScenarios?.rushHour
                  ? "bg-rose-500 text-white border-rose-600 shadow-sm animate-pulse"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              {lang === "sv" ? "Lunch/Middag Rusning (3x)" : "Rush Hour (3x)"}
            </button>
            <button
              onClick={() => handleScenario("weather_spike")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                status?.activeScenarios?.weatherSpike
                  ? "bg-sky-500 text-white border-sky-600 shadow-sm animate-pulse"
                  : "bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200"
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
              {lang === "sv" ? "Vädertopp / Regn (1.8x)" : "Weather Rain Surge (1.8x)"}
            </button>
            <button
              onClick={() => handleScenario("stockout")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {lang === "sv" ? "Tvinga råvarubrist" : "Force Stockout"}
            </button>
            <button
              onClick={() => handleScenario("call_out")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition-colors"
            >
              <UserX className="w-3.5 h-3.5" />
              {lang === "sv" ? "Sjukfrånvaro under skift" : "Employee Call-Out"}
            </button>
          </div>

          {status?.activeScenarios?.rushHour && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
              <Flame className="w-4 h-4 animate-bounce" /> RUSH HOUR ACTIVE (3.0x Volume)
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Revenue */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Dagens Intäkt" : "Today's Revenue"}
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {status?.metrics.todayRevenue.toLocaleString("sv-SE")} <span className="text-sm font-normal text-slate-500">SEK</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <TrendingUp className="w-3.5 h-3.5" /> +8.4% vs förra veckan
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Antal Beställningar" : "Total Orders"}
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {status?.metrics.todayOrders.toLocaleString("sv-SE")}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Snittorder: <span className="font-semibold text-slate-700">{status?.metrics.averageOrderValue} SEK</span>
            </div>
          </div>
        </div>

        {/* Labor Cost Ratio */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Arbetskostnad %" : "Labor Cost %"}
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">24.5%</div>
            <div className="mt-1 text-xs text-emerald-600 font-medium">
              Optimal målzon (22%–26%)
            </div>
          </div>
        </div>

        {/* Peak Volume Hour */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {lang === "sv" ? "Högsta Belastning" : "Peak Volume Window"}
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {status?.metrics.peakLabel || "12:00–13:00"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {lang === "sv" ? "Lunchrusning identifierad" : "Lunch peak detected"}
            </div>
          </div>
        </div>
      </div>

      {/* 24-Hour Hourly Revenue Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {lang === "sv" ? "24-Timmars Omsättningsfördelning" : "24-Hour Revenue Distribution"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === "sv" ? "Intäkter per timme i SEK. Nuvarande simulerad timme markeras i grönt." : "Hourly revenue in SEK. Current simulated hour is highlighted in emerald."}
            </p>
          </div>
          <span className="text-xs font-mono font-medium px-2.5 py-1 bg-slate-100 rounded-md text-slate-600">
            Hour: {currentHour}:00 UTC
          </span>
        </div>

        <div className="pt-6 pb-2">
          <div className="h-44 flex items-end gap-1.5 sm:gap-2">
            {Array.from({ length: 24 }).map((_, hour) => {
              const amount = status?.metrics.hourlyRevenue[hour] || 0;
              const heightPercent = maxHourlyRevenue > 0 ? Math.max(4, Math.min(100, Math.round((amount / maxHourlyRevenue) * 100))) : 4;
              const isCurrent = hour === currentHour;

              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow z-20 whitespace-nowrap">
                    {hour.toString().padStart(2, "0")}:00 • {amount.toLocaleString("sv-SE")} SEK
                  </div>

                  {/* Bar */}
                  <div className="w-full bg-slate-100 rounded-t-sm relative flex items-end h-full">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        isCurrent
                          ? "bg-emerald-500 ring-2 ring-emerald-300 ring-offset-1"
                          : amount > 0
                          ? "bg-indigo-600 hover:bg-indigo-500"
                          : "bg-slate-200"
                      }`}
                    />
                  </div>

                  {/* Hour Label */}
                  <span className={`text-[10px] font-mono ${isCurrent ? "font-bold text-emerald-600" : "text-slate-400"}`}>
                    {hour % 3 === 0 || isCurrent ? hour : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two Column Section: Live Order Ticker & Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Order Ticker */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <h3 className="text-sm font-bold text-slate-900">
                {lang === "sv" ? "Realtids Orderflöde" : "Live Streaming Order Ticker"}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {recentOrders.length} {lang === "sv" ? "nyligen mottagna" : "captured"}
            </span>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
            {recentOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <ShoppingBag className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
                <p className="text-sm font-medium">Väntar på nästa kundorder...</p>
                <p className="text-xs text-slate-400 mt-1">Starta simulatorn eller klicka på &quot;+1 Min&quot; för att skapa order.</p>
              </div>
            ) : (
              recentOrders.map((order) => {
                const timeStr = new Date(order.timestamp).toISOString().substring(11, 19);
                return (
                  <div
                    key={order.id}
                    className="p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/60 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        #{order.orderNumber % 1000}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">
                          {order.items.join(" + ")}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {timeStr} • {order.items.length} {order.items.length === 1 ? "vara" : "varor"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-900 font-mono">
                        +{order.amount} SEK
                      </div>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Klart
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Selling Menu Items */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col h-[460px]">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              {lang === "sv" ? "Bäst Säljande Menyval" : "Top Menu Items Today"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Volym och intäkter per rätt</p>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
            {(!status?.topSellingItems || status.topSellingItems.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <p className="text-xs">Ingen försäljning registrerad ännu.</p>
              </div>
            ) : (
              status.topSellingItems.slice(0, 8).map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{item.name}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{item.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 font-mono">{item.revenue} SEK</div>
                    <div className="text-[10px] text-slate-500">{item.count} st sålda</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
