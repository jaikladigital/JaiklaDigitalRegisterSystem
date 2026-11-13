/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useContext, useMemo } from "react";
import { Table, TicketPayload, EventBooth, BoothScanLog } from "../types";
import { Users, Banknote, GlassWater, BarChart3, Printer, Gift, Map as MapIcon, History, ClipboardList, CheckCircle2, Store, Activity } from "lucide-react";
import { ConfigContext } from "../ConfigContext";
import { SURVEY_TOPICS } from "./SurveyView";
import { ZONES, getZoneStyle } from "../data";
import { 
  calculateTicketDrinkRevenue, 
  getTicketWelcomeDrinksInfo, 
  calculateDrinkPrice 
} from "../utils/welcomeDrinks";

export default function ClientDashboardView({
  tables,
  tickets,
  surveys,
  luckyDrawWinners = [],
  booths = [],
  boothScanLogs = [],
}: {
  tables: Table[];
  tickets: TicketPayload[];
  surveys?: any[];
  luckyDrawWinners?: any[];
  booths?: EventBooth[];
  boothScanLogs?: BoothScanLog[];
}) {
  const { config } = useContext(ConfigContext);
  const localConfig = config;

  // Retrieve Admin Custom Toggles from Config
  const showOverviewSales = localConfig?.clientShowOverviewSales !== false; // Default: true (Show seats stats card)
  const showCheckIn = localConfig?.clientShowCheckIn !== false; // Default: true (Show check-ins stats card)
  const showDrinksReport = localConfig?.clientShowDrinksReport !== false; // Default: true (Show drinks stats card & report)
  const showSurveyReport = localConfig?.clientShowSurveyReport !== false; // Default: true (Show survey metrics & comments)
  const showPrizeClaims = localConfig?.clientShowPrizeClaims !== false; // Default: true (Show prize / souvenir claims report)

  // Newly requested Admin Toggles (Default: false, explicitly turned on by active switches)
  const showOverviewRevenue = !!localConfig?.clientShowOverviewRevenue; // ยอดรายได้สะสมบัตรขาย
  const showOverviewSponsor = !!localConfig?.clientShowOverviewSponsor; // ยอดมูลค่าบัตรสปอนเซอร์
  const showOverviewTables = !!localConfig?.clientShowOverviewTables; // จำนวนโต๊ะทั้งหมดในผัง
  const showLatestSales = !!localConfig?.clientShowLatestSales; // รายการ/ทะเบียนจองบัตรล่าสุด
  const showBankSummary = !!localConfig?.clientShowBankSummary; // สรุปพอร์ตบัญชีธนาคารเข้างาน
  const showBoothFinancials = !!localConfig?.clientShowBoothFinancials; // บัญชีการเงินของบูธร้านค้า
  const showBoothActivity = !!localConfig?.clientShowBoothActivity; // สถิติผู้เข้าร่วมบูธและการสแกน

  // Calculate Base Metrics matching exactly with AdminDashboardView
  const { totalSeats, totalTickets, totalCheckIns } = useMemo(() => {
    const totalSeats = tables.reduce((acc, t) => acc + t.seats.length, 0);
    const totalTickets = tables.reduce(
      (acc, t) => acc + t.seats.filter((s) => s.status === "paid").length,
      0,
    );

    const totalCheckIns = tickets
      .filter((t: TicketPayload) => t.checkInTime)
      .reduce((acc, t) => {
        if (t.checkedInSeats && t.checkedInSeats.length > 0) {
          return acc + t.checkedInSeats.length;
        }
        return acc + (t.seatIds?.length || 0);
      }, 0);

    return { totalSeats, totalTickets, totalCheckIns };
  }, [tables, tickets]);

  const displayRevenue = useMemo(() => {
    if (localConfig?.isTicketFree) return 0;
    return tickets
      .filter((t) => !t.isSponsor)
      .reduce((acc, t) => acc + (t.totalAmount || 0), 0);
  }, [tickets, localConfig?.isTicketFree]);

  const totalSponsorValue = useMemo(() => {
    return tickets
      .filter((t) => t.isSponsor)
      .reduce((acc, t) => acc + (t.sponsorValue || 0), 0);
  }, [tickets]);

  const totalTables = tables.length;

  const activeZones = useMemo(() => {
    return localConfig?.zones || ZONES;
  }, [localConfig?.zones]);

  // Compute Bank Account distribution report
  const bankReport = useMemo(() => {
    if (!tickets.length || !tables.length) return [];

    const reportMap: Record<
      string,
      {
        zoneId: string;
        zoneName: string;
        bankName: string;
        bankAccount: string;
        bankAccountName: string;
        totalAmount: number;
        transactionCount: number;
        color: string;
      }
    > = {};

    tickets
      .filter((t) => !t.isSponsor)
      .forEach((t) => {
        const table = tables.find((tb) => tb.id === t.tableId);
        if (!table) return;
        const zoneId = table.zoneId;
        const zoneInfo = activeZones[zoneId as any];
        if (!zoneInfo) return;

        const groupKey = `${zoneId}_${zoneInfo.bankAccount}`;

        if (!reportMap[groupKey]) {
          reportMap[groupKey] = {
            zoneId,
            zoneName: zoneInfo.name,
            bankName: zoneInfo.bankName || "ไม่ระบุธนาคาร",
            bankAccount: zoneInfo.bankAccount || "ไม่ระบุเลขบัญชี",
            bankAccountName: zoneInfo.bankAccountName || "-",
            totalAmount: 0,
            transactionCount: 0,
            color: zoneInfo.color || "#e11d48",
          };
        }

        reportMap[groupKey].totalAmount += t.totalAmount || 0;
        reportMap[groupKey].transactionCount += 1;
      });

    return Object.values(reportMap);
  }, [tickets, tables, activeZones]);

  // Compute Drinks Consumption Stats
  const { 
    drinkStats, 
    userDrinkStats, 
    drinkTotalRevenue,
    welcomeQuotaTotal,
    welcomeRedeemedTotal,
    welcomeValueSavedTotal
  } = useMemo(() => {
    const dStats: Record<string, number> = {};
    const udStats: {
      name: string;
      total: number;
      details: Record<string, number>;
      tableId: string;
      seatIds: number[];
    }[] = [];
    let dRev = 0;
    let wQuota = 0;
    let wRedeemed = 0;
    let wSaved = 0;

    tickets.forEach((t) => {
      // Calculate ticket-wide drink revenue considering free Welcome Drinks
      const actualRev = calculateTicketDrinkRevenue(t, localConfig, tables);
      dRev += actualRev;

      // Calculate Welcome Drink Quota & Redeemed
      const welcomeInfo = getTicketWelcomeDrinksInfo(t, localConfig, tables);
      wQuota += welcomeInfo.totalAllowance;
      wRedeemed += welcomeInfo.previousRedeemed;

      // Calculate the standard cost without welcome drink discount to find value saved
      let standardCost = 0;
      if (t.drinkHistory) {
        Object.entries(t.drinkHistory).forEach(([dId, qty]) => {
          const d = localConfig.drinks?.find((x: any) => x.id === dId);
          if (d) {
            standardCost += calculateDrinkPrice(d, Number(qty), localConfig.isWholeStoreFree);
          }
        });
      }
      const savedValue = Math.max(0, standardCost - actualRev);
      wSaved += savedValue;

      if (
        t.drinkHistoryBySeat &&
        Object.keys(t.drinkHistoryBySeat).length > 0
      ) {
        Object.entries(t.drinkHistoryBySeat).forEach(([seatIdStr, history]) => {
          let seatTotal = 0;
          Object.entries(history).forEach(([dId, qty]) => {
            dStats[dId] = (dStats[dId] || 0) + Number(qty);
            seatTotal += Number(qty);
          });

          if (seatTotal > 0) {
            udStats.push({
              name: t.userName,
              total: seatTotal,
              details: history as Record<string, number>,
              tableId: t.tableId,
              seatIds: [parseInt(seatIdStr, 10)],
            });
          }
        });

        const accountedDrinkHistory: Record<string, number> = {};
        Object.values(t.drinkHistoryBySeat).forEach((history) => {
          Object.entries(history as Record<string, number>).forEach(([dId, qty]) => {
            accountedDrinkHistory[dId] =
              (accountedDrinkHistory[dId] || 0) + Number(qty);
          });
        });

        if (t.drinkHistory) {
          const leftoverHistory: Record<string, number> = {};
          let leftoverTotal = 0;
          Object.entries(t.drinkHistory).forEach(([dId, qty]) => {
            const accountedQty = accountedDrinkHistory[dId] || 0;
            const leftoverQty = Number(qty) - accountedQty;
            if (leftoverQty > 0) {
              leftoverHistory[dId] = leftoverQty;
              leftoverTotal += leftoverQty;
              dStats[dId] = (dStats[dId] || 0) + leftoverQty;
            }
          });

          if (leftoverTotal > 0) {
            udStats.push({
              name: t.userName,
              total: leftoverTotal,
              details: leftoverHistory,
              tableId: t.tableId,
              seatIds: t.seatIds || [],
            });
          }
        }
      } else if (t.drinkHistory) {
        let userTotal = 0;
        Object.entries(t.drinkHistory).forEach(([dId, qty]) => {
          dStats[dId] = (dStats[dId] || 0) + Number(qty);
          userTotal += Number(qty);
        });
        if (userTotal > 0) {
          udStats.push({
            name: t.userName,
            total: userTotal,
            details: t.drinkHistory as Record<string, number>,
            tableId: t.tableId,
            seatIds: t.seatIds || [],
          });
        }
      }
    });

    udStats.sort((a, b) => b.total - a.total);
    return { 
      drinkStats: dStats, 
      userDrinkStats: udStats, 
      drinkTotalRevenue: dRev,
      welcomeQuotaTotal: wQuota,
      welcomeRedeemedTotal: wRedeemed,
      welcomeValueSavedTotal: wSaved,
    };
  }, [tickets, localConfig?.drinks, localConfig?.isWholeStoreFree, tables]);

  // Booth calculations for Dashboard display
  const boothSummaryData = useMemo(() => {
    const totalBoothScans = boothScanLogs.length;
    const totalBoothSales = boothScanLogs.reduce((sum, log) => sum + (Number(log.salesAmount) || 0), 0);

    const globalGpPercent = typeof localConfig?.boothGpPercent === 'number' ? localConfig.boothGpPercent : 0;

    const breakdowns = booths.map((b) => {
      const logsForBooth = boothScanLogs.filter((log) => log.boothId === b.id);
      const totalScans = logsForBooth.length;
      const grossSales = logsForBooth.reduce((sum, log) => sum + (Number(log.salesAmount) || 0), 0);
      const effectiveRate = typeof b.commissionRate === 'number' && b.commissionRate > 0 ? b.commissionRate : globalGpPercent;
      const gpReceived = grossSales * (effectiveRate / 100);
      const netStorePayout = grossSales - gpReceived;

      return {
        id: b.id,
        name: b.name,
        ownerName: b.ownerName,
        phone: b.phone,
        promptpayId: b.promptpayId,
        promptpayName: b.promptpayName,
        rentFee: b.rentFee || 0,
        commissionRate: effectiveRate,
        totalScans,
        grossSales,
        gpReceived,
        netStorePayout,
      };
    });

    // Sort by grossSales descending first; then by totalScans descending
    const sortedBreakdowns = [...breakdowns].sort((a, b) => {
      if (b.grossSales !== a.grossSales) return b.grossSales - a.grossSales;
      return b.totalScans - a.totalScans;
    });

    const totalGpReceived = breakdowns.reduce((sum, item) => sum + item.gpReceived, 0);
    const totalNetPayout = breakdowns.reduce((sum, item) => sum + item.netStorePayout, 0);

    return {
      totalBoothScans,
      totalBoothSales,
      totalGpReceived,
      totalNetPayout,
      boothBreakdowns: sortedBreakdowns,
    };
  }, [booths, boothScanLogs, localConfig?.boothGpPercent]);

  // Check if at least one widget/card is allowed to be rendered
  const anyWidgetVisible =
    showOverviewSales ||
    showCheckIn ||
    showDrinksReport ||
    showSurveyReport ||
    showOverviewRevenue ||
    showOverviewSponsor ||
    showOverviewTables ||
    showLatestSales ||
    showBankSummary ||
    showBoothFinancials ||
    showBoothActivity;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 print:space-y-4 print:pb-0 print:text-black">
      {/* ส่วนพาดหัวเฉพาะพิมพ์รายงาน (Print-Only Document Header) */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              เอกสารรายงานสรุปผลกิจกรรมภาพรวม (Read-Only Activity Report)
            </h1>
            <p className="text-sm text-slate-600 font-bold mt-1">
              โครงการจัดกิจกรรม/งานเลี้ยง: {localConfig?.eventName || "EventTicketingPro"}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <p>วันที่พิมพ์รายงาน: {new Date().toLocaleString("th-TH")}</p>
            <p>สิทธิ์การเข้าถึงข้อมูล: แฟ้มสรุปผลสาธารณะ (Client Overview)</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4 print:hidden">
        <div>
          <h2 className="text-3xl font-black text-slate-800">
            รายงานสรุปงาน (Client Dashboard)
          </h2>
          <p className="text-slate-500 mt-1">
            ภาพรวมรายงานแบบอ่านอย่างเดียวได้รับอนุญาตโดยฝ่ายแอดมิน (Authorized Read-only Summary)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Printer className="w-5 h-5" /> พิมพ์สรุปรายงาน / Export PDF
          </button>
        </div>
      </div>

      {!anyWidgetVisible ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-2xl mx-auto my-12 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200">
            <ClipboardList className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="font-bold text-lg text-slate-700 mb-2">
            ไม่มีพอร์ตรายงานแสดงผลในขณะนี้ (All reports hidden)
          </h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            ผู้จัดงานหรือผู้ดูแลระบบยังไม่เปิดการเผยแพร่ข้อมูลภาพรวมใด ๆ แก่สาธารณะ คุณสามารถส่งข้อมูลให้แอดมินเข้าไปเปิดสวิตช์หัวข้อรายงานต่าง ๆ ได้ที่หน้าจอหลักแอดมินของหลังบ้านระบบ
          </p>
          <div className="text-xs text-indigo-500 font-semibold bg-indigo-50 px-4 py-2 rounded-xl inline-block">
            🔔 แอดมิน: ตั้งค่าระบบ และ ธีมหน้างาน {" → "} ตั้งค่าความปลอดภัยการแสดงผลรายงานหน้าสรุปงาน (Client Dashboard Visibility)
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: Overview Summary Cards Layer */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:gap-3">
            {/* 1. ยอดผู้ร่วมงานทั้งหมด */}
            {showOverviewSales && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm">
                    ผู้ร่วมงานสะสมทั้งหมด
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">
                    {totalTickets}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    / {totalSeats || 0} คน
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  ({totalSeats ? Math.round((totalTickets / totalSeats) * 100) : 0}% ของความจุรวมทั้งหมด)
                </p>
              </div>
            )}

            {/* 2. ยอดผู้เช็คอินแล้ว */}
            {showCheckIn && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-600 font-bold text-lg">✓</span>
                  </div>
                  <span className="font-semibold text-slate-600 text-sm">
                    เช็คอินเข้าร่วมงาน
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-600">
                    {totalCheckIns}
                  </span>
                  <span className="text-sm font-bold text-slate-400">
                    / {totalTickets} คน
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  ({totalTickets ? Math.round((totalCheckIns / totalTickets) * 100) : 0}% ของผู้จองที่ยืนยันตัว)
                </p>
              </div>
            )}

            {/* 3. ยอดรวมรายได้จำหน่ายตั๋ว */}
            {showOverviewRevenue && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Banknote className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm">
                    ยอดเงินรายรับสะสม
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800">
                    ฿{displayRevenue.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  (จากการจำหน่ายตามผังโซน)
                </p>
              </div>
            )}

            {/* 4. ยอดมูลค่าตั๋วสปอนเซอร์ */}
            {showOverviewSponsor && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                    <Gift className="w-4 h-4 text-rose-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm">
                    มูลค่าบัตรรวมสปอนเซอร์
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-rose-600">
                    ฿{totalSponsorValue.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  (บัตรกลุ่มพิเศษ Comped)
                </p>
              </div>
            )}

            {/* 5. จำนวนโต๊ะอาหารทั้งหมด */}
            {showOverviewTables && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <MapIcon className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm">
                    กำลังโต๊ะทั้งหมดในงาน
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-purple-600">
                    {totalTables}
                  </span>
                  <span className="text-sm font-medium text-slate-400">
                    โต๊ะจัดตั้ง
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  (ตามการจัดวาง Layout)
                </p>
              </div>
            )}

            {/* 6. ยอดรวมแก้วเครื่องดื่มที่เบิกแจก */}
            {showDrinksReport && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <GlassWater className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm">
                    รวมแลกใช้เครื่องดื่ม
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-600">
                    {Object.values(drinkStats).reduce(
                      (a: number, b: number) => a + b,
                      0,
                    )}
                  </span>
                  <span className="text-sm font-medium text-slate-400">แก้ว</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  (เบิกแจกคูปองหน้าห้องกิจกรรม)
                </p>
              </div>
            )}

            {/* 7. ยอดรวมรายการประเมินความพึงพอใจ */}
            {showSurveyReport && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm">
                    แบบประเมินความเห็น
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-purple-600">
                    {(surveys || []).length}
                  </span>
                  <span className="text-sm font-medium text-slate-400">รายการ</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  (ทำความคืบหน้ารวม)
                </p>
              </div>
            )}

            {/* 8. สรุปรายการรับของที่ระลึก (Prize / Souvenir Claims) */}
            {showPrizeClaims && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Gift className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm font-sans">
                    รับของที่ระลึกแล้ว
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-500 font-sans">
                    {luckyDrawWinners.filter(w => w.claimed).length}
                  </span>
                  <span className="text-sm font-medium text-slate-400 font-sans">
                    / {luckyDrawWinners.length} รายการ
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium font-sans">
                  (ผู้โชคดียืนยันตัวตนแล้ว)
                </p>
              </div>
            )}

            {/* 9. ยอดจำหน่ายผ่านบูธสะสม (Booth Financials Card) */}
            {showBoothFinancials && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none animate-fade-in text-sans">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Store className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm font-sans">
                    ยอดขายร้านค้าสะสม
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-600 font-sans">
                    ฿{boothSummaryData.totalBoothSales.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium font-sans">
                  (จากอาหาร/เครื่องดื่ม/บูธกิจกรรม)
                </p>
              </div>
            )}

            {/* 10. สถิติสแกนทำกิจกรรมบูธ (Booth Scanner Activity Card) */}
            {showBoothActivity && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:border-slate-300 print:shadow-none animate-fade-in text-sans">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="font-semibold text-slate-600 text-sm font-sans">
                    จำนวนสแกนเข้าบูธรวม
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-800 font-sans">
                    {boothSummaryData.totalBoothScans.toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-slate-400 font-sans">ครั้ง</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium font-sans">
                  (ผู้ใช้งานสแกนพาสพอร์ต QR)
                </p>
              </div>
            )}
          </div>

          {/* Section 2: Detailed Bank summaries report (Toggled-visible) */}
          {showBankSummary && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Banknote className="w-5 h-5 text-emerald-500" /> สรุปยอดเงินโอนเข้าและแจกแจงแยกโซน (Bank Accounts & Zone Summaries)
              </h3>
              {bankReport.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 bg-slate-50 rounded-xl text-center">
                  ยังไม่มีรายงานข้อมูลธุรกรรมโอนเงินในขณะนี้
                </p>
              ) : (
                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="py-3 px-4 rounded-l-xl">โซน</th>
                        <th className="py-3 px-4">ระบบธนาคาร</th>
                        <th className="py-3 px-4">ชื่อบัญชีโอน</th>
                        <th className="py-3 px-4">เลขที่บัญชี</th>
                        <th className="py-3 px-4 text-center">จำนวนสลิป</th>
                        <th className="py-3 px-4 text-right rounded-r-xl">ยอดเงินพอร์ตรวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bankReport.map((report, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4">
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                              style={getZoneStyle(report.color)}
                            >
                              {report.zoneName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {report.bankName}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {report.bankAccountName}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                            {report.bankAccount}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                              {report.transactionCount}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-bold text-emerald-600">
                              ฿{report.totalAmount.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 font-sans">
                      <tr>
                        <td colSpan={4} className="py-4 px-4 text-right font-bold text-slate-700">
                          รวมยอดรายรับสะสมทั้งหมด (Total Bank Aggregation):
                        </td>
                        <td className="py-4 px-4 text-center font-black text-slate-800">
                          {bankReport.reduce((acc, row) => acc + row.transactionCount, 0)} สลิป
                        </td>
                        <td className="py-4 px-4 text-right font-black text-emerald-700 text-lg">
                          ฿{bankReport.reduce((acc, row) => acc + row.totalAmount, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Drink Consumption Distribution and Top Consumers (Toggled-visible) */}
          {showDrinksReport && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <GlassWater className="w-5 h-5 text-indigo-500" /> รายงานสรุปเครื่องดื่มในงาน (Drinks Consumption Report)
              </h3>

              {/* Welcome Drink Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 print:grid-cols-3">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-2xl border border-indigo-100 shadow-sm text-left">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">
                    โควตา Welcome Drink ทั้งหมด
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-indigo-950 font-sans">
                      {welcomeQuotaTotal.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-indigo-600">แก้ว</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    อิงตามโซนและจำนวนที่นั่งของตั๋วทั้งหมด
                  </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-2xl border border-emerald-100 shadow-sm text-left">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                    แลกรับไปแล้วทั้งหมด
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-emerald-950 font-sans">
                      {welcomeRedeemedTotal.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">แก้ว</span>
                  </div>
                  {welcomeQuotaTotal > 0 ? (
                    <div className="w-full bg-emerald-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (welcomeRedeemedTotal / welcomeQuotaTotal) * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    คิดเป็น {welcomeQuotaTotal > 0 ? ((welcomeRedeemedTotal / welcomeQuotaTotal) * 100).toFixed(1) : 0}% ของโควตาทั้งหมด
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-2xl border border-purple-100 shadow-sm text-left">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">
                    มูลค่าส่วนลด Welcome Drink สะสม
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-purple-950 font-sans">
                      ฿{welcomeValueSavedTotal.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-purple-600">บาท</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    มูลค่าสิทธิ์ฟรีที่ผู้เข้าร่วมงานประหยัดได้จริง
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Beverage category total */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    📊 สถิติยอดแลกแจกตามรายการ (Drinks Total)
                  </h4>
                  <div className="space-y-3">
                    {Object.keys(drinkStats).length === 0 ? (
                      <p className="text-slate-400 text-sm py-6 bg-slate-50 rounded-xl text-center">
                        ยังไม่มีรายการแลกเครื่องดื่มเพิ่มขึ้นในระบบ
                      </p>
                    ) : (
                      localConfig?.drinks?.map((drink: any) => {
                        const qty = drinkStats[drink.id] || 0;
                        if (qty === 0) return null;
                        return (
                          <div
                            key={drink.id}
                            className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-300"
                          >
                            <span className="font-bold text-slate-700">{drink.name}</span>
                            <span className="text-indigo-600 font-extrabold text-sm bg-indigo-50 px-3 py-1 rounded-lg">
                              {qty} แก้ว
                            </span>
                          </div>
                        );
                      })
                    )}
                    {drinkTotalRevenue > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-150 flex justify-between items-center bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                        <span className="font-bold text-slate-700 text-xs">คำนวณมูลค่ารวมเครื่องดื่มแจก:</span>
                        <span className="font-black text-emerald-700 text-base">฿{drinkTotalRevenue.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Consumers Table */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    🏆 ลำดับเบิกสูงสุดรายคน (Top Consumers List)
                  </h4>
                  <div className="space-y-3">
                    {userDrinkStats.length === 0 ? (
                      <p className="text-slate-400 text-sm py-6 bg-slate-50 rounded-xl text-center">
                        ยังไม่มีสถิติผู้ดื่มรายงานเข้ามา
                      </p>
                    ) : (
                      userDrinkStats.slice(0, 5).map((u, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-slate-150 rounded-xl shadow-sm flex items-start gap-3 print:border-slate-300 print:shadow-none"
                        >
                          <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center font-black text-indigo-500 text-xs shrink-0 border border-indigo-100">
                            #{idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 text-sm truncate">{u.name}</p>
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              โต๊ะ {u.tableId} • ที่นั่ง {u.seatIds.join(", ")}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-indigo-600 bg-indigo-100/50 px-2.5 py-1 rounded-lg">
                              {u.total} แก้ว
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Latest Ticket Registrations List (Toggled-visible) */}
          {showLatestSales && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <History className="w-5 h-5 text-orange-500" /> ประวัติและทะเบียนรายชื่อจองสำเร็จล่าสุด (Latest Ticket Registrations)
              </h3>
              {tickets.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-10">
                  ยังไม่มีลูกค้าจองตั๋วในระบบสะสมในข้อมูลปัจจุบัน
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between items-start p-3 bg-white hover:bg-slate-50 rounded-xl transition border border-slate-200 gap-3 print:break-inside-avoid"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 break-words whitespace-normal leading-tight text-sm">
                          {t.userName}{" "}
                          {t.isSponsor && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md ml-1 inline-block">
                              Sponsor
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          โต๊ะ {t.tableId} • ที่นั่ง {t.seatIds.join(", ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold ${t.isSponsor ? "text-rose-600" : "text-emerald-600"}`}>
                          ฿{t.totalAmount.toLocaleString()}
                        </p>
                        {t.checkInTime ? (
                          <span className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full font-medium inline-block mt-1">
                            {t.checkedInSeats && t.checkedInSeats.length > 0
                              ? `เช็คอินแล้้ว ${t.checkedInSeats.length}/${t.seatIds.length}`
                              : "เช็คอินแล้ว"}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-850 px-2-px py-0.5 rounded-full font-semibold inline-block mt-1">
                            รอเช็คอิน
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Section 5: Satisfaction Survey Results (Toggled-visible) */}
          {showSurveyReport && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <BarChart3 className="w-5 h-5 text-purple-500" /> ผลประเมินความพึงพอใจและข้อเสนอแนะคัดสรรพิเศษ (Customer Satisfaction Metrics)
              </h3>
              {!surveys || surveys.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300">
                  ยังไม่มีผู้ทำบันทึกประเมินความเห็นเข้ามา ณ เวลากิจกรรมนี้
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {SURVEY_TOPICS.map((topic) => {
                      const scores = surveys
                        .map((s) => s.ratings[topic.id])
                        .filter((v) => v != null);
                      const count = scores.length;
                      const avg = count
                        ? scores.reduce((a, b) => a + b, 0) / count
                        : 0;
                      const percent = (avg / 3) * 100;

                      let color = "bg-rose-500";
                      if (avg >= 2.5) color = "bg-emerald-500";
                      else if (avg >= 1.5) color = "bg-indigo-500";

                      return (
                        <div
                          key={topic.id}
                          className="p-4 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-300"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-700 flex items-center gap-2 text-sm">
                              {topic.label}
                            </span>
                            <span className="font-black text-slate-800 text-lg">
                              {avg.toFixed(1)}{" "}
                              <span className="text-xs font-medium text-slate-400">
                                / 3.0
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 mb-1 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${color}`}
                              style={{
                                width: `${Math.max(0, Math.min(100, percent))}%`,
                              }}
                            ></div>
                          </div>
                          <p className="text-[10px] text-slate-400 text-right">
                            ผู้ทำการกรอกข้อมูลเสร็จสิ้นแล้ว {count} รายการ
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-1.5">
                      💬 ความเห็นสะสมและข้อเสนอแนะเพิ่มเติม (Recent Comments)
                    </h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible">
                      {surveys.filter((s) => s.comment?.trim()).length === 0 ? (
                        <p className="text-slate-400 text-sm italic">
                          ยังไม่มีผู้ส่งข้อคิดเห็นข้อเสนอแนะเข้ามาเพิ่มเติม
                        </p>
                      ) : (
                        surveys
                          .filter((s) => s.comment?.trim())
                          .slice(-10)
                          .reverse()
                          .map((s) => (
                            <div
                              key={s.id}
                              className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-start gap-2.5 print:border-slate-300 print:shadow-none"
                            >
                              <div className="text-slate-300 font-serif text-3xl leading-none">“</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-600 text-sm italic break-words">{s.comment}</p>
                                <span className="block text-[9px] text-slate-400 mt-2 font-mono">
                                  REGISTRATION KEY #{s.id.substring(0,6).toUpperCase()}
                                </span>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 6: Prize / Souvenir Claims Report (Toggled-visible) */}
          {showPrizeClaims && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 font-sans text-slate-800">
                <Gift className="w-5 h-5 text-amber-500" /> สรุปรายการรับของที่ระลึกและการสแกนคิวอาร์โค้ดสิทธิ์รางวัล (Lucky Draw / Souvenir Scan Reports)
              </h3>
              {luckyDrawWinners.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300 font-sans">
                  ยังไม่ได้เริ่มสุ่มรายชื่อผู้โชคดีจับของรางวัลในระบบภาพรวมหลังบ้าน
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Summary Metric Stats cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1 font-sans">จำนวนผู้โชคดีทั้งหมด</p>
                      <p className="text-2xl font-black text-amber-700 font-sans">{luckyDrawWinners.length} <span className="text-xs font-medium text-slate-500">คน</span></p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1 font-sans">สแกนรับของที่ระลึกแล้ว</p>
                      <p className="text-2xl font-black text-emerald-700 font-sans">{luckyDrawWinners.filter((w: any) => w.claimed).length} <span className="text-xs font-medium text-slate-550 font-sans font-sans">รายการ</span></p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1 font-sans">ยังไม่ได้รับ (คงเหลือ)</p>
                      <p className="text-2xl font-black text-slate-700 font-sans">{luckyDrawWinners.filter((w: any) => !w.claimed).length} <span className="text-xs font-medium text-slate-500 font-sans">รายการ</span></p>
                    </div>
                  </div>

                  {/* Claims List Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 font-sans">
                          <th className="p-3 font-sans">ผู้โชคดี</th>
                          <th className="p-3 text-center font-sans">ที่นั่ง / โต๊ะ</th>
                          <th className="p-3 text-center font-sans">สถานะรับรางวัล</th>
                          <th className="p-3 text-center font-sans">เวลาสแกนรับ</th>
                          <th className="p-3 text-right font-sans">ข้อมูลสแกน QR Code (Payload)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {luckyDrawWinners.map((val: any, index: number) => (
                          <tr key={index} className="hover:bg-slate-50 transition-colors font-sans">
                            <td className="p-3 font-semibold text-slate-800 font-sans">
                              คุณ {val.userName || `บัตรหมายเลข ${val.ticketId}`}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 font-sans font-sans">
                              โต๊ะ {val.tableId || 'N/A'} {val.seatId ? `ที่นั่ง ${val.seatId}` : ''}
                            </td>
                            <td className="p-3 text-center font-sans">
                              {val.claimed ? (
                                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-xs font-sans">
                                  รับของขวัญเรียบร้อย
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full text-xs font-sans">
                                  รอรับสิทธิ์
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center text-xs text-slate-500 font-sans">
                              {val.claimedAt ? new Date(val.claimedAt).toLocaleString('th-TH') : '-'}
                            </td>
                            <td className="p-3 text-right">
                              {val.scannedQR ? (
                                <code className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded max-h-16 overflow-y-auto block max-w-xs ml-auto break-all font-mono leading-normal text-right">
                                  {val.scannedQR}
                                </code>
                              ) : (
                                <span className="text-xs text-slate-400 italic font-sans">ไม่มีข้อมูล QRสแกน (สตาฟสตรีม/สุ่มรับ)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 7: รายงานบัญชีและการเงินของบูธร้านค้าต่างๆ (Booth Financials - Toggled-visible) */}
          {showBoothFinancials && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 font-sans text-slate-800">
                <Store className="w-5 h-5 text-emerald-600" /> สรุปผลบัญชีและการเงินผู้ประกอบการรายบูธในงาน (Booth Financial Report)
              </h3>
              
              {booths.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300 font-sans">
                  ไม่มีรายชื่อบูธกิจกรรมในระบบ ณ ขณะนี้
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Summary Metric Stats cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1 font-sans">ยอดขายผ่านบูธสะสมรวม (Gross)</p>
                      <p className="text-2xl font-black text-emerald-700 font-sans">฿{boothSummaryData.totalBoothSales.toLocaleString()}</p>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1 font-sans">ส่วนแบ่งเข้าระบบกองกลาง (GP)</p>
                      <p className="text-2xl font-black text-indigo-700 font-sans">฿{boothSummaryData.totalGpReceived.toLocaleString()}</p>
                    </div>
                    <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-center">
                      <p className="text-xs text-slate-500 font-bold mb-1 font-sans">ยอดรายรับร้านค้าหัก GP สุทธิ (Net Payout)</p>
                      <p className="text-2xl font-black text-sky-700 font-sans">฿{boothSummaryData.totalNetPayout.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Detailed Table */}
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-sm whitespace-nowrap print:whitespace-normal">
                      <thead className="bg-slate-50 text-slate-650 font-bold text-xs">
                        <tr>
                          <th className="py-3 px-4 rounded-l-xl font-sans">ชื่อบูธ / ร้านค้า</th>
                          <th className="py-3 px-4 font-sans">ผู้ประสานงานหลัก</th>
                          <th className="py-3 px-4 text-center font-sans">ยอดบันทึกแชร์สแกน</th>
                          <th className="py-3 px-4 text-right font-sans">ยอดขายรวม (Gross)</th>
                          <th className="py-3 px-4 text-center font-sans">อัตรา GP (%)</th>
                          <th className="py-3 px-4 text-right font-sans">ส่วนแบ่งเข้าระบบ</th>
                          <th className="py-3 px-4 text-right font-sans">เงินโอนร้านค้าสุทธิ</th>
                          <th className="py-3 px-4 rounded-r-xl font-sans text-right">ข้อมูลบัญชีรับเงินโอน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {boothSummaryData.boothBreakdowns.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50 transition-colors font-sans">
                            <td className="py-3.5 px-4 font-semibold text-slate-850">
                              {b.name}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-xs">
                              <p className="font-medium text-slate-700">{b.ownerName}</p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{b.phone}</p>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-slate-700 font-sans">
                              {b.totalScans} ครั้ง
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                              ฿{b.grossSales.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-600 font-bold text-xs">
                              {b.commissionRate}%
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-slate-500">
                              ฿{b.gpReceived.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-emerald-600">
                              ฿{b.netStorePayout.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right text-xs">
                              {b.promptpayId ? (
                                <div>
                                  <span className="font-bold text-slate-700 font-mono text-[11px] block">{b.promptpayId}</span>
                                  <span className="text-[9px] text-slate-400 block font-sans">({b.promptpayName || "ไม่ระบุชื่อ"})</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">ไม่ได้กำหนดช่องทางไว้</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 8: รายงานกิจกรรมและการสแกนบูธดิบ (Booth Scanner Activity - Toggled-visible) */}
          {showBoothActivity && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 font-sans text-slate-800">
                <Activity className="w-5 h-5 text-indigo-500" /> สถิติผู้ร่วมกิจกรรมและการใช้งานพาส QR รายบูธ (Booth Scanner Engagement Tracker)
              </h3>

              {booths.length === 0 ? (
                <p className="text-slate-400 text-sm py-8 bg-slate-50 rounded-xl text-center font-sans">
                  ไม่มีรายชื่อบูธกิจกรรมในระบบ ณ ขณะนี้
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Engagement Progress Bars */}
                  <div className="lg:col-span-5 space-y-4">
                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      👑 บูธอินเตอร์แอกทีฟยอดนิยม (Booth Engagement Ranking)
                    </h4>
                    <p className="text-xs text-slate-400">จัดอันดับตามสัดส่วนจำนวนครั้งที่ผู้ร่วมงานเข้าสแกนทำกิจกรรมตามพาสและยอดขาย</p>
                    
                    <div className="space-y-4 pt-2">
                      {(() => {
                        const maxScansInAnyBooth = Math.max(...booths.map(b => boothScanLogs.filter(log => log.boothId === b.id).length), 1);
                        return boothSummaryData.boothBreakdowns.map((b, idx) => {
                          const percentage = Math.round((b.totalScans / maxScansInAnyBooth) * 100);
                          return (
                            <div key={b.id} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-800">{idx + 1}. {b.name}</span>
                                <span className="font-bold text-slate-500 font-mono">{b.totalScans} ครั้ง สแกน</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 flex rounded-md overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-full rounded-md transition-all duration-500" 
                                  style={{ width: `${Math.max(percentage, 5)}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Searchable Scanner Logs */}
                  <div className="lg:col-span-7 space-y-4">
                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      📝 ประวัติการบันทึกสแกนเข้าใช้บริการ (Real-time Scanner Logs)
                    </h4>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="🔍 พิมพ์ค้นชื่อผู้ร่วมงาน, ชื่อบูธร้านค้า, บันทึกพิเศษ..."
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          const q = target.value.toLowerCase();
                          const el = document.getElementById("booth-logs-tbody");
                          if (el) {
                            const rows = el.getElementsByTagName("tr");
                            for (let i = 0; i < rows.length; i++) {
                              const r = rows[i];
                              const text = r.innerText.toLowerCase();
                              if (text.indexOf(q) > -1) {
                                r.style.display = "";
                              } else {
                                r.style.display = "none";
                              }
                            }
                          }
                        }}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="max-h-64 overflow-y-auto border border-slate-150 rounded-xl">
                      {boothScanLogs.length === 0 ? (
                        <p className="text-slate-400 text-xs py-8 text-center font-sans">
                          ยังไม่มีผู้ร่วมงานสแกนเข้าใช้บริการและซื้อของที่บูธในขณะนี้
                        </p>
                      ) : (
                        <table className="w-full text-left text-xs whitespace-nowrap">
                          <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0">
                            <tr>
                              <th className="py-2 px-3">ผู้ร่วมงาน</th>
                              <th className="py-2 px-3">บูธกิจกรรม</th>
                              <th className="py-2 px-3 text-right">ยอดเงิน</th>
                              <th className="py-2 px-3">บันทึกช่วยสแกน</th>
                              <th className="py-2 px-3 text-right">เวลาสแกน</th>
                            </tr>
                          </thead>
                          <tbody id="booth-logs-tbody" className="divide-y divide-slate-100">
                            {[...boothScanLogs]
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                              .map((log: any, idx) => (
                                <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                                    <p>คุณ {log.userName}</p>
                                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{log.ticketId?.substring(0, 8)}</p>
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-700">
                                    🏪 {log.boothName}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-black text-rose-600">
                                    {log.salesAmount > 0 ? `฿${log.salesAmount.toLocaleString()}` : 'ฟรี'}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 max-w-[120px] truncate" title={log.notes}>
                                    {log.notes || "-"}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[10px]">
                                    {new Date(log.timestamp).toLocaleTimeString("th-TH")}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ลงนามเอกสารเฉพาะหน้าพิมพ์ (Print-Only Signature Section) */}
      <div className="hidden print:block mt-12 pt-8 border-t border-dashed border-slate-300">
        <div className="grid grid-cols-3 gap-8 text-center text-xs text-slate-600">
          <div>
            <p className="mb-14">ผู้จัดทำและสกัดผลรายงาน</p>
            <p className="font-bold">__________________________</p>
            <p className="mt-2 font-semibold text-slate-800">( ผู้อำนวยการจัดงาน / คณะผู้จัดงาน )</p>
          </div>
          <div>
            <p className="mb-14">ผู้ตรวจทานความถูกต้อง</p>
            <p className="font-bold">__________________________</p>
            <p className="mt-2 font-semibold text-slate-800">( ฝ่ายบริหารจัดการสถิติและการจอง )</p>
          </div>
          <div>
            <p className="mb-14">พยานและผู้อนุมัติข้อมูล</p>
            <p className="font-bold">__________________________</p>
            <p className="mt-2 font-semibold text-slate-800">( ตัวแทนฝ่ายสนับสนุนหลักประจำกิจกรรม )</p>
          </div>
        </div>
      </div>
    </div>
  );
}
