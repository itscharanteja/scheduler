"use client";

import { useMemo, useState } from "react";
import { Download, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { mockSales } from "@/lib/mock-data";

function currency(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalesPage() {
  const { lang } = useLanguage();
  const [range, setRange] = useState("7d");
  const text =
    lang === "sv"
      ? {
          revenue: "Omsättning",
          orders: "Ordrar",
          avgOrder: "Snittköp",
          laborRatio: "Lönekvot",
          hourly: "Timtrend idag",
          compare: "Daglig jämförelse",
          forecast: "Prognos mot utfall",
          export: "Exportera rapport",
        }
      : {
          revenue: "Revenue",
          orders: "Orders",
          avgOrder: "Average order",
          laborRatio: "Labour ratio",
          hourly: "Hourly trend today",
          compare: "Daily comparison",
          forecast: "Forecast vs actual",
          export: "Export report",
        };

  const sales = useMemo(() => {
    if (range === "3d") return mockSales.slice(-3);
    return mockSales.slice(-7);
  }, [range]);

  const today = sales.at(-1)!;
  const weeklyAverage = sales.reduce((sum, day) => sum + day.revenue, 0) / sales.length;
  const maxHourly = Math.max(...today.hourlyRevenue);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="app-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="toolbar-row">
              <Button variant={range === "3d" ? "default" : "outline"} size="sm" onClick={() => setRange("3d")}>
                3D
              </Button>
              <Button variant={range === "7d" ? "default" : "outline"} size="sm" onClick={() => setRange("7d")}>
                7D
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.success("Report export started")}>
              <Download className="h-4 w-4" />
              {text.export}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="metric-label">{text.revenue}</div>
              <div className="metric-value">{currency(today.revenue)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{text.orders}</div>
              <div className="metric-value">{today.orders}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{text.avgOrder}</div>
              <div className="metric-value">{currency(today.averageOrderValue)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{text.laborRatio}</div>
              <div className="metric-value">{((today.laborCost / today.revenue) * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="section-title">{text.hourly}</h3>
              <span className="status-chip status-success">
                <TrendingUp className="h-3.5 w-3.5" />
                {today.peakLabel}
              </span>
            </div>
            <div className="mt-4 grid h-[260px] grid-cols-12 items-end gap-2 md:grid-cols-24">
              {today.hourlyRevenue.map((value, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-blue-600"
                    style={{
                      height: `${Math.max((value / maxHourly) * 180, 12)}px`,
                    }}
                    title={`${index.toString().padStart(2, "0")}:00 • ${currency(value)}`}
                  />
                  <div className="text-[10px] text-slate-500">{index.toString().padStart(2, "0")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="app-panel p-5">
            <h3 className="section-title">{text.forecast}</h3>
            <div className="mt-4 list-block">
              <div className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">Today vs average</div>
                  <div className="list-row-copy">{currency(today.revenue)} vs {currency(weeklyAverage)}</div>
                </div>
                <span className="status-chip status-info">
                  {(((today.revenue - weeklyAverage) / weeklyAverage) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">Peak period</div>
                  <div className="list-row-copy">{today.peakLabel}</div>
                </div>
                <span className="status-chip status-success">Tracked</span>
              </div>
              <div className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">Forecast note</div>
                  <div className="list-row-copy">
                    {lang === "sv"
                      ? "Kvällstrafiken fortsätter över veckosnittet. Behåll extra kapacitet mellan 17 och 20."
                      : "Evening traffic continues above weekly average. Keep extra capacity from 17:00 to 20:00."}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="app-panel p-5">
            <h3 className="section-title">{text.compare}</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="ops-table min-w-[360px]">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>{text.revenue}</th>
                    <th>{text.orders}</th>
                    <th>{text.laborRatio}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((day) => (
                    <tr key={day.id}>
                      <td>{day.date}</td>
                      <td>{currency(day.revenue)}</td>
                      <td>{day.orders}</td>
                      <td>{((day.laborCost / day.revenue) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
