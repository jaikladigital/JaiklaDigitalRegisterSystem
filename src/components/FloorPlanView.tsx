/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useContext } from "react";
import { Table, ZoneType } from "../types";
import { ZONES, getZoneStyle, getContrastYIQ } from "../data";
import { ConfigContext } from "../ConfigContext";
import { ShoppingCart, Users, X, Sparkles, Plus, Minus, Lock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function FloorPlanView({
  tables,
  cart,
  onSeatToggle,
  onSetSeats,
  onBookWholeTable,
  cartTotals,
  onCheckout,
}: any) {
  const { config, t } = useContext(ConfigContext);
  const activeZones = config.zones || ZONES;

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [autoSeatsCount, setAutoSeatsCount] = useState<number>(() => {
    return (cartTotals?.seats > 0) ? cartTotals.seats : 0;
  });
  const [autoZoneId, setAutoZoneId] = useState<string>("");
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [showBlockTooltip, setShowBlockTooltip] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [showBlockWarning, setShowBlockWarning] = useState<boolean>(true);
  const [showZonePopup, setShowZonePopup] = useState<boolean>(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (config.blockManualSeatSelection) {
      setShowBlockWarning(true);
      const timer = setTimeout(() => {
        setShowBlockWarning(false);
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [config.blockManualSeatSelection]);

  const triggerBlockTooltip = () => {
    setShowBlockTooltip(true);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    // Auto-scroll the sidebar or auto-seat-selector-card into view if on mobile/small screens
    const selectorCard = document.getElementById("auto-seat-selector-card");
    if (selectorCard) {
      selectorCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getDynamicStyles = () => {
    let size = 64;
    let gap = 24;
    let titleFontSize = 16;

    let maxTablesInAnyZone = 0;
    Object.keys(activeZones).forEach((zoneId) => {
      const count = tables.filter((t: any) => t.zoneId === zoneId).length;
      if (count > maxTablesInAnyZone) maxTablesInAnyZone = count;
    });

    if (containerDimensions.width > 0) {
      const cw = containerDimensions.width;

      let targetCols = 8;
      if (cw < 360) targetCols = maxTablesInAnyZone > 15 ? 4 : 3;
      else if (cw < 450) targetCols = maxTablesInAnyZone > 15 ? 5 : 4;
      else if (cw < 600) targetCols = maxTablesInAnyZone > 20 ? 6 : 5;
      else if (cw < 800) targetCols = maxTablesInAnyZone > 30 ? 8 : 6;
      else if (cw < 1024) targetCols = maxTablesInAnyZone > 40 ? 10 : 8;
      else targetCols = maxTablesInAnyZone > 50 ? 12 : 10;

      targetCols = Math.min(targetCols, maxTablesInAnyZone) || 1;

      const usableWidth = cw - (cw < 768 ? 32 : 64);

      const calculatedSize =
        usableWidth / (targetCols + 0.25 * targetCols - 0.25);

      size = Math.min(64, calculatedSize);
      size = Math.max(cw < 400 ? 36 : 40, size);
      gap = Math.max(4, size * 0.25);

      if (cw < 500) titleFontSize = 12;
      else if (cw < 768) titleFontSize = 14;
    }

    return {
      size: `${size}px`,
      gap: `${gap}px`,
      titleFontSize: `${titleFontSize}px`,
      fontSize: `${Math.max(11, size * 0.35)}px`,
      labelFontSize: size < 40 ? "0px" : `${Math.max(9, size * 0.18)}px`,
    };
  };

  const findSingleTableAllocation = (qty: number, zoneId: string, allTables: Table[]) => {
    const zoneTables = allTables.filter(t => t.zoneId === zoneId);
    const candidates = zoneTables.filter(t => {
      const avail = t.seats.filter(s => s.status === 'available');
      return avail.length >= qty;
    });
    
    if (candidates.length === 0) return null;
    
    const sortedCandidates = [...candidates].sort((a, b) => {
      const availA = a.seats.filter(s => s.status === 'available').length;
      const availB = b.seats.filter(s => s.status === 'available').length;
      if (availA !== availB) {
        return availA - availB;
      }
      const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
      const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
      return numA - numB;
    });
    
    const bestTable = sortedCandidates[0];
    const availSeats = bestTable.seats.filter(s => s.status === 'available');
    return {
      tableId: bestTable.id,
      seatIds: availSeats.slice(0, qty).map(s => s.id)
    };
  };

  const findMultiTableAllocation = (qty: number, zoneId: string, allTables: Table[]) => {
    const zoneTables = allTables.filter(t => t.zoneId === zoneId);
    const activeTables = zoneTables.filter(t => t.seats.some(s => s.status === 'available')).map(t => {
      const num = parseInt(t.id.replace(/\D/g, ""), 10) || 0;
      const availSeats = t.seats.filter(s => s.status === 'available');
      return {
        table: t,
        num,
        availSeats,
        availCount: availSeats.length
      };
    });
    
    const totalAvail = activeTables.reduce((sum, t) => sum + t.availCount, 0);
    if (totalAvail < qty) return null;

    let bestCombination: typeof activeTables | null = null;
    let bestScore = Infinity;

    const findCombos = (
      startIndex: number,
      currentCombo: typeof activeTables,
      currentSum: number,
      targetSize: number
    ) => {
      if (currentCombo.length === targetSize) {
        if (currentSum >= qty) {
          const tableNums = currentCombo.map(c => c.num);
          const minNum = Math.min(...tableNums);
          const maxNum = Math.max(...tableNums);
          const maxDistanceSpan = maxNum - minNum;
          const numTables = currentCombo.length;
          
          let sumAdjacentDistances = 0;
          const sortedNums = [...tableNums].sort((a, b) => a - b);
          for (let i = 0; i < sortedNums.length - 1; i++) {
            sumAdjacentDistances += (sortedNums[i+1] - sortedNums[i]);
          }

          const totalAvailInCombo = currentSum;
          const waste = totalAvailInCombo - qty;

          // Score metrics (lower is better):
          // - High weight on maxDistanceSpan to keep tables physically close (ideal is distance <= 1)
          // - Medium weight on numTables to avoid over-splitting across too many tables
          // - Lower weight on sumAdjacentDistances to keep them packed together
          // - Lowest weight on waste to prefer tables with fewer leftover seats
          const score = maxDistanceSpan * 10000 + numTables * 1000 + sumAdjacentDistances * 100 + waste;

          if (score < bestScore) {
            bestScore = score;
            bestCombination = [...currentCombo];
          }
        }
        return;
      }

      for (let i = startIndex; i < activeTables.length; i++) {
        currentCombo.push(activeTables[i]);
        findCombos(i + 1, currentCombo, currentSum + activeTables[i].availCount, targetSize);
        currentCombo.pop();
      }
    };

    // Dynamically calculate max combo size to check.
    // Usually 1-3 is enough, but we allow up to 4 or calculated ceiling to support larger group requests safely.
    const maxK = Math.min(Math.max(4, Math.ceil(qty / 5)), activeTables.length);
    for (let k = 1; k <= maxK; k++) {
      findCombos(0, [], 0, k);
      // Prune / early exit if we found a perfect adjacent pair (distance span = 1, 2 tables)
      if (bestScore <= 12000) {
        break;
      }
    }

    if (!bestCombination) {
      return null;
    }

    // Sort chosen combination by available seats descending to fill tables with the most availability first
    const sortedCombo = [...bestCombination].sort((a, b) => b.availCount - a.availCount);
    
    let remaining = qty;
    const plan: { tableId: string; seatIds: number[] }[] = [];
    for (const item of sortedCombo) {
      if (remaining <= 0) break;
      const take = Math.min(item.availCount, remaining);
      plan.push({
        tableId: item.table.id,
        seatIds: item.availSeats.slice(0, take).map(s => s.id)
      });
      remaining -= take;
    }

    return remaining === 0 ? plan : null;
  };

  const getAutoSeatAllocation = (qty: number, zoneId: string) => {
    const sortedZoneIds = Object.keys(activeZones).sort((a, b) => {
      return (activeZones[a]?.layoutOrder || 0) - (activeZones[b]?.layoutOrder || 0);
    });

    if (zoneId !== "all") {
      const single = findSingleTableAllocation(qty, zoneId, tables);
      if (single) return [single];
      return findMultiTableAllocation(qty, zoneId, tables);
    }

    for (const zid of sortedZoneIds) {
      const single = findSingleTableAllocation(qty, zid, tables);
      if (single) return [single];
    }

    for (const zid of sortedZoneIds) {
      const multi = findMultiTableAllocation(qty, zid, tables);
      if (multi) return multi;
    }

    let remaining = qty;
    const plan: { tableId: string; seatIds: number[] }[] = [];
    
    const sortedTables: Table[] = [];
    for (const zid of sortedZoneIds) {
      const zoneTables = tables.filter((t: any) => t.zoneId === zid);
      const activeZoneTables = zoneTables.filter((t: any) => t.seats.some((s: any) => s.status === 'available'));
      activeZoneTables.sort((a: any, b: any) => {
        const availA = a.seats.filter((s: any) => s.status === 'available').length;
        const availB = b.seats.filter((s: any) => s.status === 'available').length;
        if (availA !== availB) return availA - availB;
        const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
        return numA - numB;
      });
      sortedTables.push(...activeZoneTables);
    }

    for (const t of sortedTables) {
      if (remaining <= 0) break;
      const avail = t.seats.filter((s: any) => s.status === 'available');
      if (avail.length > 0) {
        const take = Math.min(avail.length, remaining);
        plan.push({
          tableId: t.id,
          seatIds: avail.slice(0, take).map((s: any) => s.id)
        });
        remaining -= take;
      }
    }

    return remaining === 0 ? plan : null;
  };

  const applyAutoAllocation = (qty: number, zoneId: string) => {
    if (qty <= 0) {
      setAllocationError(null);
      cart.forEach((item: any) => {
        onSetSeats(item.tableId, []);
      });
      return;
    }
    const plan = getAutoSeatAllocation(qty, zoneId);
    if (!plan || plan.length === 0) {
      setAllocationError(t("ขออภัย! ไม่พบจำนวนที่นั่งว่างที่เพียงพอในเงื่อนไขดังกล่าว กรุณาลองลดจำนวนที่นั่งหรือเปลี่ยนโซน"));
      // Clear current cart so user doesn't get confused about what's selected
      cart.forEach((item: any) => {
        onSetSeats(item.tableId, []);
      });
      return;
    }

    setAllocationError(null);

    // Clear current cart first
    cart.forEach((item: any) => {
      onSetSeats(item.tableId, []);
    });

    // Set recommended seats
    plan.forEach((item: any) => {
      onSetSeats(item.tableId, item.seatIds);
    });
  };

  const handleClearAllSelections = () => {
    setAutoSeatsCount(0);
    setAllocationError(null);
    cart.forEach((item: any) => {
      onSetSeats(item.tableId, []);
    });
  };

  const hasAllocatedInitial = React.useRef(false);

  // 1. Initial allocation on mount once tables are loaded (if cart is empty)
  React.useEffect(() => {
    if (config.blockManualSeatSelection && tables.length > 0 && !hasAllocatedInitial.current) {
      hasAllocatedInitial.current = true;
      if (cart.length === 0 && autoZoneId !== "" && autoZoneId !== "all") {
        applyAutoAllocation(autoSeatsCount, autoZoneId);
      }
    }
  }, [tables.length, config.blockManualSeatSelection]);

  const dynStyles = getDynamicStyles();

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100vh-8rem)]">
      {/* Map Area */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px] lg:min-h-0">
        <div className="p-3 md:p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <h2 className="font-bold text-base md:text-lg whitespace-nowrap">
            {t("ผังที่นั่ง (Seat Map)")}
          </h2>
          <div className="flex flex-wrap gap-2 md:gap-4 text-[10px] md:text-xs font-medium">
            {Object.keys(activeZones)
              .sort(
                (a, b) =>
                  (activeZones[a]?.layoutOrder || 0) -
                  (activeZones[b]?.layoutOrder || 0),
              )
              .map((zoneId: any) => {
                const zone = activeZones[zoneId as ZoneType];
                if (!zone) return null;
                return (
                  <div
                    key={zone.id}
                    className="flex items-center gap-1 md:gap-1.5 min-w-fit"
                  >
                    <div
                      className="w-2 h-2 md:w-3 md:h-3 rounded-full border border-slate-300"
                      style={{ backgroundColor: zone.color }}
                    />
                    <span>{zone.name}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {autoSeatsCount > 0 && (
          <div className="bg-indigo-50/75 border-b border-indigo-100/40 px-3 md:px-4 py-2 text-[11px] md:text-xs text-indigo-950 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
            <span>
              {t("แผนผังแนะนำการเลือกโต๊ะที่ว่างอย่างน้อย")} <strong className="text-indigo-700 font-black text-sm">{autoSeatsCount}</strong> {t("ที่นั่ง เพื่อความสะดวกในการนั่งรวมโต๊ะเดียวกัน")}
            </span>
          </div>
        )}

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-8 relative bg-slate-50/50"
        >
          <div className="w-full flex flex-col items-center gap-6 md:gap-10 pb-4">
            {/* Stage */}
            <div className="w-4/5 md:w-1/2 h-10 md:h-16 bg-slate-800 text-white flex items-center justify-center rounded-xl shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-50" />
              <span className="font-bold tracking-widest text-sm md:text-lg relative z-10">
                {t("เวที (STAGE)")}
              </span>
            </div>

            {/* Zones grouped by layoutOrder */}
            {(() => {
              // Group zones by layoutOrder
              const grouped: Record<number, string[]> = {};
              let unassignedIndex = 1000;
              Object.keys(activeZones).forEach((zoneId, idx) => {
                const z = activeZones[zoneId as ZoneType];
                if (!z) return;
                // If layoutOrder is 0 or undefined, and position is center, we auto-assign order to preserve old vertical layout
                let order = z.layoutOrder;
                if (
                  !order &&
                  (!z.layoutPosition || z.layoutPosition === "center")
                ) {
                  order = unassignedIndex + idx;
                } else {
                  order = order || 0;
                }

                if (!grouped[order]) grouped[order] = [];
                grouped[order].push(zoneId);
              });

              // Sort orders
              const sortedOrders = Object.keys(grouped)
                .map(Number)
                .sort((a, b) => a - b);

              return sortedOrders.map((order) => {
                const zoneIds = grouped[order];
                // Sort within the group: left_wing -> center -> right_wing
                zoneIds.sort((a, b) => {
                  const pa =
                    activeZones[a as ZoneType]?.layoutPosition || "center";
                  const pb =
                    activeZones[b as ZoneType]?.layoutPosition || "center";
                  const weight = { left_wing: 1, center: 2, right_wing: 3 };
                  return (
                    (weight[pa as keyof typeof weight] || 2) -
                    (weight[pb as keyof typeof weight] || 2)
                  );
                });

                return (
                  <div
                    key={`order-${order}`}
                    className="flex justify-center w-full gap-4 md:gap-8 flex-wrap lg:flex-nowrap"
                  >
                    {zoneIds.map((zoneId) => {
                      const zone = activeZones[zoneId as ZoneType];
                      if (!zone) return null;
                      const zoneTables = tables.filter(
                        (t: any) => t.zoneId === zoneId,
                      );
                      if (zoneTables.length === 0) return null;

                      const priceText = config.isTicketFree
                        ? "0฿"
                        : `${zone.pricePerSeat.toLocaleString()}฿`;

                      return (
                        <div key={zoneId} className="flex-1 min-w-[260px]">
                          <ZoneGrid
                            tables={zoneTables}
                            onSelectTable={(table: any) => {
                              if (config.blockManualSeatSelection) {
                                triggerBlockTooltip();
                                return;
                              }
                              setSelectedTable(table);
                            }}
                            cart={cart}
                            title={`${zone.name} : ${priceText} / ${t("ที่นั่ง")}`}
                            dynStyles={dynStyles}
                            highlightSeatsCount={autoSeatsCount}
                            isBlocked={!!config.blockManualSeatSelection}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Cart Summary */}
      <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:h-full shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-700" />
            <h2 className="font-bold text-base">{t("รายการที่เลือก")}</h2>
          </div>
          {cart.length > 0 && (
            <button
              onClick={handleClearAllSelections}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold transition-colors underline decoration-dotted decoration-1 underline-offset-4"
            >
              {t("ล้างทั้งหมด")}
            </button>
          )}
        </div>
        <div className="flex-1 p-4 overflow-x-auto lg:overflow-y-auto max-h-[250px] lg:max-h-full">
          {/* Smart Auto Seat Selection */}
          <motion.div
            id="auto-seat-selector-card"
            animate={isShaking ? { x: [-6, 6, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="mb-4 p-3 rounded-xl bg-indigo-50/40 border border-indigo-100/80 relative"
          >
            <AnimatePresence>
              {config.blockManualSeatSelection && showBlockWarning && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm relative"
                >
                  <button
                    type="button"
                    onClick={() => setShowBlockWarning(false)}
                    className="absolute top-2 right-2 text-amber-500 hover:text-amber-800 hover:bg-amber-100/60 p-0.5 rounded-full transition-colors"
                    title="ปิดคำแนะนำ"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start gap-2 pr-4">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-3 h-3 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-amber-800 text-xs font-sans">
                        ระบบล็อกการเลือกที่นั่งด้วยตนเอง
                      </h4>
                      <p className="text-[11px] text-amber-700 leading-relaxed font-sans mt-0.5">
                        กรุณาระบุจำนวนที่นั่งและโซนที่ต้องการ เพื่อให้ระบบค้นหาและเลือกจัดสรรให้โดยอัตโนมัติ
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-sm text-indigo-900 tracking-wide uppercase">
                {t("จัดสรรที่นั่งอัตโนมัติ")}
              </h3>
            </div>
            
            <div className="space-y-3">
              {/* Seat Qty */}
              <div className="flex flex-col gap-3 bg-white/60 p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="font-bold text-slate-800 text-base sm:text-lg whitespace-nowrap">{t("ระบุจำนวนที่นั่ง")}:</span>
                <div className={`flex items-center w-full border-2 rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${config.blockManualSeatSelection && autoSeatsCount === 0 ? 'border-indigo-500 ring-4 ring-indigo-500/20 animate-pulse bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 bg-white'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = Math.max(0, autoSeatsCount - 1);
                      setAutoSeatsCount(nextVal);
                      if (nextVal === 0) {
                        applyAutoAllocation(0, autoZoneId);
                      } else if (autoZoneId !== "" && autoZoneId !== "all") {
                        applyAutoAllocation(nextVal, autoZoneId);
                      }
                      setShowBlockWarning(false);
                    }}
                    className={`flex-1 flex justify-center items-center py-3 sm:py-4 font-bold transition-all text-lg ${autoSeatsCount === 0 ? "text-slate-300 hover:bg-transparent cursor-not-allowed" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                    disabled={autoSeatsCount === 0}
                  >
                    <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={autoSeatsCount === 0 ? "0" : (autoSeatsCount || "")}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const nextVal = !isNaN(val) ? val : 0;
                      setAutoSeatsCount(nextVal);
                      if (nextVal === 0) {
                        applyAutoAllocation(0, autoZoneId);
                      } else if (autoZoneId !== "" && autoZoneId !== "all") {
                        applyAutoAllocation(nextVal, autoZoneId);
                      }
                      setShowBlockWarning(false);
                    }}
                    onBlur={() => {
                      if (autoSeatsCount < 0) {
                        setAutoSeatsCount(0);
                        applyAutoAllocation(0, autoZoneId);
                      } else if (autoZoneId !== "" && autoZoneId !== "all" && autoSeatsCount > 0) {
                        applyAutoAllocation(autoSeatsCount, autoZoneId);
                      }
                    }}
                    className={`w-16 sm:w-24 text-center text-xl sm:text-3xl font-black bg-transparent border-none focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors duration-300 ${autoSeatsCount === 0 ? "text-slate-400" : "text-slate-900"}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = autoSeatsCount + 1;
                      setAutoSeatsCount(nextVal);
                      if (autoZoneId !== "" && autoZoneId !== "all") {
                        applyAutoAllocation(nextVal, autoZoneId);
                      }
                      setShowBlockWarning(false);
                    }}
                    className="flex-1 flex justify-center items-center py-3 sm:py-4 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold transition-all text-lg"
                  >
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Zone Filter */}
              <div className="flex flex-col gap-3 bg-white/60 p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm">
                <span className="font-bold text-slate-800 text-base sm:text-lg whitespace-nowrap">{t("ระบุโซน")}:</span>
                <select
                  value={autoZoneId}
                  onChange={(e) => {
                    const nextZoneId = e.target.value;
                    setAutoZoneId(nextZoneId);
                    setShowBlockWarning(false);
                    if (nextZoneId !== "" && nextZoneId !== "all" && autoSeatsCount > 0) {
                      applyAutoAllocation(autoSeatsCount, nextZoneId);
                    } else if (nextZoneId === "" || nextZoneId === "all") {
                      applyAutoAllocation(0, nextZoneId);
                    }
                  }}
                  className="w-full font-bold text-slate-800 bg-white border-2 border-slate-200 rounded-xl px-3 sm:px-4 py-3 sm:py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base sm:text-lg shadow-sm"
                >
                  <option value="" disabled>✨ {t("กรุณาระบุโซน (Please select a zone)")}</option>
                  <option value="all">✨ {t("แนะนำทุกโซน (Any Zone)")}</option>
                  {Object.keys(activeZones)
                    .sort((a, b) => (activeZones[a]?.layoutOrder || 0) - (activeZones[b]?.layoutOrder || 0))
                    .map((zoneId) => {
                      const zone = activeZones[zoneId];
                      if (!zone) return null;
                      return (
                        <option key={zoneId} value={zoneId}>
                          {zone.name}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Find Seats Action Button */}
              <button
                onClick={() => {
                  if (autoZoneId === "" || autoZoneId === "all") {
                    setShowZonePopup(true);
                    return;
                  }
                  applyAutoAllocation(autoSeatsCount, autoZoneId);
                }}
                disabled={autoSeatsCount === 0}
                className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg shadow-sm transition-all flex items-center justify-center gap-2 ${
                  autoSeatsCount > 0
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Sparkles className="w-5 h-5" />
                {t("ค้นหาที่นั่งว่างที่ดีที่สุด")}
              </button>

              {/* Real-time feedback status */}
              {allocationError ? (
                <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px] leading-normal font-medium">
                  {allocationError}
                </div>
              ) : autoSeatsCount > 0 && cart.length > 0 ? (
                <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[11px] flex items-center gap-1.5 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>ระบบจัดสรรและเลือกที่นั่งว่างที่ดีที่สุดให้โดยอัตโนมัติแล้ว</span>
                </div>
              ) : null}
            </div>
          </motion.div>

          {cart.length === 0 ? (
            <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-slate-400 space-y-2">
              <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 opacity-20" />
              <p className="text-sm">{t("ยังไม่ได้เลือกที่นั่ง")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item: any) => {
                const table = tables.find((t: any) => t.id === item.tableId);
                const zone = table
                  ? activeZones[table.zoneId as ZoneType]
                  : undefined;
                return (
                  <div
                    key={item.tableId}
                    className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-shrink-0 lg:flex-shrink"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-slate-800">
                          {t("โต๊ะ")} {item.tableId}
                        </span>
                        <span className="text-xs ml-2 text-slate-500">
                          {zone?.name || "Unknown"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {item.seatIds.map((sid: number) => (
                        <div
                          key={sid}
                          className="relative text-xs pl-2 pr-5 py-1 rounded-md font-bold text-slate-800 border shadow-sm flex items-center"
                          style={{
                            backgroundColor: zone?.color || "#cbd5e1",
                            opacity: 0.8,
                            borderColor: zone?.color || "#cbd5e1",
                          }}
                        >
                          <span>
                            {t("ที่นั่ง")} {sid}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeatToggle(item.tableId, sid);
                              if (config.blockManualSeatSelection) {
                                setAutoSeatsCount(prev => Math.max(0, prev - 1));
                              }
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-600 hover:scale-110 transition-all shadow-sm"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl sticky bottom-16 md:bottom-0 z-10">
          <div className="flex justify-between text-sm mb-2 text-slate-600">
            <span>{t("จำนวน")}:</span>
            <span className="font-medium">
              {cartTotals.seats} {t("ที่นั่ง")}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold mb-4">
            <span>{t("ยอดชำระ")}:</span>
            <span className="text-primary">
              ฿{cartTotals.price.toLocaleString()}
            </span>
          </div>
          <button
            disabled={cartTotals.seats === 0}
            onClick={onCheckout}
            className="w-full bg-accent hover:bg-accent-hover disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold tracking-wide transition-colors shadow-sm"
          >
            {t("ดำเนินการชำระเงิน")}
          </button>
        </div>
      </div>

      {/* Table Modal */}
      <AnimatePresence>
        {selectedTable && (
          <TableModal
            table={selectedTable}
            cart={cart}
            onClose={() => setSelectedTable(null)}
            onSeatToggle={onSeatToggle}
            onSetSeats={onSetSeats}
            onBookWholeTable={onBookWholeTable}
          />
        )}
      </AnimatePresence>

      {/* Zone Alert Popup */}
      <AnimatePresence>
        {showZonePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-rose-50 text-rose-600 p-6 flex flex-col items-center text-center">
                <div className="bg-white rounded-full p-3 mb-4 shadow-sm text-rose-500">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {t("กรุณาระบุโซนที่ต้องการ")}
                </h3>
                <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                  {t("โปรดระบุโซนที่คุณต้องการก่อนทำการค้นหาที่นั่ง เพื่อให้ระบบจัดสรรที่นั่งที่ตรงกับความต้องการของคุณมากที่สุด")}
                </p>
                <button
                  onClick={() => setShowZonePopup(false)}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-sm"
                >
                  {t("เข้าใจแล้ว")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ZoneGrid({ tables, onSelectTable, cart, title, dynStyles, highlightSeatsCount = 0, isBlocked = false }: any) {
  const { config } = React.useContext(ConfigContext);
  const activeZones = config?.zones || ZONES;

  const zoneForTitle =
    tables.length > 0 ? activeZones[tables[0].zoneId as ZoneType] : null;

  const getPastelColor = (hex: string) => {
    if (!hex) return "transparent";
    if (hex.startsWith("#")) {
      return `${hex}18`; // ~10% opacity for elegant, eye-pleasing background
    }
    return hex;
  };

  return (
    <div className="w-full">
      <div
        className="text-center mb-4 md:mb-6 uppercase tracking-widest font-bold"
        style={{
          fontSize: dynStyles?.titleFontSize || "16px",
          color: zoneForTitle ? zoneForTitle.color : undefined,
        }}
      >
        {title}
      </div>
      <div
        className="flex flex-wrap justify-center"
        style={{ gap: dynStyles?.gap || "24px" }}
      >
        {tables.map((table: Table) => {
          const zone = activeZones[table.zoneId as ZoneType] || {
            color: "#cbd5e1",
          };
          const availableSeats = table.seats.filter(
            (s) => s.status === "available",
          ).length;
          const isFull = availableSeats === 0;

          // Check if this table has any seats selected in the cart
          const tableCart = cart?.find((c: any) => c.tableId === table.id);
          const hasSelectedSeats = tableCart && tableCart.seatIds.length > 0;

          // Determine if the table can fit the requested seats
          const canFitGroup = highlightSeatsCount > 0 && availableSeats >= highlightSeatsCount;
          const isTooSmallForGroup = highlightSeatsCount > 0 && availableSeats < highlightSeatsCount;

          return (
            <button
              key={table.id}
              onClick={() => onSelectTable(table)}
              className={`relative flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300 hover:scale-110 shadow-sm
                ${isFull && !hasSelectedSeats ? "bg-slate-50 border-slate-200 opacity-55 cursor-not-allowed" : ""}
                ${!isFull && isTooSmallForGroup && !hasSelectedSeats ? "opacity-35 scale-95 border-dashed" : ""}
                ${canFitGroup && !isFull && !hasSelectedSeats ? "ring-4 ring-indigo-500/40 ring-offset-1 border-dashed scale-105 shadow-md" : ""}
                ${hasSelectedSeats ? `ring-4 ring-offset-2` : ""}
              `}
              style={{
                width: dynStyles?.size || "64px",
                height: dynStyles?.size || "64px",
                minWidth: dynStyles?.size || "64px",
                minHeight: dynStyles?.size || "64px",
                backgroundColor: hasSelectedSeats
                  ? zone.color
                  : (!isFull ? getPastelColor(zone.color) : undefined),
                borderColor:
                  !isFull || hasSelectedSeats ? zone.color : undefined,
                color: hasSelectedSeats
                  ? getContrastYIQ(zone.color as string)
                  : (isFull ? "#94a3b8" : "#0f172a"),
              }}
            >
              {isBlocked && (
                <span className="absolute -top-1 -left-1 bg-slate-600/95 text-white rounded-full p-0.5 shadow-sm z-10 scale-90 border border-slate-500">
                  <Lock className="w-2.5 h-2.5" />
                </span>
              )}
              {canFitGroup && !isFull && !hasSelectedSeats && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm animate-bounce z-10">
                  <Sparkles className="w-2.5 h-2.5" />
                </span>
              )}
              {isFull && !hasSelectedSeats && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full px-1 py-0.5 text-[8px] font-black shadow-md animate-pulse z-10 font-sans tracking-wide border border-white flex items-center gap-0.5">
                  <span className="w-1 h-1 bg-white rounded-full animate-ping shrink-0" />
                  เต็ม
                </span>
              )}
              <span
                className="font-black font-sans"
                style={{
                  fontSize: dynStyles?.fontSize || "14px",
                  lineHeight: 1,
                }}
              >
                {table.id}
              </span>
              {dynStyles?.labelFontSize !== "0px" && (
                <span
                  className="mt-0.5 font-bold font-sans"
                  style={{
                    fontSize: dynStyles?.labelFontSize || "10px",
                    lineHeight: 1,
                    color: hasSelectedSeats
                      ? getContrastYIQ(zone.color as string)
                      : (isFull ? "rgba(148, 163, 184, 0.7)" : "rgba(71, 85, 105, 0.8)"),
                  }}
                >
                  {hasSelectedSeats
                    ? `${tableCart.seatIds.length} เลือก`
                    : `${availableSeats}/${table.seats.length}`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TableModal({
  table,
  cart,
  onClose,
  onSeatToggle,
  onSetSeats,
  onBookWholeTable,
}: any) {
  const { config } = React.useContext(ConfigContext);
  const activeZones = config?.zones || ZONES;

  const zone = activeZones[table.zoneId as ZoneType];
  const tableCart = cart.find((c: any) => c.tableId === table.id);
  const selectedSeatIds = tableCart?.seatIds || [];

  const availableSeats = table.seats
    .filter((s: any) => s.status === "available")
    .map((s: any) => s.id);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-10"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>

        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-slate-800">โต๊ะ {table.id}</h3>
          <p className="text-slate-500">
            {zone.name} •{" "}
            {config.isTicketFree
              ? "เหมาบัตรฟรี (0฿)"
              : `฿${zone.pricePerSeat.toLocaleString()} / ที่นั่ง`}
          </p>
        </div>

        {/* Layout representation */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          {(() => {
            const layout = config.layoutStyle || "banquet";
            const numSeats = table.seats.length;

            const renderSeats = (
              coordFn: (i: number) => { x: number; y: number },
            ) => {
              return table.seats.map((seat: any, i: number) => {
                const { x, y } = coordFn(i);
                const isSelected = selectedSeatIds.includes(seat.id);
                const isAvailable = seat.status === "available";
                return (
                  <button
                    key={seat.id}
                    disabled={!isAvailable}
                    onClick={() => onSeatToggle(table.id, seat.id)}
                    style={{
                      left: x,
                      top: y,
                      transform: "translate(-50%, -50%)",
                    }}
                    className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shadow-sm z-10
                        ${
                          !isAvailable
                            ? "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed"
                            : isSelected
                              ? "bg-slate-800 border-slate-800 text-white scale-110 shadow-md ring-4 ring-slate-800/20"
                              : "bg-white border-slate-300 hover:border-slate-800 hover:text-slate-800 text-slate-600"
                        }
                      `}
                  >
                    {seat.id}
                  </button>
                );
              });
            };

            if (layout === "banquet") {
              return (
                <>
                  <div
                    className="absolute inset-8 rounded-full border-4 flex items-center justify-center"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  >
                    <span className="font-bold text-2xl opacity-20">T</span>
                  </div>
                  {renderSeats((i) => {
                    const angle = i * (360 / numSeats) * (Math.PI / 180);
                    const radius = 110;
                    return {
                      x: 128 + radius * Math.sin(angle),
                      y: 128 - radius * Math.cos(angle),
                    };
                  })}
                </>
              );
            }
            if (layout === "cabaret") {
              return (
                <>
                  <div
                    className="absolute inset-8 rounded-full border-4 flex items-center justify-center"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  {renderSeats((i) => {
                    const angle = -Math.PI / 2 + (i / (numSeats - 1)) * Math.PI; // top half semi circle -90 to +90
                    const radius = 110;
                    return {
                      x: 128 + radius * Math.sin(angle),
                      y: 128 - radius * Math.cos(angle),
                    };
                  })}
                </>
              );
            }
            if (layout === "theatre") {
              return renderSeats((i) => {
                const row = Math.floor(i / 5);
                const col = i % 5;
                return { x: 128 + (col - 2) * 50, y: 100 + row * 60 };
              });
            }
            if (layout === "classroom") {
              return (
                <>
                  <div
                    className="absolute top-[44px] left-6 right-6 h-10 rounded border-2"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  <div
                    className="absolute top-[148px] left-6 right-6 h-10 rounded border-2"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  {renderSeats((i) => {
                    const row = Math.floor(i / 5);
                    const col = i % 5;
                    return { x: 128 + (col - 2) * 50, y: row === 0 ? 110 : 214 };
                  })}
                </>
              );
            }
            if (layout === "boardroom") {
              return (
                <>
                  <div
                    className="absolute inset-y-12 left-[80px] right-[80px] rounded-lg border-4"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  {renderSeats((i) => {
                    if (i === 0) return { x: 128, y: 24 }; // top
                    if (i === 5) return { x: 128, y: 232 }; // bottom
                    const isLeft = i < 5;
                    const idx = isLeft ? i - 1 : i - 6; // 0 to 3
                    return { x: isLeft ? 50 : 206, y: 70 + idx * 40 };
                  })}
                </>
              );
            }
            if (layout === "u-shape") {
              return (
                <>
                  <div
                    className="absolute top-10 bottom-16 left-[56px] right-[56px] border-[24px] border-t-0 rounded-b-xl"
                    style={{
                      background: "transparent",
                      borderColor: zone.color,
                      opacity: 0.8,
                    }}
                  ></div>
                  {renderSeats((i) => {
                    if (i < 4) return { x: 24, y: 60 + i * 40 }; // left
                    if (i >= 4 && i < 8)
                      return { x: 232, y: 60 + (i - 4) * 40 }; // right
                    return { x: 128 + (i - 8 === 0 ? -30 : 30), y: 226 }; // bottom
                  })}
                </>
              );
            }
            if (layout === "chevron") {
              return (
                <>
                  <div
                    className="absolute top-[44px] left-2 w-[110px] h-8 rounded border-2 rotate-[20deg]"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  <div
                    className="absolute top-[44px] right-2 w-[110px] h-8 rounded border-2 -rotate-[20deg]"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  <div
                    className="absolute top-[148px] left-2 w-[110px] h-8 rounded border-2 rotate-[20deg]"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  <div
                    className="absolute top-[148px] right-2 w-[110px] h-8 rounded border-2 -rotate-[20deg]"
                    style={{
                      backgroundColor: zone.color,
                      opacity: 0.8,
                      borderColor: zone.color,
                    }}
                  ></div>
                  {renderSeats((i) => {
                    const side = i < 5 ? "left" : "right";
                    const idx = i < 5 ? i : i - 5;
                    const isRow1 = idx < 3;
                    const rowIdx = isRow1 ? idx : idx - 3;
                    const yBase = isRow1 ? 88 : 192;
                    if (side === "left") {
                      return { x: 30 + rowIdx * 40, y: yBase + rowIdx * 15 };
                    } else {
                      return { x: 226 - rowIdx * 40, y: yBase + rowIdx * 15 };
                    }
                  })}
                </>
              );
            }
            if (layout === "circle-of-chairs") {
              return renderSeats((i) => {
                const angle = i * (360 / numSeats) * (Math.PI / 180);
                return {
                  x: 128 + 110 * Math.sin(angle),
                  y: 128 - 110 * Math.cos(angle),
                };
              });
            }

            return null;
          })()}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-3 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
            <label className="text-sm font-bold text-slate-700 ml-2 whitespace-nowrap">
              เลือกด่วน:
            </label>
            <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
              {[...Array(availableSeats.length)].map((_, idx) => {
                const num = idx + 1;
                return (
                  <button
                    key={num}
                    onClick={() => {
                      // Select new N seats
                      const seatsToSelect = availableSeats.slice(0, num);
                      onSetSeats(table.id, seatsToSelect);
                    }}
                    className="shrink-0 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-100 text-slate-700 focus:outline-none focus:border-primary transition-colors"
                  >
                    {num} ที่
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              disabled={availableSeats.length === 0}
              onClick={() => {
                onBookWholeTable(table.id, availableSeats);
                onClose();
              }}
              className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" /> เหมาโต๊ะ (เหลือ{" "}
              {availableSeats.length})
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-secondary hover:bg-secondary-hover text-white py-3 rounded-xl font-bold shadow-md shadow-secondary/20"
            >
              ยืนยันการเลือก
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
