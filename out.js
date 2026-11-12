import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import React, { useContext, useMemo, useState } from "react";
import { generateTicketImage } from "../utils/ticketGenerator";
import { getEmailHtml } from "../utils/emailTemplates";
import { ZONES, generateInitialTables } from "../data";
import { Users, Banknote, Map as MapIcon, Gift, Settings, Image as ImageIcon, Palette, Monitor, GlassWater, BarChart3, Printer, Save, RefreshCw, Edit2, Plus, Minus, Trash2, LayoutGrid, Mail, Wand2, Loader2, Languages } from "lucide-react";
import { motion } from "motion/react";
import { SURVEY_TOPICS } from "./SurveyView";
import { ConfigContext } from "../ConfigContext";
const LayoutIcon = ({ type, color }) => {
  return /* @__PURE__ */ jsxs("svg", { width: "48", height: "48", viewBox: "0 0 48 48", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [
    /* @__PURE__ */ jsx("rect", { width: "48", height: "48", rx: "8", fill: "transparent" }),
    type === "banquet" && /* @__PURE__ */ jsx("g", { transform: "translate(4, 2)", children: [[10, 10], [30, 10], [10, 34], [30, 34]].map(([x, y], idx) => /* @__PURE__ */ jsxs("g", { transform: `translate(${x}, ${y})`, children: [
      /* @__PURE__ */ jsx("circle", { cx: "0", cy: "0", r: "4.5", fill: "white", stroke: color, strokeWidth: "1.5" }),
      [...Array(8)].map((_, i) => /* @__PURE__ */ jsx("circle", { cx: 7.5 * Math.cos(i * Math.PI / 4), cy: 7.5 * Math.sin(i * Math.PI / 4), r: "1", fill: "#94a3b8" }, i))
    ] }, idx)) }),
    type === "cabaret" && /* @__PURE__ */ jsx("g", { transform: "translate(4, 2)", children: [[10, 10], [30, 10], [10, 34], [30, 34]].map(([x, y], idx) => /* @__PURE__ */ jsxs("g", { transform: `translate(${x}, ${y})`, children: [
      /* @__PURE__ */ jsx("circle", { cx: "0", cy: "0", r: "4.5", fill: "white", stroke: color, strokeWidth: "1.5" }),
      [...Array(5)].map((_, i) => /* @__PURE__ */ jsx("circle", { cx: 7.5 * Math.cos(Math.PI + i * Math.PI / 4), cy: 7.5 * Math.sin(Math.PI + i * Math.PI / 4), r: "1", fill: "#94a3b8" }, i))
    ] }, idx)) }),
    type === "u-shape" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("path", { d: "M12 10 V34 H36 V10", fill: "none", stroke: color, strokeWidth: "5" }),
      /* @__PURE__ */ jsx("path", { d: "M12 10 V34 H36 V10", fill: "none", stroke: "white", strokeWidth: "2.5" }),
      [12, 18, 24, 30].map((y) => /* @__PURE__ */ jsx("circle", { cx: "7", cy: y, r: "1.5", fill: "#94a3b8" }, `l-${y}`)),
      [18, 24, 30].map((x) => /* @__PURE__ */ jsx("circle", { cx: x, cy: "39", r: "1.5", fill: "#94a3b8" }, `b-${x}`)),
      [12, 18, 24, 30].map((y) => /* @__PURE__ */ jsx("circle", { cx: "41", cy: y, r: "1.5", fill: "#94a3b8" }, `r-${y}`))
    ] }),
    type === "theatre" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("rect", { x: "14", y: "8", width: "20", height: "2", fill: color }),
      /* @__PURE__ */ jsx("g", { transform: "translate(0, 2)", children: [0, 1, 2, 3].map((row) => /* @__PURE__ */ jsxs("g", { transform: `translate(0, ${row * 6})`, children: [
        [0, 1, 2, 3, 4].map((col) => /* @__PURE__ */ jsx("rect", { x: 8 + col * 3, y: 16, width: "2", height: "2.5", rx: "0.5", fill: "#94a3b8" }, `l-${col}`)),
        [0, 1, 2, 3, 4].map((col) => /* @__PURE__ */ jsx("rect", { x: 26 + col * 3, y: 16, width: "2", height: "2.5", rx: "0.5", fill: "#94a3b8" }, `r-${col}`))
      ] }, row)) })
    ] }),
    type === "classroom" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("rect", { x: "14", y: "6", width: "20", height: "2", fill: color }),
      [0, 1, 2, 3].map((row) => /* @__PURE__ */ jsxs("g", { transform: `translate(0, ${row * 8})`, children: [
        /* @__PURE__ */ jsx("rect", { x: "8", y: 14, width: "14", height: "3", fill: "none", stroke: color, strokeWidth: "1" }),
        /* @__PURE__ */ jsx("rect", { x: "26", y: 14, width: "14", height: "3", fill: "none", stroke: color, strokeWidth: "1" }),
        [0, 1, 2].map((col) => /* @__PURE__ */ jsx("rect", { x: 10 + col * 4, y: 18, width: "2", height: "2", rx: "0.5", fill: "#94a3b8" }, `c1-${col}`)),
        [0, 1, 2].map((col) => /* @__PURE__ */ jsx("rect", { x: 28 + col * 4, y: 18, width: "2", height: "2", rx: "0.5", fill: "#94a3b8" }, `c2-${col}`))
      ] }, row))
    ] }),
    type === "boardroom" && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("rect", { x: "16", y: "10", width: "16", height: "28", fill: "none", stroke: color, strokeWidth: "3" }),
      /* @__PURE__ */ jsx("rect", { x: "16", y: "10", width: "16", height: "28", fill: "none", stroke: "white", strokeWidth: "1.5" }),
      [14, 20, 26, 34].map((y) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
        /* @__PURE__ */ jsx("circle", { cx: "12", cy: y, r: "1.5", fill: "#94a3b8" }),
        /* @__PURE__ */ jsx("circle", { cx: "36", cy: y, r: "1.5", fill: "#94a3b8" })
      ] }, y)),
      /* @__PURE__ */ jsx("circle", { cx: "24", cy: "6", r: "1.5", fill: "#94a3b8" }),
      /* @__PURE__ */ jsx("circle", { cx: "24", cy: "42", r: "1.5", fill: "#94a3b8" })
    ] }),
    type === "chevron" && /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx("g", { transform: "translate(0, 4)", children: [0, 1, 2, 3].map((row) => /* @__PURE__ */ jsxs("g", { transform: `translate(0, ${row * 9})`, children: [
      /* @__PURE__ */ jsxs("g", { transform: "translate(14, 8) rotate(-15) translate(-14, -8)", children: [
        /* @__PURE__ */ jsx("rect", { x: "6", y: "6", width: "16", height: "3", fill: "none", stroke: color, strokeWidth: "1" }),
        [1, 2, 3].map((i) => /* @__PURE__ */ jsx("circle", { cx: 6 + i * 4.5 - 1, cy: "11", r: "1", fill: "#94a3b8" }, i))
      ] }),
      /* @__PURE__ */ jsxs("g", { transform: "translate(34, 8) rotate(15) translate(-34, -8)", children: [
        /* @__PURE__ */ jsx("rect", { x: "26", y: "6", width: "16", height: "3", fill: "none", stroke: color, strokeWidth: "1" }),
        [1, 2, 3].map((i) => /* @__PURE__ */ jsx("circle", { cx: 26 + i * 4.5 - 1, cy: "11", r: "1", fill: "#94a3b8" }, i))
      ] })
    ] }, row)) }) }),
    type === "circle-of-chairs" && /* @__PURE__ */ jsxs("g", { transform: "translate(24, 24)", children: [
      [...Array(16)].map((_, i) => /* @__PURE__ */ jsx("g", { transform: `rotate(${i * (360 / 16)}) translate(0, -16)`, children: /* @__PURE__ */ jsx("path", { d: "M-1.5,0 L1.5,0 L1.5,-2 L-1.5,-2 Z", fill: "#94a3b8" }) }, i)),
      /* @__PURE__ */ jsx("circle", { cx: "0", cy: "0", r: "3", fill: color })
    ] })
  ] });
};
export default function AdminDashboardView({ tables, setTables, tickets, setMyTickets, surveys, pendingEmails, setPendingEmails, onOpenLuckyDraw, onResetApp }) {
  const { config, setConfig } = useContext(ConfigContext);
  const activeZones = config.zones || ZONES;
  const [editingZones, setEditingZones] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const handleTranslateTemplate = async (mode, field = "body") => {
    const textToTranslate = field === "body" ? config.emailTemplateBody : config.emailTemplateSubject;
    if (!textToTranslate) return;
    setIsTranslating(true);
    try {
      const resp = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToTranslate,
          mode
        })
      });
      const data = await resp.json();
      if (data.translation) {
        if (field === "body") {
          setConfig({ ...config, emailTemplateBody: data.translation });
        } else {
          setConfig({ ...config, emailTemplateSubject: data.translation });
        }
      } else {
        alert(data.error || "Failed to translate");
      }
    } catch (e) {
      console.error(e);
      alert("Error connecting to translation API");
    } finally {
      setIsTranslating(false);
    }
  };
  const [zoneForm, setZoneForm] = useState(config.zoneCounts || { VIP: 20, GOLD: 40, REGULAR: 40 });
  const [priceForm, setPriceForm] = useState(activeZones);
  const totalSeats = tables.reduce((acc, t) => acc + t.seats.length, 0);
  const paidSeatsCount = tables.reduce((acc, t) => acc + t.seats.filter((s) => s.status === "paid").length, 0);
  const baseMockRevenue = tables.reduce((acc, t) => {
    const paidInTable = t.seats.filter((s) => s.status === "paid").length;
    return acc + paidInTable * (activeZones[t.zoneId]?.pricePerSeat || 0);
  }, 0);
  const actualRevenue = tickets.filter((t) => !t.isSponsor).reduce((acc, t) => acc + t.totalAmount, 0);
  const totalSponsorValue = tickets.filter((t) => t.isSponsor).reduce((acc, t) => acc + (t.sponsorValue || 0), 0);
  const displayRevenue = actualRevenue > 0 ? actualRevenue : baseMockRevenue;
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [sponsorForm, setSponsorForm] = useState({ name: "", email: "", qtyStr: "" });
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const sponsorQty = parseInt(sponsorForm.qtyStr) || 0;
  const allocateSeats = (zoneId, requiredSeats, allTables) => {
    const zoneTables = allTables.filter((t) => t.zoneId === zoneId).map((t) => ({
      id: t.id,
      availSeats: t.seats.filter((s) => s.status === "available")
    }));
    const totalAvail = zoneTables.reduce((sum, t) => sum + t.availSeats.length, 0);
    if (totalAvail < requiredSeats) return null;
    let remaining = requiredSeats;
    const allocations = [];
    const remainder = requiredSeats % 10;
    if (remainder > 0) {
      const candidates = zoneTables.filter((t) => t.availSeats.length >= remainder);
      candidates.sort((a, b) => a.availSeats.length - remainder - (b.availSeats.length - remainder));
      let bestCandidate = candidates.find((c) => c.availSeats.length < 10);
      if (!bestCandidate && candidates.length > 0) {
        bestCandidate = candidates[0];
      }
      if (bestCandidate) {
        allocations.push({
          tableId: bestCandidate.id,
          seatIds: bestCandidate.availSeats.slice(0, remainder).map((s) => s.id)
        });
        bestCandidate.availSeats = bestCandidate.availSeats.slice(remainder);
        remaining -= remainder;
      }
    }
    zoneTables.sort((a, b) => b.availSeats.length - a.availSeats.length);
    for (const t of zoneTables) {
      if (remaining === 0) break;
      if (t.availSeats.length > 0) {
        const toTake = Math.min(t.availSeats.length, remaining);
        if (toTake > 0) {
          allocations.push({
            tableId: t.id,
            seatIds: t.availSeats.slice(0, toTake).map((s) => s.id)
          });
          t.availSeats = t.availSeats.slice(toTake);
          remaining -= toTake;
        }
      }
    }
    if (remaining > 0) return null;
    return allocations.reduce((acc, curr) => {
      const existing = acc.find((a) => a.tableId === curr.tableId);
      if (existing) {
        existing.seatIds = [...existing.seatIds, ...curr.seatIds];
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);
  };
  const allocationOptions = [];
  const specificTableOptions = [];
  if (sponsorQty > 0) {
    Object.keys(activeZones).forEach((zoneId) => {
      const plan = allocateSeats(zoneId, sponsorQty, tables);
      if (plan) {
        allocationOptions.push({
          type: "auto",
          zoneId,
          plan
        });
      }
    });
    tables.forEach((t) => {
      const avail = t.seats.filter((s) => s.status === "available");
      if (avail.length >= sponsorQty) {
        specificTableOptions.push({
          type: "specific",
          zoneId: t.zoneId,
          plan: [{ tableId: t.id, seatIds: avail.slice(0, sponsorQty).map((s) => s.id) }]
        });
      }
    });
  }
  const { drinkStats, userDrinkStats, drinkTotalRevenue } = useMemo(() => {
    const dStats = {};
    const udStats = [];
    let dRev = 0;
    const calcPrice = (drink, qty) => {
      if (!drink) return 0;
      if (config.isWholeStoreFree || drink.isFree) return 0;
      let paidQty = qty;
      if (drink.buyQty > 0 && drink.freeQty > 0) {
        const setSize = drink.buyQty + drink.freeQty;
        paidQty = Math.floor(qty / setSize) * drink.buyQty + Math.min(qty % setSize, drink.buyQty);
      }
      let total = paidQty * (drink.price || 0);
      if (drink.discountPercent > 0) total -= total * (drink.discountPercent / 100);
      if (drink.serviceChargePercent > 0) total += total * (drink.serviceChargePercent / 100);
      return total;
    };
    tickets.forEach((t) => {
      if (t.drinkHistory) {
        let userTotal = 0;
        Object.entries(t.drinkHistory).forEach(([dId, qty]) => {
          dStats[dId] = (dStats[dId] || 0) + qty;
          userTotal += qty;
          const d = config.drinks?.find((x) => x.id === dId);
          dRev += calcPrice(d, qty);
        });
        if (userTotal > 0) {
          udStats.push({ name: t.userName, total: userTotal, details: t.drinkHistory });
        }
      }
    });
    udStats.sort((a, b) => b.total - a.total);
    return { drinkStats: dStats, userDrinkStats: udStats, drinkTotalRevenue: dRev };
  }, [tickets, config.drinks]);
  return /* @__PURE__ */ jsxs("div", { className: "max-w-6xl mx-auto space-y-8 pb-20 print:space-y-4 print:pb-0 print:text-black", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-4 print:mb-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-3xl font-black text-slate-800", children: "\u0E41\u0E14\u0E0A\u0E1A\u0E2D\u0E23\u0E4C\u0E14 (Dashboard)" }),
        /* @__PURE__ */ jsx("p", { className: "text-slate-500 mt-1", children: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E41\u0E25\u0E30\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E30\u0E1A\u0E1A (Overview & Settings)" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => {
              if (window.confirm("\u0E04\u0E38\u0E13\u0E41\u0E19\u0E48\u0E43\u0E08\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E17\u0E35\u0E48\u0E08\u0E30\u0E25\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25? \u0E42\u0E15\u0E4A\u0E30\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E08\u0E30\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E31\u0E4B\u0E27\u0E08\u0E30\u0E16\u0E39\u0E01\u0E25\u0E1A\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14!")) {
                setMyTickets([]);
                setTables((prev) => prev.map((t) => ({
                  ...t,
                  seats: t.seats.map((s) => ({ ...s, status: "available", ticketId: void 0 }))
                })));
              }
            },
            className: "print:hidden flex items-center gap-2 bg-rose-100 hover:bg-rose-200 text-rose-600 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95",
            children: [
              /* @__PURE__ */ jsx(Trash2, { className: "w-5 h-5" }),
              " \u0E25\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E08\u0E2D\u0E07"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => window.print(),
            className: "print:hidden flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95",
            children: [
              /* @__PURE__ */ jsx(Printer, { className: "w-5 h-5" }),
              " \u0E1E\u0E34\u0E21\u0E1E\u0E4C / Export PDF"
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-4 border-b border-slate-200 mb-8 print:hidden", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setActiveTab("overview"),
          className: `pb-3 px-2 font-bold text-lg transition-colors border-b-4 ${activeTab === "overview" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`,
          children: "Overview & Settings"
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setActiveTab("emails"),
          className: `pb-3 px-2 font-bold text-lg transition-colors border-b-4 flex items-center gap-2 ${activeTab === "emails" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`,
          children: [
            /* @__PURE__ */ jsx(Mail, { className: "w-5 h-5" }),
            "Failed & Pending Emails",
            pendingEmails?.length ? /* @__PURE__ */ jsx("span", { className: "bg-primary text-white text-xs px-2 py-0.5 rounded-full", children: pendingEmails.length }) : null
          ]
        }
      ),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setActiveTab("notifications"),
          className: `pb-3 px-2 font-bold text-lg transition-colors border-b-4 flex items-center gap-2 ${activeTab === "notifications" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`,
          children: [
            /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }),
            "LINE / SMS Notifications"
          ]
        }
      )
    ] }),
    activeTab === "overview" ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: [
        /* @__PURE__ */ jsx(StatCard, { icon: /* @__PURE__ */ jsx(Users, { className: "w-6 h-6 text-blue-500" }), title: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E07 (Seats Sold)", value: `${paidSeatsCount} / ${totalSeats}`, bgColor: "bg-blue-50" }),
        /* @__PURE__ */ jsx(StatCard, { icon: /* @__PURE__ */ jsx(Banknote, { className: "w-6 h-6 text-emerald-500" }), title: "\u0E22\u0E2D\u0E14\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49 (Revenue)", value: `\u0E3F${displayRevenue.toLocaleString()}`, bgColor: "bg-emerald-50" }),
        /* @__PURE__ */ jsx(StatCard, { icon: /* @__PURE__ */ jsx(Gift, { className: "w-6 h-6 text-rose-500" }), title: "\u0E21\u0E39\u0E25\u0E04\u0E48\u0E32\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C (Comped)", value: `\u0E3F${totalSponsorValue.toLocaleString()}`, bgColor: "bg-rose-50" }),
        /* @__PURE__ */ jsx(StatCard, { icon: /* @__PURE__ */ jsx(MapIcon, { className: "w-6 h-6 text-purple-500" }), title: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E42\u0E15\u0E4A\u0E30 (Tables)", value: `${tables.length} \u0E42\u0E15\u0E4A\u0E30`, bgColor: "bg-purple-50" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-6 print:break-inside-avoid print:shadow-none print:border-slate-300", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center mb-6", children: [
            /* @__PURE__ */ jsx("h3", { className: "font-bold text-lg", children: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E02\u0E32\u0E22\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14" }),
            /* @__PURE__ */ jsxs("button", { onClick: () => setShowSponsorModal(true), className: "print:hidden text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all", children: [
              /* @__PURE__ */ jsx(Gift, { className: "w-3 h-3" }),
              " \u0E2D\u0E2D\u0E01\u0E1A\u0E31\u0E15\u0E23\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C"
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "space-y-4 max-h-[400px] overflow-y-auto pr-2 print:max-h-none print:overflow-visible", children: tickets.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-sm text-center py-10", children: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19" }) : tickets.map((t) => /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start p-3 hover:bg-slate-50 rounded-xl transition border border-slate-100 gap-3 print:break-inside-avoid print:border-slate-300", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
              /* @__PURE__ */ jsxs("p", { className: "font-bold text-slate-800 truncate", title: t.userName, children: [
                t.userName,
                " ",
                t.isSponsor && /* @__PURE__ */ jsx("span", { className: "text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md ml-1", children: "Sponsor" })
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-xs text-slate-500 mt-0.5 truncate", children: [
                "\u0E42\u0E15\u0E4A\u0E30 ",
                t.tableId,
                " \u2022 ",
                t.seatIds.length,
                " \u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E07"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-right shrink-0", children: [
              /* @__PURE__ */ jsxs("p", { className: `font-bold ${t.isSponsor ? "text-rose-600" : "text-emerald-600"}`, children: [
                "\u0E3F",
                t.totalAmount.toLocaleString()
              ] }),
              /* @__PURE__ */ jsx("span", { className: "text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium inline-block mt-1 print:border print:border-emerald-300", children: "\u0E23\u0E2D\u0E40\u0E0A\u0E47\u0E04\u0E2D\u0E34\u0E19" })
            ] })
          ] }, t.id)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "print:hidden bg-slate-900 rounded-3xl shadow-sm border border-slate-800 p-6 text-white flex flex-col relative overflow-hidden", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 p-8 opacity-10 pointer-events-none", children: /* @__PURE__ */ jsx(Monitor, { className: "w-48 h-48" }) }),
          /* @__PURE__ */ jsxs("h3", { className: "font-bold text-lg flex items-center gap-2 mb-2 relative z-10", children: [
            /* @__PURE__ */ jsx(Monitor, { className: "w-5 h-5 text-primary" }),
            " \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E2D LED (Big Screen)"
          ] }),
          /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-sm mb-8 relative z-10", children: "\u0E40\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E31\u0E1A\u0E09\u0E25\u0E32\u0E01\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E02\u0E36\u0E49\u0E19\u0E08\u0E2D\u0E41\u0E2D\u0E25\u0E2D\u0E35\u0E14\u0E35\u0E02\u0E19\u0E32\u0E14\u0E43\u0E2B\u0E0D\u0E48\u0E43\u0E19\u0E42\u0E23\u0E07\u0E41\u0E23\u0E21" }),
          /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col items-center justify-center relative z-10 mt-auto pt-6", children: /* @__PURE__ */ jsx("button", { onClick: onOpenLuckyDraw, className: "bg-gradient-to-r from-primary to-orange-500 hover:from-primary-hover hover:to-orange-600 text-white w-full py-4 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02]", children: "\u0E40\u0E1B\u0E34\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E31\u0E1A\u0E09\u0E25\u0E32\u0E01 (Launch LED Mode)" }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300", children: [
        /* @__PURE__ */ jsxs("h3", { className: "font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx(BarChart3, { className: "w-5 h-5 text-indigo-500" }),
          " \u0E2A\u0E23\u0E38\u0E1B\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21 (Drinks Consumption Report)"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "print:break-inside-avoid", children: [
            /* @__PURE__ */ jsxs("h4", { className: "font-semibold text-slate-800 mb-4 flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(GlassWater, { className: "w-4 h-4" }),
              " \u0E22\u0E2D\u0E14\u0E41\u0E08\u0E01\u0E08\u0E48\u0E32\u0E22\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
              Object.keys(drinkStats).length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300", children: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E41\u0E25\u0E01\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21" }) : config.drinks?.map((drink) => {
                const qty = drinkStats[drink.id] || 0;
                if (qty === 0) return null;
                return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-300", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-medium text-slate-700", children: drink.name }),
                  /* @__PURE__ */ jsxs("span", { className: "text-indigo-600 font-black text-lg bg-indigo-100 px-3 py-1 rounded-lg print:border print:border-indigo-300", children: [
                    qty,
                    " \u0E41\u0E01\u0E49\u0E27/\u0E0A\u0E34\u0E49\u0E19"
                  ] })
                ] }, drink.id);
              }),
              drinkTotalRevenue > 0 && /* @__PURE__ */ jsxs("div", { className: "mt-4 pt-4 border-t border-slate-200 flex items-center justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-800", children: "\u0E22\u0E2D\u0E14\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21\u0E23\u0E27\u0E21:" }),
                /* @__PURE__ */ jsxs("span", { className: "font-black text-emerald-600 text-xl", children: [
                  "\u0E3F",
                  drinkTotalRevenue.toLocaleString()
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "print:break-inside-avoid", children: [
            /* @__PURE__ */ jsx("h4", { className: "font-semibold text-slate-800 mb-4 flex items-center gap-2", children: "\u{1F3C6} \u0E2A\u0E23\u0E38\u0E1B\u0E01\u0E32\u0E23\u0E14\u0E37\u0E48\u0E21\u0E23\u0E32\u0E22\u0E1A\u0E38\u0E04\u0E04\u0E25 (Top Consumers)" }),
            /* @__PURE__ */ jsx("div", { className: "space-y-3", children: userDrinkStats.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300", children: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E41\u0E25\u0E01" }) : userDrinkStats.slice(0, 5).map((u, idx) => /* @__PURE__ */ jsxs("div", { className: "p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex items-start gap-3 print:shadow-none print:border-slate-300", children: [
              /* @__PURE__ */ jsxs("div", { className: "w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400 shrink-0 print:border print:border-slate-300", children: [
                "#",
                idx + 1
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-800 truncate", children: u.name }),
                /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1 mt-1.5", children: Object.entries(u.details).map(([dId, qty]) => {
                  const dName = config.drinks?.find((x) => x.id === dId)?.name || "Unknown";
                  return /* @__PURE__ */ jsxs("span", { className: "text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md break-words max-w-full print:border print:border-slate-300", children: [
                    dName,
                    ": ",
                    qty
                  ] }, dId);
                }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "shrink-0 text-right", children: [
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 mb-1", children: "\u0E23\u0E27\u0E21" }),
                /* @__PURE__ */ jsx("p", { className: "font-black text-primary text-xl leading-none", children: u.total })
              ] })
            ] }, idx)) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:break-inside-avoid print:shadow-none print:border-slate-300", children: [
        /* @__PURE__ */ jsxs("h3", { className: "font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx(BarChart3, { className: "w-5 h-5 text-amber-500" }),
          " \u0E1C\u0E25\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E36\u0E07\u0E1E\u0E2D\u0E43\u0E08 (Satisfaction Survey)"
        ] }),
        !surveys || surveys.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-sm py-4 bg-slate-50 rounded-xl text-center print:bg-white print:border print:border-slate-300", children: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19" }) : /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: SURVEY_TOPICS.map((topic) => {
            const scores = surveys.map((s) => s.ratings[topic.id]).filter((v) => v != null);
            const count = scores.length;
            const avg = count ? scores.reduce((a, b) => a + b, 0) / count : 0;
            const percent = avg / 3 * 100;
            let color = "bg-rose-500";
            if (avg >= 2.5) color = "bg-emerald-500";
            else if (avg >= 1.5) color = "bg-amber-500";
            return /* @__PURE__ */ jsxs("div", { className: "p-4 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:border-slate-300", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-2", children: [
                /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-800 flex items-center gap-2", children: topic.label }),
                /* @__PURE__ */ jsxs("span", { className: "font-black text-slate-800 text-xl", children: [
                  avg.toFixed(1),
                  " ",
                  /* @__PURE__ */ jsx("span", { className: "text-sm font-medium text-slate-400", children: "/ 3.0" })
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-200 rounded-full h-2.5 mb-1 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: `h-2.5 rounded-full ${color}`, style: { width: `${Math.max(0, Math.min(100, percent))}%` } }) }),
              /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-slate-500 text-right", children: [
                "\u0E08\u0E32\u0E01\u0E1C\u0E39\u0E49\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19 ",
                count,
                " \u0E17\u0E48\u0E32\u0E19"
              ] })
            ] }, topic.id);
          }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h4", { className: "font-semibold text-slate-800 mb-4", children: "\u{1F4AC} \u0E02\u0E49\u0E2D\u0E40\u0E2A\u0E19\u0E2D\u0E41\u0E19\u0E30\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21 (Recent Feedback)" }),
            /* @__PURE__ */ jsx("div", { className: "space-y-3 max-h-[300px] overflow-y-auto pr-2", children: surveys.filter((s) => s.comment?.trim()).length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-sm italic", children: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E40\u0E2A\u0E19\u0E2D\u0E41\u0E19\u0E30" }) : surveys.filter((s) => s.comment?.trim()).slice(-10).reverse().map((s) => /* @__PURE__ */ jsxs("div", { className: "p-4 bg-white border border-slate-200 rounded-xl shadow-sm", children: [
              /* @__PURE__ */ jsxs("p", { className: "text-slate-700 italic", children: [
                '"',
                s.comment,
                '"'
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-[10px] text-slate-400 mt-2 text-right", children: [
                "\u0E08\u0E32\u0E01\u0E1A\u0E31\u0E15\u0E23 #",
                s.ticketId
              ] })
            ] }, s.id)) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "print:hidden bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6", children: [
        /* @__PURE__ */ jsxs("h3", { className: "font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsx(Settings, { className: "w-5 h-5 text-slate-500" }),
          " \u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E23\u0E30\u0E1A\u0E1A & \u0E18\u0E35\u0E21\u0E2B\u0E19\u0E49\u0E32\u0E07\u0E32\u0E19 (Theme Settings)"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("h4", { className: "font-semibold text-slate-800 flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(ImageIcon, { className: "w-4 h-4" }),
              " \u0E41\u0E1A\u0E19\u0E40\u0E19\u0E2D\u0E23\u0E4C\u0E07\u0E32\u0E19 (KV Banner)"
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center mb-1", children: [
                /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700", children: "\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E (Image URL)" }),
                (config.bannerUrl || "").includes("drive.google.com/file/d") && /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => {
                      const match = config.bannerUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                      if (match && match[1]) {
                        setConfig({ ...config, bannerUrl: `https://lh3.googleusercontent.com/d/${match[1]}` });
                      }
                    },
                    className: "text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded-md font-medium transition-colors flex items-center gap-1",
                    children: [
                      /* @__PURE__ */ jsx(RefreshCw, { className: "w-3 h-3" }),
                      " \u0E41\u0E1B\u0E25\u0E07\u0E25\u0E34\u0E07\u0E01\u0E4C Google Drive"
                    ]
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: config.bannerUrl,
                  onChange: (e) => setConfig({ ...config, bannerUrl: e.target.value }),
                  className: "w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none",
                  placeholder: "https://..."
                }
              ),
              /* @__PURE__ */ jsxs("p", { className: "mt-2 text-xs font-medium text-slate-500 bg-blue-50/50 p-2 rounded-lg border border-blue-100", children: [
                "\u{1F4A1} ",
                /* @__PURE__ */ jsx("span", { className: "font-semibold text-blue-700", children: "\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E17\u0E35\u0E21\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A:" }),
                " \u0E02\u0E19\u0E32\u0E14\u0E41\u0E1A\u0E19\u0E40\u0E19\u0E2D\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E21\u0E04\u0E37\u0E2D ",
                /* @__PURE__ */ jsx("strong", { className: "text-blue-800", children: "1200 x 400 \u0E1E\u0E34\u0E01\u0E40\u0E0B\u0E25" }),
                " (\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2A\u0E48\u0E27\u0E19 3:1)"
              ] })
            ] }),
            config.bannerUrl && /* @__PURE__ */ jsxs("div", { className: "rounded-xl overflow-hidden shadow-sm border border-slate-100 h-32 bg-slate-50 relative", children: [
              /* @__PURE__ */ jsx("img", { src: config.bannerUrl, referrerPolicy: "no-referrer", className: "w-full h-full object-cover", alt: "Preview KV" }),
              /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-4", children: /* @__PURE__ */ jsx("p", { className: "text-white font-bold text-sm", children: "Preview" }) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 mt-2", children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  id: "hideEventNameOnBanner",
                  checked: config.hideEventNameOnBanner || false,
                  onChange: (e) => setConfig({ ...config, hideEventNameOnBanner: e.target.checked }),
                  className: "w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                }
              ),
              /* @__PURE__ */ jsx("label", { htmlFor: "hideEventNameOnBanner", className: "text-sm text-slate-700 cursor-pointer", children: "\u0E0B\u0E48\u0E2D\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E19\u0E41\u0E1A\u0E19\u0E40\u0E19\u0E2D\u0E23\u0E4C (\u0E43\u0E0A\u0E49\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E19\u0E40\u0E19\u0E2D\u0E23\u0E4C\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D\u0E2D\u0E22\u0E39\u0E48\u0E41\u0E25\u0E49\u0E27)" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("h4", { className: "font-semibold text-slate-800 flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(LayoutGrid, { className: "w-4 h-4" }),
              " \u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E1C\u0E31\u0E07\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E42\u0E15\u0E4A\u0E30 (Layout Style)"
            ] }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: [
              { id: "banquet", name: "Banquet Style" },
              { id: "cabaret", name: "Cabaret Style" },
              { id: "u-shape", name: "U-Shape Style" },
              { id: "theatre", name: "Theatre Style" },
              { id: "classroom", name: "Classroom Style" },
              { id: "boardroom", name: "Boardroom Style" },
              { id: "chevron", name: "Chevron Style" },
              { id: "circle-of-chairs", name: "Circle of Chairs" }
            ].map((layout) => /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => setConfig({ ...config, layoutStyle: layout.id }),
                className: `flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${config.layoutStyle === layout.id ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50"}`,
                children: [
                  /* @__PURE__ */ jsx(LayoutIcon, { type: layout.id, color: config.layoutStyle === layout.id ? config.themeColor : "#cbd5e1" }),
                  /* @__PURE__ */ jsx("span", { className: "font-bold text-[13px] text-center mt-2", children: layout.name })
                ]
              },
              layout.id
            )) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("h4", { className: "font-semibold text-slate-800 flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(Palette, { className: "w-4 h-4" }),
              " \u0E1B\u0E23\u0E31\u0E1A\u0E41\u0E15\u0E48\u0E07\u0E2A\u0E35 & \u0E0A\u0E37\u0E48\u0E2D (Branding)"
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E0A\u0E37\u0E48\u0E2D\u0E01\u0E34\u0E08\u0E01\u0E23\u0E23\u0E21 (Event Name)" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: config.eventName,
                  onChange: (e) => setConfig({ ...config, eventName: e.target.value }),
                  className: "w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E01\u0E34\u0E08\u0E01\u0E23\u0E23\u0E21 (Event Date)" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "date",
                    value: config.eventDate || "",
                    onChange: (e) => setConfig({ ...config, eventDate: e.target.value }),
                    className: "w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E40\u0E27\u0E25\u0E32 (Event Time)" }),
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "time",
                    value: config.eventTime || "",
                    onChange: (e) => setConfig({ ...config, eventTime: e.target.value }),
                    className: "w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 p-4 rounded-xl border border-slate-100", children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700 mb-2", children: "\u0E23\u0E30\u0E1A\u0E38\u0E1E\u0E34\u0E01\u0E31\u0E14\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E07\u0E32\u0E19 (Location)" }),
              /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mb-3", children: "\u0E43\u0E0A\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E02\u0E49\u0E32\u0E17\u0E33\u0E41\u0E1A\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 (\u0E40\u0E0A\u0E47\u0E04\u0E27\u0E48\u0E32\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E23\u0E31\u0E28\u0E21\u0E35 2 \u0E01\u0E21. \u0E02\u0E2D\u0E07\u0E07\u0E32\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48)" }),
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "\u0E25\u0E30\u0E15\u0E34\u0E08\u0E39\u0E14 (Latitude)" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "number",
                      step: "any",
                      value: config.eventLat || "",
                      onChange: (e) => setConfig({ ...config, eventLat: e.target.value }),
                      className: "w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-primary text-sm",
                      placeholder: "Ex. 13.7563"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("label", { className: "block text-xs font-medium text-slate-600 mb-1", children: "\u0E25\u0E2D\u0E07\u0E08\u0E34\u0E08\u0E39\u0E14 (Longitude)" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "number",
                      step: "any",
                      value: config.eventLng || "",
                      onChange: (e) => setConfig({ ...config, eventLng: e.target.value }),
                      className: "w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-primary text-sm",
                      placeholder: "Ex. 100.5018"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  onClick: () => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((position) => {
                        setConfig({ ...config, eventLat: position.coords.latitude.toString(), eventLng: position.coords.longitude.toString() });
                      }, (err) => {
                        if (err.code === err.PERMISSION_DENIED) {
                          alert("\u0E23\u0E30\u0E1A\u0E1A\u0E16\u0E39\u0E01\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E01\u0E32\u0E23\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\n\n\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E14\u0E36\u0E07\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E14\u0E22\u0E34\u0E19\u0E22\u0E2D\u0E21 (Allow Location) \u0E1A\u0E19\u0E1B\u0E4A\u0E2D\u0E1B\u0E2D\u0E31\u0E1B\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E44\u0E1B\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E19\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C (Site Settings -> Location)");
                        } else {
                          alert("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E14\u0E36\u0E07\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E44\u0E14\u0E49: " + err.message);
                        }
                      });
                    } else {
                      alert("\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E14\u0E36\u0E07\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07");
                    }
                  },
                  className: "mt-3 text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-1",
                  children: [
                    /* @__PURE__ */ jsx(MapIcon, { className: "w-3 h-3" }),
                    " \u0E14\u0E36\u0E07\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19"
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E2A\u0E35\u0E18\u0E35\u0E21\u0E2B\u0E25\u0E31\u0E01 (Primary Brand Color)" }),
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "color",
                    value: config.themeColor,
                    onChange: (e) => setConfig({ ...config, themeColor: e.target.value }),
                    className: "w-14 h-14 rounded-lg cursor-pointer flex-shrink-0 bg-transparent border-0 p-0"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mb-2", children: "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E35\u0E04\u0E27\u0E32\u0E21\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2A\u0E39\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E0A\u0E49\u0E01\u0E31\u0E1A\u0E1B\u0E38\u0E48\u0E21 \u0E40\u0E21\u0E19\u0E39 \u0E41\u0E25\u0E30\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E15\u0E48\u0E32\u0E07\u0E46 \u0E17\u0E31\u0E49\u0E07\u0E23\u0E30\u0E1A\u0E1A (\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E17\u0E38\u0E01\u0E40\u0E09\u0E14\u0E2A\u0E35)" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex gap-2 items-center", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-[10px] font-medium text-slate-400", children: "Preview:" }),
                    /* @__PURE__ */ jsx("div", { className: "w-6 h-6 rounded-md bg-primary shadow-sm", title: "Primary Color" }),
                    /* @__PURE__ */ jsx("div", { className: "w-6 h-6 rounded-md bg-primary-hover shadow-sm", title: "Hover Color (Darker)" }),
                    /* @__PURE__ */ jsx("div", { className: "w-6 h-6 rounded-md bg-primary-light border shadow-sm", title: "Light Background" })
                  ] })
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "pt-2 border-t border-slate-100", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-1", children: [
                /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-slate-700", children: "\u0E2A\u0E35\u0E18\u0E35\u0E21\u0E23\u0E2D\u0E07 (Secondary Color)" }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500", children: "\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19:" }),
                  /* @__PURE__ */ jsx("input", { type: "checkbox", checked: config.enableSecondaryColor, onChange: (e) => setConfig({ ...config, enableSecondaryColor: e.target.checked }), className: "rounded text-primary h-4 w-4" })
                ] })
              ] }),
              config.enableSecondaryColor && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "color",
                    value: config.secondaryColor,
                    onChange: (e) => setConfig({ ...config, secondaryColor: e.target.value }),
                    className: "w-10 h-10 rounded-lg cursor-pointer flex-shrink-0 bg-transparent border-0 p-0"
                  }
                ),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E35\u0E43\u0E19\u0E1A\u0E32\u0E07\u0E2A\u0E48\u0E27\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E21\u0E34\u0E15\u0E34\u0E43\u0E2B\u0E49\u0E15\u0E31\u0E27\u0E07\u0E32\u0E19" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "pt-2 border-t border-slate-100", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-1", children: [
                /* @__PURE__ */ jsx("label", { className: "text-sm font-medium text-slate-700", children: "\u0E2A\u0E35\u0E1E\u0E34\u0E40\u0E28\u0E29 (Accent Color)" }),
                /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500", children: "\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19:" }),
                  /* @__PURE__ */ jsx("input", { type: "checkbox", checked: config.enableAccentColor, onChange: (e) => setConfig({ ...config, enableAccentColor: e.target.checked }), className: "rounded text-primary h-4 w-4" })
                ] })
              ] }),
              config.enableAccentColor && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "color",
                    value: config.accentColor,
                    onChange: (e) => setConfig({ ...config, accentColor: e.target.value }),
                    className: "w-10 h-10 rounded-lg cursor-pointer flex-shrink-0 bg-transparent border-0 p-0"
                  }
                ),
                /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500", children: "\u0E43\u0E0A\u0E49\u0E40\u0E19\u0E49\u0E19\u0E22\u0E49\u0E33\u0E08\u0E38\u0E14\u0E17\u0E35\u0E48\u0E2A\u0E33\u0E04\u0E31\u0E0D \u0E2B\u0E23\u0E37\u0E2D\u0E08\u0E31\u0E14\u0E43\u0E2B\u0E49\u0E14\u0E36\u0E07\u0E14\u0E39\u0E14\u0E2A\u0E32\u0E22\u0E15\u0E32\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21" })
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 pt-8 border-t border-slate-100", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4", children: [
            /* @__PURE__ */ jsx("h4", { className: "font-semibold text-slate-800 flex items-center gap-2", children: "\u{1F379} \u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E40\u0E21\u0E19\u0E39\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21 (Drinks Menu)" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg", children: [
              /* @__PURE__ */ jsx("span", { className: "text-sm font-bold text-slate-700", children: "\u0E40\u0E2B\u0E21\u0E32\u0E23\u0E49\u0E32\u0E19 (\u0E1F\u0E23\u0E35\u0E17\u0E38\u0E01\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23):" }),
              /* @__PURE__ */ jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [
                /* @__PURE__ */ jsx("input", { type: "checkbox", className: "sr-only peer", checked: !!config.isWholeStoreFree, onChange: (e) => setConfig({ ...config, isWholeStoreFree: e.target.checked }) }),
                /* @__PURE__ */ jsx("div", { className: "w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
            config.drinks?.map((drink, idx) => /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm space-y-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
                /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "text",
                    value: drink.name,
                    onChange: (e) => {
                      const newDrinks = [...config.drinks];
                      newDrinks[idx].name = e.target.value;
                      setConfig({ ...config, drinks: newDrinks });
                    },
                    className: "flex-1 min-w-[150px] px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none",
                    placeholder: "\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21"
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "relative w-28", children: [
                  /* @__PURE__ */ jsx("span", { className: "absolute left-3 top-2 text-slate-400 font-medium font-sans text-sm", children: "\u0E3F" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "number",
                      min: "0",
                      value: drink.price || 0,
                      onChange: (e) => {
                        const newDrinks = [...config.drinks];
                        newDrinks[idx].price = parseInt(e.target.value) || 0;
                        setConfig({ ...config, drinks: newDrinks });
                      },
                      className: "w-full pl-6 pr-2 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none",
                      placeholder: "\u0E23\u0E32\u0E04\u0E32"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs(
                  "select",
                  {
                    value: drink.color,
                    onChange: (e) => {
                      const newDrinks = [...config.drinks];
                      newDrinks[idx].color = e.target.value;
                      setConfig({ ...config, drinks: newDrinks });
                    },
                    className: "px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white",
                    children: [
                      /* @__PURE__ */ jsx("option", { value: "blue", children: "Blue (\u0E19\u0E49\u0E33\u0E40\u0E07\u0E34\u0E19)" }),
                      /* @__PURE__ */ jsx("option", { value: "amber", children: "Amber (\u0E2A\u0E49\u0E21/\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07)" }),
                      /* @__PURE__ */ jsx("option", { value: "emerald", children: "Emerald (\u0E40\u0E02\u0E35\u0E22\u0E27)" }),
                      /* @__PURE__ */ jsx("option", { value: "rose", children: "Rose (\u0E41\u0E14\u0E07/\u0E0A\u0E21\u0E1E\u0E39)" }),
                      /* @__PURE__ */ jsx("option", { value: "purple", children: "Purple (\u0E21\u0E48\u0E27\u0E07)" })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    onClick: () => {
                      const newDrinks = config.drinks.filter((_, i) => i !== idx);
                      setConfig({ ...config, drinks: newDrinks });
                    },
                    className: "p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition",
                    children: "\u0E25\u0E1A"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/60", children: [
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5 col-span-2 sm:col-span-1", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-bold tracking-wide text-slate-500 uppercase", children: "\u0E42\u0E1B\u0E23\u0E42\u0E21\u0E0A\u0E31\u0E48\u0E19\u0E41\u0E16\u0E21\u0E1F\u0E23\u0E35" }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
                    /* @__PURE__ */ jsx("span", { className: "text-sm text-slate-600", children: "\u0E0B\u0E37\u0E49\u0E2D" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "number",
                        min: "0",
                        value: drink.buyQty || "",
                        placeholder: "0",
                        onChange: (e) => {
                          const newDrinks = [...config.drinks];
                          newDrinks[idx].buyQty = parseInt(e.target.value) || 0;
                          setConfig({ ...config, drinks: newDrinks });
                        },
                        className: "w-12 px-2 py-1 text-sm rounded-md border border-slate-200 text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "text-sm text-slate-600", children: "\u0E41\u0E16\u0E21" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "number",
                        min: "0",
                        value: drink.freeQty || "",
                        placeholder: "0",
                        onChange: (e) => {
                          const newDrinks = [...config.drinks];
                          newDrinks[idx].freeQty = parseInt(e.target.value) || 0;
                          setConfig({ ...config, drinks: newDrinks });
                        },
                        className: "w-12 px-2 py-1 text-sm rounded-md border border-slate-200 text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-bold tracking-wide text-slate-500 uppercase", children: "\u0E2A\u0E48\u0E27\u0E19\u0E25\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21 (%)" }),
                  /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-[90px]", children: [
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "number",
                        min: "0",
                        max: "100",
                        value: drink.discountPercent || "",
                        placeholder: "0",
                        onChange: (e) => {
                          const newDrinks = [...config.drinks];
                          newDrinks[idx].discountPercent = parseInt(e.target.value) || 0;
                          setConfig({ ...config, drinks: newDrinks });
                        },
                        className: "w-full pr-6 pl-3 py-1.5 text-sm rounded-md border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "absolute right-2 top-1.5 text-slate-400 text-xs font-bold", children: "%" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-bold tracking-wide text-slate-500 uppercase", children: "Service Charge" }),
                  /* @__PURE__ */ jsxs("div", { className: "relative w-full max-w-[90px]", children: [
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "number",
                        min: "0",
                        max: "100",
                        value: drink.serviceChargePercent || "",
                        placeholder: "0",
                        onChange: (e) => {
                          const newDrinks = [...config.drinks];
                          newDrinks[idx].serviceChargePercent = parseInt(e.target.value) || 0;
                          setConfig({ ...config, drinks: newDrinks });
                        },
                        className: "w-full pr-6 pl-3 py-1.5 text-sm rounded-md border border-slate-200 outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white"
                      }
                    ),
                    /* @__PURE__ */ jsx("span", { className: "absolute right-2 top-1.5 text-slate-400 text-xs font-bold", children: "%" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5 items-start", children: [
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-bold tracking-wide text-slate-500 uppercase", children: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E41\u0E08\u0E01\u0E1F\u0E23\u0E35 (0\u0E3F)" }),
                  /* @__PURE__ */ jsxs("label", { className: "relative inline-flex items-center cursor-pointer mt-1", children: [
                    /* @__PURE__ */ jsx("input", { type: "checkbox", className: "sr-only peer", checked: !!drink.isFree, onChange: (e) => {
                      const newDrinks = [...config.drinks];
                      newDrinks[idx].isFree = e.target.checked;
                      setConfig({ ...config, drinks: newDrinks });
                    } }),
                    /* @__PURE__ */ jsx("div", { className: "w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" })
                  ] })
                ] })
              ] })
            ] }, drink.id)),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => {
                  const newDrinks = [...config.drinks || [], { id: Date.now().toString(), name: "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21\u0E43\u0E2B\u0E21\u0E48", color: "blue" }];
                  setConfig({ ...config, drinks: newDrinks });
                },
                className: "text-primary font-medium text-sm hover:underline px-2",
                children: "+ \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E21\u0E19\u0E39\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E37\u0E48\u0E21"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 pt-8 border-t border-slate-100 print:hidden", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4", children: [
            /* @__PURE__ */ jsx("h4", { className: "font-semibold text-slate-800 flex items-center gap-2", children: "\u{1F39F}\uFE0F \u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E42\u0E0B\u0E19\u0E41\u0E25\u0E30\u0E23\u0E32\u0E04\u0E32 (Zones & Pricing)" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg", children: [
                /* @__PURE__ */ jsx("span", { className: "text-sm font-bold text-slate-700", children: "\u0E40\u0E2B\u0E21\u0E32\u0E1A\u0E31\u0E15\u0E23 (\u0E1F\u0E23\u0E35\u0E17\u0E38\u0E01\u0E42\u0E0B\u0E19):" }),
                /* @__PURE__ */ jsxs("label", { className: "relative inline-flex items-center cursor-pointer", children: [
                  /* @__PURE__ */ jsx("input", { type: "checkbox", className: "sr-only peer", checked: !!config.isTicketFree, onChange: (e) => setConfig({ ...config, isTicketFree: e.target.checked }) }),
                  /* @__PURE__ */ jsx("div", { className: "w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" })
                ] })
              ] }),
              !editingZones ? /* @__PURE__ */ jsxs("button", { onClick: () => setEditingZones(true), className: "text-primary hover:underline text-sm font-medium flex items-center gap-1", children: [
                /* @__PURE__ */ jsx(Edit2, { className: "w-4 h-4" }),
                " \u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E0B\u0E19"
              ] }) : /* @__PURE__ */ jsxs("button", { onClick: () => {
                setEditingZones(false);
                setConfig({ ...config, zones: priceForm, zoneCounts: zoneForm });
                if (setTables) {
                  setTables(generateInitialTables(zoneForm, priceForm));
                }
              }, className: "bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all transform active:scale-95", children: [
                /* @__PURE__ */ jsx(Save, { className: "w-4 h-4" }),
                " \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E41\u0E25\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1C\u0E31\u0E07\u0E42\u0E15\u0E4A\u0E30\u0E43\u0E2B\u0E21\u0E48"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            Object.keys(priceForm).map((zone) => {
              const zCount = zoneForm[zone] || 0;
              return /* @__PURE__ */ jsxs("div", { className: "flex flex-col bg-slate-50 rounded-xl border border-slate-100 relative", children: [
                /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-4", children: [
                  /* @__PURE__ */ jsx("div", { className: "sm:col-span-3", children: editingZones ? /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "text",
                      value: priceForm[zone]?.name || "",
                      onChange: (e) => setPriceForm({ ...priceForm, [zone]: { ...priceForm[zone], name: e.target.value } }),
                      className: "w-full px-2 py-1 rounded-md text-xs font-bold border border-slate-200"
                    }
                  ) : /* @__PURE__ */ jsx("span", { className: `inline-block px-3 py-1 rounded-full text-xs font-bold border ${activeZones[zone]?.colorClass || ""}`, children: activeZones[zone]?.name }) }),
                  /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
                    /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-bold text-slate-500 mb-1", children: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E42\u0E15\u0E4A\u0E30" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "number",
                        min: "0",
                        disabled: !editingZones,
                        value: editingZones ? zCount : config.zoneCounts?.[zone] || 0,
                        onChange: (e) => setZoneForm({ ...zoneForm, [zone]: parseInt(e.target.value) || 0 }),
                        className: "w-full px-2 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
                    /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-bold text-slate-500 mb-1", children: "\u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E07/\u0E42\u0E15\u0E4A\u0E30" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "number",
                        min: "1",
                        disabled: !editingZones,
                        value: editingZones ? priceForm[zone]?.seatsPerTable || 10 : activeZones[zone]?.seatsPerTable || 10,
                        onChange: (e) => setPriceForm({ ...priceForm, [zone]: { ...priceForm[zone], seatsPerTable: parseInt(e.target.value) || 10 } }),
                        className: "w-full px-2 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "sm:col-span-3", children: [
                    /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-bold text-slate-500 mb-1", children: "\u0E23\u0E32\u0E04\u0E32/\u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E07" }),
                    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                      /* @__PURE__ */ jsx("span", { className: "absolute left-3 top-2 text-slate-400 font-medium font-sans text-sm", children: "\u0E3F" }),
                      /* @__PURE__ */ jsx(
                        "input",
                        {
                          type: "number",
                          min: "0",
                          disabled: !editingZones,
                          value: editingZones ? priceForm[zone]?.pricePerSeat : activeZones[zone]?.pricePerSeat || 0,
                          onChange: (e) => setPriceForm({ ...priceForm, [zone]: { ...priceForm[zone], pricePerSeat: parseInt(e.target.value) || 0 } }),
                          className: "w-full pl-6 pr-2 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                        }
                      )
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "sm:col-span-1 hidden" }),
                  editingZones && /* @__PURE__ */ jsx("div", { className: "sm:col-span-2 text-right", children: /* @__PURE__ */ jsx("button", { onClick: () => {
                    const newPriceForm = { ...priceForm };
                    delete newPriceForm[zone];
                    setPriceForm(newPriceForm);
                    const newZoneForm = { ...zoneForm };
                    delete newZoneForm[zone];
                    setZoneForm(newZoneForm);
                  }, className: "text-rose-500 hover:text-white hover:bg-rose-500 p-2 text-xs font-bold w-full h-[46px] mt-[18px] flex items-center justify-center bg-rose-50 rounded-xl transition-colors", children: "\u0E25\u0E1A" }) })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200 mt-0 shadow-sm relative z-10 w-[calc(100%-1rem)] mx-auto top-[-0.75rem] mb-[-0.75rem]", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-bold text-slate-500 mb-1", children: "1. \u0E18\u0E19\u0E32\u0E04\u0E32\u0E23" }),
                    /* @__PURE__ */ jsxs(
                      "select",
                      {
                        disabled: !editingZones,
                        value: editingZones ? priceForm[zone]?.bankName : activeZones[zone]?.bankName || "",
                        onChange: (e) => setPriceForm({ ...priceForm, [zone]: { ...priceForm[zone], bankName: e.target.value } }),
                        className: "w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500",
                        children: [
                          /* @__PURE__ */ jsx("option", { value: "", children: "-- \u0E40\u0E25\u0E37\u0E2D\u0E01 --" }),
                          /* @__PURE__ */ jsx("option", { value: "KBANK", children: "\u0E01\u0E2A\u0E34\u0E01\u0E23\u0E44\u0E17\u0E22" }),
                          /* @__PURE__ */ jsx("option", { value: "SCB", children: "\u0E44\u0E17\u0E22\u0E1E\u0E32\u0E13\u0E34\u0E0A\u0E22\u0E4C" }),
                          /* @__PURE__ */ jsx("option", { value: "BBL", children: "\u0E01\u0E23\u0E38\u0E07\u0E40\u0E17\u0E1E" }),
                          /* @__PURE__ */ jsx("option", { value: "KTB", children: "\u0E01\u0E23\u0E38\u0E07\u0E44\u0E17\u0E22" }),
                          /* @__PURE__ */ jsx("option", { value: "BAY", children: "\u0E01\u0E23\u0E38\u0E07\u0E28\u0E23\u0E35\u0E2F" }),
                          /* @__PURE__ */ jsx("option", { value: "TTB", children: "\u0E17\u0E35\u0E17\u0E35\u0E1A\u0E35" }),
                          /* @__PURE__ */ jsx("option", { value: "GSB", children: "\u0E2D\u0E2D\u0E21\u0E2A\u0E34\u0E19" }),
                          /* @__PURE__ */ jsx("option", { value: "PROMPTPAY", children: "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E1E\u0E22\u0E4C" }),
                          /* @__PURE__ */ jsx("option", { value: "OTHER", children: "\u0E2D\u0E37\u0E48\u0E19\u0E46" })
                        ]
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-bold text-slate-500 mb-1", children: "2. \u0E40\u0E25\u0E02\u0E1A\u0E31\u0E0D\u0E0A\u0E35 / \u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E1E\u0E22\u0E4C" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "text",
                        disabled: !editingZones,
                        value: editingZones ? priceForm[zone]?.bankAccount : activeZones[zone]?.bankAccount || "",
                        onChange: (e) => setPriceForm({ ...priceForm, [zone]: { ...priceForm[zone], bankAccount: e.target.value } }),
                        className: "w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500",
                        placeholder: "012-3..."
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("label", { className: "block text-[10px] font-bold text-slate-500 mb-1", children: "3. \u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E31\u0E0D\u0E0A\u0E35" }),
                    /* @__PURE__ */ jsx(
                      "input",
                      {
                        type: "text",
                        disabled: !editingZones,
                        value: editingZones ? priceForm[zone]?.bankAccountName : activeZones[zone]?.bankAccountName || "",
                        onChange: (e) => setPriceForm({ ...priceForm, [zone]: { ...priceForm[zone], bankAccountName: e.target.value } }),
                        className: "w-full px-2 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none disabled:bg-slate-50 disabled:text-slate-500",
                        placeholder: "\u0E19\u0E32\u0E22\u0E43\u0E08\u0E01\u0E25\u0E49\u0E32..."
                      }
                    )
                  ] })
                ] }),
                /* @__PURE__ */ jsx("div", { className: "hidden" })
              ] }, zone);
            }),
            editingZones && /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center bg-amber-50 text-amber-800 p-3 rounded-lg text-xs border border-amber-200", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-2", children: [
                /* @__PURE__ */ jsx(RefreshCw, { className: "w-4 h-4 shrink-0 mt-0.5" }),
                /* @__PURE__ */ jsxs("p", { children: [
                  /* @__PURE__ */ jsx("strong", { children: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E23\u0E23\u0E30\u0E27\u0E31\u0E07:" }),
                  " \u0E01\u0E32\u0E23\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E41\u0E25\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1C\u0E31\u0E07\u0E42\u0E15\u0E4A\u0E30\u0E43\u0E2B\u0E21\u0E48\u0E08\u0E30\u0E17\u0E33\u0E01\u0E32\u0E23\u0E25\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E08\u0E2D\u0E07\u0E08\u0E33\u0E25\u0E2D\u0E07\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 (\u0E1C\u0E31\u0E07\u0E08\u0E30\u0E16\u0E39\u0E01\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E08\u0E33\u0E19\u0E27\u0E19\u0E42\u0E15\u0E4A\u0E30\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E04\u0E38\u0E13\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32)"
                ] })
              ] }),
              /* @__PURE__ */ jsx("button", { onClick: () => {
                const newZoneId = `ZONE_${Object.keys(priceForm).length + 1}`;
                setPriceForm({
                  ...priceForm,
                  [newZoneId]: {
                    id: newZoneId,
                    name: "New Zone",
                    pricePerSeat: 0,
                    colorClass: "bg-slate-500 text-white border-slate-600",
                    bgColorClass: "bg-slate-100",
                    textClass: "text-slate-700",
                    ringClass: "ring-slate-500",
                    borderClass: "border-slate-500",
                    bankAccount: "",
                    bankName: "",
                    bankAccountName: ""
                  }
                });
                setZoneForm({
                  ...zoneForm,
                  [newZoneId]: 10
                });
              }, className: "shrink-0 bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-100 transition", children: "+ \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E42\u0E0B\u0E19" })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mt-6 print:hidden", children: [
        /* @__PURE__ */ jsxs("h3", { className: "font-bold text-xl mb-6 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(Mail, { className: "w-5 h-5 text-primary" }),
          " \u0E15\u0E01\u0E41\u0E15\u0E48\u0E07\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15\u0E2D\u0E35\u0E40\u0E21\u0E25 (Email Template Settings)"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-end mb-1", children: [
                /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700", children: "\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E2D\u0E35\u0E40\u0E21\u0E25 (Subject)" }),
                /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
                  /* @__PURE__ */ jsxs("button", { onClick: () => handleTranslateTemplate("english", "subject"), disabled: isTranslating, className: "flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50", children: [
                    isTranslating ? /* @__PURE__ */ jsx(Loader2, { className: "w-3 h-3 animate-spin" }) : /* @__PURE__ */ jsx(Languages, { className: "w-3 h-3" }),
                    "EN"
                  ] }),
                  /* @__PURE__ */ jsxs("button", { onClick: () => handleTranslateTemplate("bilingual", "subject"), disabled: isTranslating, className: "flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50", children: [
                    isTranslating ? /* @__PURE__ */ jsx(Loader2, { className: "w-3 h-3 animate-spin" }) : /* @__PURE__ */ jsx(Wand2, { className: "w-3 h-3" }),
                    "TH/EN"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "text",
                  value: config.emailTemplateSubject || "",
                  onChange: (e) => setConfig({ ...config, emailTemplateSubject: e.target.value }),
                  className: "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 ring-primary/20",
                  placeholder: "Ex. Your Tickets for {{eventName}}"
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2 mt-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 font-bold self-center mr-1", children: "\u0E41\u0E17\u0E23\u0E01\u0E15\u0E31\u0E27\u0E41\u0E1B\u0E23:" }),
                /* @__PURE__ */ jsx("button", { onClick: () => setConfig({ ...config, emailTemplateSubject: `${config.emailTemplateSubject || ""}{{eventName}}` }), className: "text-[10px] bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-mono transition-colors", children: "{{eventName}}" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-end mb-1", children: [
                /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700", children: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E43\u0E19\u0E2D\u0E35\u0E40\u0E21\u0E25 (Body Text)" }),
                /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
                  /* @__PURE__ */ jsxs("button", { onClick: () => handleTranslateTemplate("english"), disabled: isTranslating, className: "flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50", children: [
                    isTranslating ? /* @__PURE__ */ jsx(Loader2, { className: "w-3 h-3 animate-spin" }) : /* @__PURE__ */ jsx(Languages, { className: "w-3 h-3" }),
                    "\u0E41\u0E1B\u0E25\u0E40\u0E1B\u0E47\u0E19\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29 (EN)"
                  ] }),
                  /* @__PURE__ */ jsxs("button", { onClick: () => handleTranslateTemplate("bilingual"), disabled: isTranslating, className: "flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 px-2 py-1 rounded-md font-bold transition-colors disabled:opacity-50", children: [
                    isTranslating ? /* @__PURE__ */ jsx(Loader2, { className: "w-3 h-3 animate-spin" }) : /* @__PURE__ */ jsx(Wand2, { className: "w-3 h-3" }),
                    "AI \u0E0A\u0E48\u0E27\u0E22\u0E17\u0E33\u0E41\u0E1A\u0E1A 2 \u0E20\u0E32\u0E29\u0E32 (TH/EN)"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx(
                "textarea",
                {
                  rows: 6,
                  value: config.emailTemplateBody || "",
                  onChange: (e) => setConfig({ ...config, emailTemplateBody: e.target.value }),
                  className: "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 placeholder:text-slate-400 focus:outline-none focus:ring-2 ring-primary/20",
                  placeholder: "Ex. Hi {{userName}}, Payment successful! \\n\\n{{ticketDetails}}"
                }
              ),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2 mt-2", children: [
                /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 font-bold self-center mr-1", children: "\u0E41\u0E17\u0E23\u0E01\u0E15\u0E31\u0E27\u0E41\u0E1B\u0E23:" }),
                /* @__PURE__ */ jsx("button", { onClick: () => setConfig({ ...config, emailTemplateBody: `${config.emailTemplateBody || ""}{{userName}}` }), className: "text-[10px] bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-mono transition-colors", children: "{{userName}}" }),
                /* @__PURE__ */ jsx("button", { onClick: () => setConfig({ ...config, emailTemplateBody: `${config.emailTemplateBody || ""}{{eventName}}` }), className: "text-[10px] bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-600 font-mono transition-colors", children: "{{eventName}}" }),
                /* @__PURE__ */ jsx("button", { onClick: () => setConfig({ ...config, emailTemplateBody: `${config.emailTemplateBody || ""}{{ticketDetails}}` }), className: "text-[10px] bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/30 text-primary font-bold px-2 py-1 rounded-md font-mono transition-colors", children: "{{ticketDetails}}" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 rounded-xl p-4 border border-slate-200 mt-4", children: [
              /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [
                /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                  /* @__PURE__ */ jsx("input", { type: "checkbox", className: "sr-only", checked: !!config.emailIncludeSurveyButton, onChange: (e) => setConfig({ ...config, emailIncludeSurveyButton: e.target.checked }) }),
                  /* @__PURE__ */ jsx("div", { className: `block w-10 h-6 rounded-full transition-colors ${config.emailIncludeSurveyButton ? "bg-primary" : "bg-slate-300"}` }),
                  /* @__PURE__ */ jsx("div", { className: `absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${config.emailIncludeSurveyButton ? "translate-x-4" : ""}` })
                ] }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("div", { className: "font-bold text-slate-700 text-sm", children: '\u0E41\u0E17\u0E23\u0E01\u0E1B\u0E38\u0E48\u0E21 "\u0E17\u0E33\u0E41\u0E1A\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19" \u0E44\u0E1B\u0E43\u0E19\u0E2D\u0E35\u0E40\u0E21\u0E25' }),
                  /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-500", children: "\u0E41\u0E19\u0E1A\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E43\u0E2B\u0E49\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E01\u0E14\u0E17\u0E33\u0E41\u0E1A\u0E1A\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E36\u0E07\u0E1E\u0E2D\u0E43\u0E08\u0E44\u0E14\u0E49\u0E08\u0E32\u0E01\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E17\u0E31\u0E19\u0E17\u0E35" })
                ] })
              ] }),
              config.emailIncludeSurveyButton && /* @__PURE__ */ jsxs("div", { className: "mt-4 pt-4 border-t border-slate-200", children: [
                /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
                  /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700 mb-1", children: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1A\u0E19\u0E1B\u0E38\u0E48\u0E21\u0E41\u0E1A\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19" }),
                  /* @__PURE__ */ jsx(
                    "textarea",
                    {
                      value: config.emailSurveyButtonText || "\u0E17\u0E33\u0E41\u0E1A\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E36\u0E07\u0E1E\u0E2D\u0E43\u0E08",
                      onChange: (e) => setConfig({ ...config, emailSurveyButtonText: e.target.value }),
                      className: "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary",
                      rows: 2
                    }
                  ),
                  /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-500 mt-1", children: "\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1B\u0E23\u0E31\u0E1A\u0E41\u0E15\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E25\u0E30\u0E2D\u0E35\u0E42\u0E21\u0E08\u0E34\u0E44\u0E14\u0E49 (\u0E01\u0E14 Enter \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E02\u0E36\u0E49\u0E19\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E43\u0E2B\u0E21\u0E48)" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
                  /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700 mb-1", children: "\u0E02\u0E19\u0E32\u0E14\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E1A\u0E19\u0E1B\u0E38\u0E48\u0E21 (px)" }),
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "number",
                      value: config.emailSurveyButtonFontSize || 22,
                      onChange: (e) => setConfig({ ...config, emailSurveyButtonFontSize: Number(e.target.value) }),
                      className: "w-full sm:w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary",
                      min: 12,
                      max: 48
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [
                  /* @__PURE__ */ jsxs("div", { className: "relative", children: [
                    /* @__PURE__ */ jsx("input", { type: "checkbox", className: "sr-only", checked: !!config.surveyTestMode, onChange: (e) => setConfig({ ...config, surveyTestMode: e.target.checked }) }),
                    /* @__PURE__ */ jsx("div", { className: `block w-10 h-6 rounded-full transition-colors ${config.surveyTestMode ? "bg-amber-500" : "bg-slate-300"}` }),
                    /* @__PURE__ */ jsx("div", { className: `absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${config.surveyTestMode ? "translate-x-4" : ""}` })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("div", { className: "font-bold text-slate-700 text-sm text-amber-600", children: "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E02\u0E49\u0E32\u0E17\u0E33\u0E41\u0E1A\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19 (Survey Preview Mode)" }),
                    /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-500", children: "\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E2B\u0E21\u0E14\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E02\u0E49\u0E32\u0E21\u0E01\u0E32\u0E23\u0E08\u0E33\u0E01\u0E31\u0E14 \u0E27\u0E31\u0E19/\u0E40\u0E27\u0E25\u0E32 \u0E41\u0E25\u0E30 \u0E23\u0E30\u0E22\u0E30\u0E17\u0E32\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E25\u0E2D\u0E07\u0E40\u0E02\u0E49\u0E32\u0E41\u0E1A\u0E1A\u0E1B\u0E23\u0E30\u0E40\u0E21\u0E34\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E41\u0E01\u0E49\u0E44\u0E02" })
                  ] })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700 mb-2", children: "\u0E18\u0E35\u0E21\u0E2D\u0E35\u0E40\u0E21\u0E25 (Email Theme)" }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2 mb-4", children: ["default", "minimal", "festive", "luxury", "neon"].map((t) => /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setConfig({ ...config, emailTheme: t }),
                className: `p-2 rounded-xl border-2 text-sm font-bold capitalize transition-all ${(config.emailTheme || "default") === t ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-500 hover:border-slate-300"}`,
                children: t
              },
              t
            )) }),
            /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col h-[500px]", children: [
              /* @__PURE__ */ jsxs("div", { className: "text-sm text-slate-500 mb-3 font-bold flex justify-between items-center", children: [
                "\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E41\u0E1A\u0E1A\u0E04\u0E23\u0E48\u0E32\u0E27\u0E46 (Live Preview)",
                /* @__PURE__ */ jsxs("span", { className: "text-xs font-normal bg-white px-2 py-1 rounded-md border border-slate-200", children: [
                  "Subject: ",
                  (config.emailTemplateSubject || "Your Tickets for {{eventName}}").replace(/{{eventName}}/g, config.eventName || "EventTicket")
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative", children: /* @__PURE__ */ jsx(
                "iframe",
                {
                  title: "email-preview",
                  className: "absolute inset-0 w-full h-full pointer-events-none",
                  srcDoc: getEmailHtml(
                    config.emailTheme || "default",
                    config.eventName || "EventTicket",
                    (config.emailTemplateBody || "Hi {{userName}},\n\nPayment successful! Your tickets are confirmed.\n\n{{ticketDetails}}").replace(/{{userName}}/g, "John Doe").replace(/{{eventName}}/g, config.eventName || "EventTicket").replace(/{{ticketDetails}}/g, "Table: T001, Seat: 1 - Zone: VIP\nTable: T001, Seat: 2 - Zone: VIP"),
                    {
                      themeColor: config.themeColor || "#2563eb",
                      secondaryColor: config.enableSecondaryColor ? config.secondaryColor : config.themeColor,
                      accentColor: config.enableAccentColor ? config.accentColor : config.themeColor,
                      includeSurveyButton: config.emailIncludeSurveyButton,
                      surveyButtonText: config.emailSurveyButtonText,
                      surveyButtonFontSize: config.emailSurveyButtonFontSize,
                      surveyLink: window.location.origin.replace("https://ais-dev-", "https://ais-pre-"),
                      eventDate: config.eventDate,
                      eventTime: config.eventTime
                    }
                  )
                }
              ) })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "print:hidden bg-slate-100 rounded-3xl shadow-sm border border-slate-200 p-6 mt-6", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row items-center justify-between gap-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("h3", { className: "font-bold text-lg text-slate-800 flex items-center gap-2 mb-1", children: [
            /* @__PURE__ */ jsx(RefreshCw, { className: "w-5 h-5 text-rose-500" }),
            " \u0E04\u0E37\u0E19\u0E04\u0E48\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19 (Reset to Default)"
          ] }),
          /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-500", children: "\u0E25\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 \u0E42\u0E15\u0E4A\u0E30 \u0E41\u0E25\u0E30\u0E2A\u0E16\u0E34\u0E15\u0E34\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E34\u0E48\u0E21\u0E23\u0E30\u0E1A\u0E1A\u0E43\u0E2B\u0E21\u0E48\u0E14\u0E49\u0E27\u0E22\u0E04\u0E48\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E08\u0E33\u0E25\u0E2D\u0E07" })
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => {
              if (window.confirm("\u0E04\u0E38\u0E13\u0E41\u0E19\u0E48\u0E43\u0E08\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E27\u0E48\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E37\u0E19\u0E04\u0E48\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14? \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E32\u0E23\u0E08\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E08\u0E30\u0E16\u0E39\u0E01\u0E25\u0E1A\u0E17\u0E34\u0E49\u0E07")) {
                if (onResetApp) onResetApp();
              }
            },
            className: "shrink-0 bg-white border border-rose-200 text-rose-600 px-6 py-3 rounded-xl font-bold hover:bg-rose-50 transition drop-shadow-sm flex items-center gap-2",
            children: [
              /* @__PURE__ */ jsx(RefreshCw, { className: "w-4 h-4" }),
              " \u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E23\u0E30\u0E1A\u0E1A"
            ]
          }
        )
      ] }) })
    ] }) : activeTab === "emails" ? /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-6", children: [
      /* @__PURE__ */ jsx("div", { className: "flex justify-between items-center mb-6", children: /* @__PURE__ */ jsxs("h3", { className: "font-bold text-xl flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Mail, { className: "w-5 h-5 text-primary" }),
        "\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E23\u0E2D\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02/\u0E2A\u0E48\u0E07\u0E43\u0E2B\u0E21\u0E48 (Failed & Pending Emails)"
      ] }) }),
      /* @__PURE__ */ jsx("p", { className: "text-slate-500 mb-6 text-sm", children: "\u0E23\u0E30\u0E1A\u0E1A\u0E19\u0E35\u0E49\u0E44\u0E27\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E17\u0E35\u0E48\u0E21\u0E35\u0E1B\u0E31\u0E0D\u0E2B\u0E32\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E2B\u0E23\u0E37\u0E2D\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E17\u0E35\u0E48\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E2A\u0E48\u0E07\u0E15\u0E01\u0E2B\u0E25\u0E48\u0E19/\u0E44\u0E1B\u0E44\u0E21\u0E48\u0E16\u0E36\u0E07\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32 \u0E17\u0E35\u0E21\u0E07\u0E32\u0E19\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E01\u0E14\u0E41\u0E01\u0E49\u0E44\u0E02\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E44\u0E14\u0E49\u0E08\u0E32\u0E01\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48" }),
      !pendingEmails || pendingEmails.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "text-center py-12 flex flex-col items-center", children: [
        /* @__PURE__ */ jsx(Mail, { className: "w-12 h-12 text-slate-200 mb-4" }),
        /* @__PURE__ */ jsx("p", { className: "text-slate-500 font-medium text-lg", children: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E15\u0E01\u0E04\u0E49\u0E32\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2D\u0E2A\u0E48\u0E07\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" })
      ] }) : /* @__PURE__ */ jsx("div", { className: "space-y-4", children: pendingEmails.map((email, idx) => /* @__PURE__ */ jsxs("div", { className: "border border-slate-200 rounded-2xl p-5 hover:shadow-md transition", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("p", { className: "text-sm font-bold text-primary bg-primary/10 inline-block px-3 py-1 rounded-full mb-2", children: [
              "\u0E16\u0E36\u0E07: ",
              email.to.join(", ")
            ] }),
            /* @__PURE__ */ jsxs("h4", { className: "font-bold text-lg text-slate-800 border-b border-slate-100 pb-2 mb-2", children: [
              "\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07: ",
              email.subject
            ] })
          ] }),
          email.status === "sent" ? /* @__PURE__ */ jsx("span", { className: "bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-sm", children: "\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27 (Sent)" }) : /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => {
                  const newText = prompt("\u0E41\u0E01\u0E49\u0E44\u0E02\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E35\u0E40\u0E21\u0E25:", email.text);
                  if (newText !== null && setPendingEmails) {
                    setPendingEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, text: newText } : e));
                  }
                },
                className: "bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2",
                children: [
                  /* @__PURE__ */ jsx(Edit2, { className: "w-4 h-4" }),
                  " \u0E41\u0E01\u0E49\u0E44\u0E02 (Edit)"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: async () => {
                  try {
                    const res = await fetch("/api/send-email", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(email)
                    });
                    if (res.ok) {
                      const data = await res.json();
                      alert(`\u0E2A\u0E48\u0E07\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08! (Provider: ${data.provider})`);
                      if (setPendingEmails) {
                        setPendingEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, status: "sent" } : e));
                      }
                    } else {
                      const data = await res.json();
                      alert(`Failed: ${data.error || "Unknown Error"}`);
                    }
                  } catch (e) {
                    alert(`Failed to send: ${e.message}`);
                  }
                },
                className: "bg-primary text-white hover:bg-rose-700 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2",
                children: [
                  /* @__PURE__ */ jsx(Mail, { className: "w-4 h-4" }),
                  " \u0E2A\u0E48\u0E07 (Send Now)"
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "bg-slate-50 p-4 rounded-xl text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto mb-4 border border-slate-100", children: email.text }),
        email.attachments && email.attachments.length > 0 && /* @__PURE__ */ jsxs("div", { className: "border-t border-slate-100 pt-4", children: [
          /* @__PURE__ */ jsxs("p", { className: "font-bold text-sm text-slate-500 mb-2", children: [
            "\u0E44\u0E1F\u0E25\u0E4C\u0E41\u0E19\u0E1A / QR Codes (",
            email.attachments.length,
            " \u0E44\u0E1F\u0E25\u0E4C):"
          ] }),
          /* @__PURE__ */ jsx("div", { className: "flex gap-4 overflow-x-auto pb-2", children: email.attachments.map((att, i) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 bg-white border border-slate-200 p-2 rounded-xl min-w-[120px]", children: [
            /* @__PURE__ */ jsx("img", { src: `data:image/png;base64,${att.content}`, alt: att.filename, className: "w-20 h-20 object-cover rounded-lg" }),
            /* @__PURE__ */ jsx("span", { className: "text-[10px] text-slate-400 truncate w-24 text-center", title: att.filename, children: att.filename }),
            /* @__PURE__ */ jsx(
              "a",
              {
                href: `data:image/png;base64,${att.content}`,
                download: att.filename,
                className: "text-xs font-bold text-primary hover:underline",
                children: "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14"
              }
            )
          ] }, i)) })
        ] })
      ] }, email.id)) })
    ] }) : activeTab === "notifications" ? /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6", children: [
      /* @__PURE__ */ jsx("div", { className: "flex justify-between items-center border-b border-slate-100 pb-4", children: /* @__PURE__ */ jsxs("h3", { className: "font-bold text-xl flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("svg", { className: "w-5 h-5 text-primary", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }),
        "\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19 LINE / SMS"
      ] }) }),
      /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-500 mb-4", children: "\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E04\u0E48\u0E32\u0E01\u0E32\u0E23\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19 \u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2B\u0E32\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E17\u0E33\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E41\u0E25\u0E30\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E21\u0E35\u0E01\u0E32\u0E23\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34\u0E2B\u0E23\u0E37\u0E2D\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18" }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-4 border border-slate-200 p-5 rounded-2xl", children: [
          /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                className: "w-5 h-5 accent-primary",
                checked: !!config.lineNotifyEnabled,
                onChange: (e) => setConfig({ ...config, lineNotifyEnabled: e.target.checked })
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "font-bold", children: "\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 LINE Messaging API (\u0E23\u0E31\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19)" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "Channel ID",
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none",
                value: config.lineChannelId || "",
                onChange: (e) => setConfig({ ...config, lineChannelId: e.target.value })
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "Channel Secret",
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none",
                value: config.lineChannelSecret || "",
                onChange: (e) => setConfig({ ...config, lineChannelSecret: e.target.value })
              }
            ),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "Admin User ID (\u0E16\u0E49\u0E32\u0E21\u0E35, \u0E40\u0E27\u0E49\u0E19\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D Broadcast)",
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none",
                value: config.lineAdminUserId || "",
                onChange: (e) => setConfig({ ...config, lineAdminUserId: e.target.value })
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-500 mt-1", children: "\u0E43\u0E0A\u0E49\u0E41\u0E17\u0E19 LINE Notify Token \u0E40\u0E14\u0E34\u0E21" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-4 border border-slate-200 p-5 rounded-2xl", children: [
          /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                className: "w-5 h-5 accent-primary",
                checked: !!config.linePushEnabled,
                onChange: (e) => setConfig({ ...config, linePushEnabled: e.target.checked })
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "font-bold", children: "\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 LINE OA \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "LINE_CHANNEL_ACCESS_TOKEN",
                className: "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none",
                value: config.linePushToken || "",
                onChange: (e) => setConfig({ ...config, linePushToken: e.target.value })
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-500 mt-1", children: "\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E27\u0E48\u0E32\u0E07\u0E44\u0E27\u0E49\u0E2B\u0E32\u0E01\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E1C\u0E48\u0E32\u0E19 .env" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-4 border border-slate-200 p-5 rounded-2xl", children: [
          /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                className: "w-5 h-5 accent-primary",
                checked: !!config.smsEnabled,
                onChange: (e) => setConfig({ ...config, smsEnabled: e.target.checked })
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "font-bold", children: "\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 SMS Twilio (\u0E21\u0E35\u0E04\u0E48\u0E32\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23)" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-500", children: "\u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E33\u0E2B\u0E19\u0E14 TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER \u0E43\u0E19 (.env)" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "border border-slate-200 rounded-2xl p-5 space-y-4 mt-6", children: [
        /* @__PURE__ */ jsx("h4", { className: "font-bold border-b border-slate-100 pb-2", children: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19 (\u0E2A\u0E48\u0E07\u0E2B\u0E32\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32)" }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700 mb-1", children: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34 (Success):" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                className: "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none",
                rows: 2,
                value: config.notificationCustomerSuccess || "\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22 \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13",
                onChange: (e) => setConfig({ ...config, notificationCustomerSuccess: e.target.value })
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-bold text-slate-700 mb-1", children: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18 (Failed):" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                className: "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 outline-none",
                rows: 2,
                value: config.notificationCustomerFailed || "\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E44\u0E21\u0E48\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22 \u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48",
                onChange: (e) => setConfig({ ...config, notificationCustomerFailed: e.target.value })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 pt-4 border-t border-slate-100 flex gap-4", children: /* @__PURE__ */ jsx(
          "button",
          {
            onClick: async () => {
              try {
                const { sendNotification } = await import("../utils/notify");
                if (config.lineNotifyEnabled) {
                  await sendNotification("line_messaging_api", {
                    message: "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E44\u0E1B\u0E22\u0E31\u0E07 LINE Messaging API \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08",
                    channelId: config.lineChannelId,
                    channelSecret: config.lineChannelSecret,
                    targetUserId: config.lineAdminUserId
                  });
                  alert("\u0E2A\u0E48\u0E07\u0E17\u0E14\u0E2A\u0E2D\u0E1A LINE Messaging API \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
                } else {
                  alert("\u0E42\u0E1B\u0E23\u0E14\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 LINE Messaging API \u0E01\u0E48\u0E2D\u0E19\u0E17\u0E14\u0E2A\u0E2D\u0E1A");
                }
              } catch (e) {
                alert("\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E25\u0E49\u0E21\u0E40\u0E2B\u0E25\u0E27: " + e.message);
              }
            },
            className: "px-4 py-2 bg-[#00B900] text-white rounded-lg font-bold hover:opacity-90",
            children: "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E2A\u0E48\u0E07 LINE Messaging API"
          }
        ) })
      ] })
    ] }) : null,
    showSponsorModal && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4", children: /* @__PURE__ */ jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, className: "bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative", children: [
      /* @__PURE__ */ jsxs("h3", { className: "text-xl font-bold mb-4 flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Gift, { className: "w-5 h-5 text-rose-500" }),
        "\u0E2D\u0E2D\u0E01\u0E1A\u0E31\u0E15\u0E23\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C (Sponsor Ticket)"
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              value: sponsorForm.name,
              onChange: (e) => setSponsorForm({ ...sponsorForm, name: e.target.value }),
              className: "w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500",
              placeholder: "\u0E40\u0E0A\u0E48\u0E19 \u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17 ABC, \u0E1E\u0E35\u0E48\u0E42\u0E15"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C (\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2A\u0E48\u0E07 QR Code)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              value: sponsorForm.email,
              onChange: (e) => setSponsorForm({ ...sponsorForm, email: e.target.value }),
              className: "w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500",
              placeholder: "email@example.com"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-4 flex-col", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E07 (\u0E23\u0E30\u0E1A\u0E38\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 \u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E25\u0E14)" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setSponsorForm((prev) => ({ ...prev, qtyStr: Math.max(1, (parseInt(prev.qtyStr) || 0) - 1).toString() })),
                  className: "p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors",
                  children: /* @__PURE__ */ jsx(Minus, { className: "w-4 h-4" })
                }
              ),
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "number",
                  min: "1",
                  placeholder: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E19\u0E31\u0E48\u0E07...",
                  value: sponsorForm.qtyStr,
                  onChange: (e) => {
                    setSponsorForm({ ...sponsorForm, qtyStr: e.target.value });
                    setSelectedAllocation(null);
                  },
                  className: `flex-1 px-4 py-3 text-center rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors ${sponsorForm.qtyStr ? "border-rose-300 text-slate-800 font-bold" : "border-slate-200 text-slate-400"}`
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  onClick: () => setSponsorForm((prev) => ({ ...prev, qtyStr: ((parseInt(prev.qtyStr) || 0) + 1).toString() })),
                  className: "p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors",
                  children: /* @__PURE__ */ jsx(Plus, { className: "w-4 h-4" })
                }
              )
            ] })
          ] }),
          sponsorQty > 0 && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: "block text-sm font-medium text-slate-700 mb-1", children: "\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E42\u0E0B\u0E19 / \u0E42\u0E15\u0E4A\u0E30\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E2A\u0E23\u0E23\u0E44\u0E14\u0E49" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: selectedAllocation ? JSON.stringify(selectedAllocation) : "",
                onChange: (e) => setSelectedAllocation(e.target.value ? JSON.parse(e.target.value) : null),
                className: "w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "-- \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E31\u0E14\u0E2A\u0E23\u0E23 \u0E2B\u0E23\u0E37\u0E2D \u0E42\u0E15\u0E4A\u0E30 --" }),
                  allocationOptions.length > 0 && Object.keys(activeZones).map((zone) => {
                    const opt = allocationOptions.find((o) => o.zoneId === zone);
                    return opt ? /* @__PURE__ */ jsx("optgroup", { label: `\u2728 \u0E41\u0E19\u0E30\u0E19\u0E33\u0E42\u0E0B\u0E19: ${activeZones[zone]?.name} / \u0E08\u0E31\u0E14\u0E2A\u0E23\u0E23 ${opt.plan.length} \u0E42\u0E15\u0E4A\u0E30`, children: /* @__PURE__ */ jsxs("option", { value: JSON.stringify(opt.plan), children: [
                      "\u0E42\u0E04\u0E27\u0E15\u0E49\u0E32\u0E42\u0E0B\u0E19: ",
                      activeZones[zone]?.name,
                      " (\u0E08\u0E31\u0E14\u0E2A\u0E23\u0E23\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34)"
                    ] }) }, `auto-${zone}`) : null;
                  }),
                  sponsorQty <= 10 && specificTableOptions.length > 0 && /* @__PURE__ */ jsx("optgroup", { label: "\u{1F4CC} \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E08\u0E32\u0E30\u0E08\u0E07\u0E23\u0E32\u0E22\u0E42\u0E15\u0E4A\u0E30", children: specificTableOptions.map((opt, idx) => /* @__PURE__ */ jsxs("option", { value: JSON.stringify(opt.plan), children: [
                    "\u0E42\u0E15\u0E4A\u0E30 ",
                    opt.plan[0].tableId,
                    " - \u0E42\u0E0B\u0E19: ",
                    activeZones[opt.zoneId]?.name,
                    " (\u0E27\u0E48\u0E32\u0E07 ",
                    tables.find((t) => t.id === opt.plan[0].tableId)?.seats.filter((s) => s.status === "available").length,
                    " \u0E17\u0E35\u0E48)"
                  ] }, `spec-${idx}`)) })
                ]
              }
            ),
            selectedAllocation && selectedAllocation.length > 1 && /* @__PURE__ */ jsxs("div", { className: "mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100", children: [
              /* @__PURE__ */ jsx("strong", { children: "\u0E41\u0E1C\u0E19\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E2A\u0E23\u0E23: " }),
              selectedAllocation.map((p) => `\u0E42\u0E15\u0E4A\u0E30 ${p.tableId} (${p.seatIds.length} \u0E17\u0E35\u0E48)`).join(" + ")
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3 mt-8", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setShowSponsorModal(false);
              setSponsorForm({ name: "", qtyStr: "" });
              setSelectedAllocation(null);
            },
            className: "flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition",
            children: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: async () => {
              try {
                console.log("Confirm sponsor click:", { sponsorForm, selectedAllocation, hasSetTickets: !!setMyTickets, hasSetTables: !!setTables });
                if (!sponsorForm.name || !selectedAllocation) {
                  console.warn("Returning early due to missing name or allocation");
                  return;
                }
                if (!setMyTickets || !setTables) {
                  console.warn("Missing setter limits");
                  alert("\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14: \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E14\u0E49 (Missing state mutators)");
                  return;
                }
                const allocArray = Array.isArray(selectedAllocation) ? selectedAllocation : [selectedAllocation];
                const newTickets = allocArray.map((alloc) => {
                  const table = tables.find((t) => t.id === alloc.tableId);
                  const price = activeZones[table?.zoneId]?.pricePerSeat || 0;
                  const ticketCompValue = alloc.seatIds ? alloc.seatIds.length * price : 0;
                  return {
                    id: Math.random().toString(36).substr(2, 9).toUpperCase(),
                    userName: sponsorForm.name,
                    phone: "-",
                    email: sponsorForm.email || "-",
                    tableId: alloc.tableId,
                    seatIds: alloc.seatIds || [],
                    totalAmount: 0,
                    paymentMethod: "sponsor",
                    status: "paid",
                    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + Math.random().toString(36).substring(7),
                    drinksRedeemed: 0,
                    drinkHistory: {},
                    isSponsor: true,
                    sponsorValue: ticketCompValue
                  };
                });
                setMyTickets((prev) => [...newTickets, ...prev || []]);
                setTables((prev) => (prev || []).map((t) => {
                  const alloc = allocArray.find((a) => a.tableId === t.id);
                  if (alloc) {
                    return {
                      ...t,
                      seats: t.seats.map((s) => (alloc.seatIds || []).includes(s.id) ? { ...s, status: "paid" } : s)
                    };
                  }
                  return t;
                }));
                setShowSponsorModal(false);
                setSponsorForm({ name: "", email: "", qtyStr: "" });
                setSelectedAllocation(null);
                if (sponsorForm.email) {
                  try {
                    const attachments = [];
                    const summaryTextLines = [];
                    let summaryHtml = "";
                    for (const tkt of newTickets) {
                      const table = tables.find((t) => t.id === tkt.tableId);
                      const zoneName = table ? activeZones[table.zoneId].name : "";
                      const zoneColor = table ? activeZones[table.zoneId].color : void 0;
                      for (const seatId of tkt.seatIds) {
                        const dataUrl = await generateTicketImage({
                          ticketId: tkt.id,
                          tableId: tkt.tableId,
                          seatId,
                          zoneName,
                          zonePrice: 0,
                          // Comped
                          eventName: config.eventName,
                          zoneColor
                        });
                        const base64Content = dataUrl.split(",")[1];
                        const filename = `QR_Table_${tkt.tableId}_Seat_${seatId}.png`;
                        attachments.push({ filename, content: base64Content });
                        summaryTextLines.push(`Table: ${tkt.tableId}, Seat: ${seatId} - Zone: ${zoneName}`);
                        summaryHtml += `<div style="margin-bottom: 10px;">
                              <p><strong>Table: ${tkt.tableId}, Seat: ${seatId}</strong> - Zone: ${zoneName}</p>
                            </div>`;
                      }
                    }
                    const summaryText = summaryTextLines.join("\n");
                    const rawSubject = config.emailTemplateSubject || "Your Tickets for {{eventName}}";
                    const rawBody = config.emailTemplateBody || "Hi {{userName}},\n\nPayment successful! Your tickets are confirmed.\n\n{{ticketDetails}}\n\nPlease check the attached QR codes and present them at the entrance.";
                    const replaceVars = (str) => {
                      return str.replace(/{{eventName}}/g, config.eventName || "EventTicketingPro").replace(/{{userName}}/g, sponsorForm.name).replace(/{{ticketDetails}}/g, summaryText);
                    };
                    const subjectText = replaceVars(rawSubject);
                    const bodyText = replaceVars(rawBody);
                    const bodyHtml = getEmailHtml(config.emailTheme || "default", config.eventName || "EventTicket", bodyText, {
                      themeColor: config.themeColor || "#2563eb",
                      secondaryColor: config.enableSecondaryColor ? config.secondaryColor : config.themeColor,
                      accentColor: config.enableAccentColor ? config.accentColor : config.themeColor,
                      includeSurveyButton: config.emailIncludeSurveyButton,
                      surveyButtonText: config.emailSurveyButtonText,
                      surveyButtonFontSize: config.emailSurveyButtonFontSize,
                      surveyLink: window.location.origin.replace("https://ais-dev-", "https://ais-pre-"),
                      eventDate: config.eventDate,
                      eventTime: config.eventTime
                    });
                    const pendingData = {
                      id: Math.random().toString(36).substr(2, 9),
                      to: [sponsorForm.email],
                      subject: `[Sponsor] ${subjectText}`,
                      text: bodyText,
                      html: bodyHtml,
                      attachments,
                      status: "pending",
                      createdAt: Date.now()
                    };
                    try {
                      const res = await fetch("/api/send-email", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(pendingData)
                      });
                      if (res.ok) {
                        alert(`\u0E2D\u0E2D\u0E01\u0E1A\u0E31\u0E15\u0E23\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!`);
                      } else {
                        const errData = await res.json();
                        throw new Error(errData.error || "Send response not ok");
                      }
                    } catch (sendErr) {
                      console.error("Draft email auto-send error:", sendErr);
                      if (setPendingEmails) setPendingEmails((prev) => [pendingData, ...prev || []]);
                      alert(`\u0E2D\u0E2D\u0E01\u0E1A\u0E31\u0E15\u0E23\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E41\u0E15\u0E48\u0E2A\u0E48\u0E07\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E25\u0E49\u0E21\u0E40\u0E2B\u0E25\u0E27: ${sendErr.message}\\n\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E16\u0E39\u0E01\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E19 Failed/Pending Emails \u0E41\u0E25\u0E49\u0E27`);
                    }
                  } catch (e) {
                    console.error("Draft email error:", e);
                    alert(`\u0E2D\u0E2D\u0E01\u0E1A\u0E31\u0E15\u0E23\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E41\u0E15\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E44\u0E14\u0E49: ${e.message}`);
                  }
                } else {
                  alert("\u0E2D\u0E2D\u0E01\u0E1A\u0E31\u0E15\u0E23\u0E2A\u0E1B\u0E2D\u0E19\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!");
                }
              } catch (err) {
                console.error("Sponsor ticket error:", err);
                alert("\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E01\u0E32\u0E23\u0E2D\u0E2D\u0E01\u0E1A\u0E31\u0E15\u0E23: " + err.message);
              }
            },
            disabled: !sponsorForm.name || !sponsorForm.email || !selectedAllocation,
            className: "flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition disabled:opacity-50 disabled:grayscale",
            children: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E15\u0E31\u0E49\u0E07\u0E1A\u0E31\u0E15\u0E23"
          }
        )
      ] })
    ] }) })
  ] });
}
function StatCard({ icon, title, value, bgColor }) {
  return /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center gap-4", children: [
    /* @__PURE__ */ jsx("div", { className: `w-14 h-14 rounded-2xl flex items-center justify-center ${bgColor}`, children: icon }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-slate-500 mb-1", children: title }),
      /* @__PURE__ */ jsx("p", { className: "text-2xl font-black text-slate-800", children: value })
    ] })
  ] });
}
