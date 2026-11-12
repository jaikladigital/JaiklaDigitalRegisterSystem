/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useContext, useState, useMemo } from "react";
import { TicketPayload, Table, ZoneType, SurveyPayload } from "../types";
import { ZONES, getZoneStyle } from "../data";
import { ConfigContext } from "../ConfigContext";
import {
  QrCode,
  MapPin,
  SmilePlus,
  Download,
  Search,
  LayoutGrid,
  Type,
  Printer,
  ChevronDown,
  ChevronUp,
  Ticket,
} from "lucide-react";
import {
  generateTicketImage,
  generateTicketPDF,
} from "../utils/ticketGenerator";

export default function MyTicketsView({
  tickets,
  tables,
  surveys,
  onTakeSurvey,
  onCheckIn,
  onCheckInGroup,
}: {
  tickets: TicketPayload[];
  tables: Table[];
  surveys?: SurveyPayload[];
  onTakeSurvey?: (t: TicketPayload, seatId: number) => void;
  onCheckIn?: (t: TicketPayload, seatId: number) => void;
  onCheckInGroup?: (t: TicketPayload) => void;
}) {
  const { config, t } = useContext(ConfigContext);
  const activeZones = config?.zones || ZONES;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"table" | "name">("table");
  const [expandedTicketIds, setExpandedTicketIds] = useState<
    Record<string, boolean>
  >({});

  const toggleTicket = (id: string) => {
    setExpandedTicketIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredAndSortedTickets = useMemo(() => {
    let result = [...tickets];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (tick) =>
          tick.userName.toLowerCase().includes(q) ||
          (tick.email && tick.email.toLowerCase().includes(q)) ||
          (tick.phone && tick.phone.toLowerCase().includes(q)) ||
          tick.tableId.toLowerCase().includes(q) ||
          tick.id.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      if (sortBy === "name") {
        return a.userName.localeCompare(b.userName, "th");
      } else {
        return a.tableId.localeCompare(b.tableId, "en", { numeric: true });
      }
    });

    return result;
  }, [tickets, searchQuery, sortBy]);

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">
            {t("บัตรของฉัน")} ({tickets.length})
          </h2>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder={t(
                "พิมพ์ค้นหาชื่อ, เบอร์, อีเมล หรือหมายเลขโต๊ะ เพื่อแสดงบัตร",
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary h-11"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {t("เรียงตาม")}:
            </span>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setSortBy("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  sortBy === "table"
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> {t("โต๊ะ")}
              </button>
              <button
                onClick={() => setSortBy("name")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  sortBy === "name"
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Type className="w-4 h-4" /> {t("ชื่อ")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-200 p-10">
          <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-600">{t('ไม่มีตั๋วในรายการ')}</h2>
          <p className="text-slate-400">{t('คุณยังไม่ได้ทำการจองที่นั่ง')}</p>
        </div>
      ) : !searchQuery.trim() ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-10 text-center flex flex-col items-center justify-center space-y-4">
          <Search className="w-12 h-12 text-slate-300" />
          <div>
            <h3 className="text-lg font-bold text-slate-700">
              {t("กรุณาพิมพ์ข้อความเพื่อค้นหา")}
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              {t(
                "ระบบจะแสดงบัตรของคุณ เมื่อคุณพิมพ์ชื่อ, เบอร์โทร, อีเมล หรือหมายเลขโต๊ะ ลงในช่องค้นหาด้านบน",
              )}
            </p>
          </div>
        </div>
      ) : filteredAndSortedTickets.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-10 text-center flex flex-col items-center justify-center space-y-4">
          <Ticket className="w-12 h-12 text-slate-300" />
          <div>
            <h3 className="text-lg font-bold text-slate-700">
              {t("ไม่พบบัตรที่ตรงกับการค้นหา")}
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              {t(
                "ลองใช้คำค้นหาอื่น เช่น เปลี่ยนตัวสะกด หรือค้นหาด้วยข้อมูลอื่น",
              )}
            </p>
          </div>
        </div>
      ) : (
        <>
          {filteredAndSortedTickets.map((ticket) => {
            const table = tables.find((t) => t.id === ticket.tableId);
            const zone = table ? activeZones[table.zoneId as ZoneType] : null;
            const isExpanded = expandedTicketIds[ticket.id];

            return (
              <div
                key={ticket.id}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative transition-all duration-300 hover:shadow-md"
              >
                {/* Left Zone Indicator */}
                <div
                  className="absolute top-0 bottom-0 left-0 w-2.5 sm:w-3"
                  style={{ backgroundColor: zone?.color || "#cbd5e1" }}
                />

                {/* Header / Summary */}
                <div
                  className="p-4 sm:p-5 pl-6 sm:pl-8 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggleTicket(ticket.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                        Ref: {ticket.id}
                      </span>
                      {zone && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider"
                          style={getZoneStyle(zone.color)}
                        >
                          {zone.name}
                        </span>
                      )}
                      <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-widest flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {t("โต๊ะ")} {table?.id}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg sm:text-xl text-slate-800 tracking-tight truncate flex items-center gap-2">
                      {ticket.userName}
                    </h3>
                  </div>

                  <div className="flex flex-row items-center justify-between sm:justify-start gap-4 sm:gap-6 border-t sm:border-t-0 sm:border-l border-dashed border-slate-200 pt-3 sm:pt-0 sm:pl-6 shrink-0">
                    <div className="text-left sm:text-right flex items-center sm:block gap-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold sm:mb-0.5 block">
                        {t("จำนวน")}
                      </p>
                      <p className="text-xl sm:text-2xl font-black text-slate-700 leading-none">
                        {ticket.seatIds.length}{" "}
                        <span className="text-sm font-bold text-slate-400">
                          {t("ที่นั่ง")}
                        </span>
                      </p>
                    </div>

                    <div
                      className={`p-2 rounded-full border border-slate-200 transition-transform duration-300 ${isExpanded ? "bg-slate-100 rotate-180" : "bg-white text-slate-400"}`}
                    >
                      <ChevronDown
                        className={`w-5 h-5 ${isExpanded ? "text-slate-700" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Expandable Seats List */}
                <div
                  className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <div className="p-4 sm:p-5 pl-6 sm:pl-8 pt-0 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2 relative">
                      <div
                        className="absolute top-0 bottom-0 left-0 w-2.5 sm:w-3"
                        style={{ backgroundColor: zone?.color || "#cbd5e1" }}
                      />

                      {ticket.seatIds.length > 1 && onCheckInGroup && (
                        <div className="mb-2">
                          <button
                            onClick={() => onCheckInGroup(ticket)}
                            disabled={
                              ticket.checkedInSeats?.length ===
                              ticket.seatIds.length
                            }
                            className={`w-full flex justify-center items-center gap-2 px-4 py-2 border rounded-xl text-sm font-bold transition-all ${
                              ticket.checkedInSeats?.length ===
                              ticket.seatIds.length
                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 shadow-sm"
                            }`}
                          >
                            <QrCode className="w-4 h-4 shrink-0" />
                            <span>
                              {ticket.checkedInSeats?.length ===
                              ticket.seatIds.length
                                ? t("เช็คอินครบทุกที่นั่งแล้ว")
                                : t("เช็คอินกลุ่มทั้งหมด (Group Check-in)")}
                            </span>
                          </button>
                        </div>
                      )}

                      {ticket.seatIds.map((seatId) => {
                        const thisSeatHasSurvey = surveys?.some(
                          (s) =>
                            s.ticketId === ticket.id && s.seatId === seatId,
                        );
                        return (
                          <div
                            key={seatId}
                            className="flex flex-col xl:flex-row xl:items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl gap-3 shadow-sm hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center shrink-0">
                              <span className="text-sm px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-bold whitespace-nowrap flex items-center gap-2">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor: zone?.color || "#cbd5e1",
                                  }}
                                />
                                {t("ที่นั่ง")} {seatId}
                              </span>
                            </div>
                            <div className="flex flex-wrap justify-start xl:justify-end items-center gap-1.5 w-full flex-1">
                              {onCheckIn && (
                                <button
                                  onClick={() => onCheckIn(ticket, seatId)}
                                  disabled={ticket.checkedInSeats?.includes(
                                    seatId,
                                  )}
                                  className={`flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    ticket.checkedInSeats?.includes(seatId)
                                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                      : "bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100"
                                  }`}
                                >
                                  <QrCode className="w-4 h-4 shrink-0" />
                                  <span>
                                    {ticket.checkedInSeats?.includes(seatId)
                                      ? t("เช็คอินแล้ว")
                                      : t("เช็คอินหน้างาน")}
                                  </span>
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  try {
                                    const dataUrl = await generateTicketImage({
                                      ticketId: ticket.id,
                                      tableId: ticket.tableId,
                                      seatId,
                                      zoneName: zone?.name || "",
                                      zonePrice: zone?.pricePerSeat || 0,
                                      eventName:
                                        config.eventName || "EventTicket",
                                      zoneColor: zone?.color,
                                    });

                                    const printWindow = window.open(
                                      "",
                                      "_blank",
                                    );
                                    if (printWindow) {
                                      printWindow.document.write(`
                                    <html>
                                      <head>
                                        <title>Print Ticket</title>
                                        <style>
                                          body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
                                          img { max-width: 100%; max-height: 100%; }
                                          @media print {
                                            @page { margin: 0; }
                                            body { height: auto; display: block; margin: 1cm; }
                                            img { max-width: 100%; height: auto; }
                                          }
                                        </style>
                                      </head>
                                      <body>
                                        <img src="${dataUrl}" onload="window.print(); setTimeout(() => window.close(), 500);" />
                                      </body>
                                    </html>
                                  `);
                                      printWindow.document.close();
                                    }
                                  } catch (e) {
                                    console.error("Print error:", e);
                                    alert(
                                      t("ไม่สามารถพิมพ์ได้ ลองใหม่อีกครั้ง"),
                                    );
                                  }
                                }}
                                className="flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all whitespace-nowrap hover:border-slate-300"
                              >
                                <Printer className="w-4 h-4 shrink-0" />
                                <span>{t("พิมพ์บัตร")}</span>
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const doc = await generateTicketPDF({
                                      ticketId: ticket.id,
                                      tableId: ticket.tableId,
                                      seatId,
                                      seatIds: ticket.seatIds,
                                      userName: ticket.userName,
                                      zoneName: zone?.name || "",
                                      zonePrice: zone?.pricePerSeat || 0,
                                      eventName:
                                        config.eventName || "EventTicket",
                                      zoneColor: zone?.color,
                                    });

                                    doc.save(
                                      `Ticket_${ticket.tableId}_Seat_${seatId}.pdf`,
                                    );
                                  } catch (e) {
                                    console.error("Download error:", e);
                                    alert(
                                      t(
                                        "ไม่สามารถดาวน์โหลดได้ ลองใหม่อีกครั้ง",
                                      ),
                                    );
                                  }
                                }}
                                className="flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all whitespace-nowrap hover:border-rose-200"
                              >
                                <Download className="w-4 h-4 shrink-0" />
                                <span>{t("ดาวน์โหลดบัตร")}</span>
                              </button>
                              {onTakeSurvey && (
                                <button
                                  onClick={() => onTakeSurvey(ticket, seatId)}
                                  disabled={
                                    thisSeatHasSurvey ||
                                    !ticket.checkedInSeats?.includes(seatId)
                                  }
                                  title={
                                    !ticket.checkedInSeats?.includes(seatId)
                                      ? t("กรุณาเช็คอินก่อนทำแบบประเมิน")
                                      : ""
                                  }
                                  className={`flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                    thisSeatHasSurvey
                                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                      : !ticket.checkedInSeats?.includes(seatId)
                                        ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                                        : "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200"
                                  }`}
                                >
                                  <SmilePlus className="w-4 h-4 shrink-0" />
                                  <span>
                                    {thisSeatHasSurvey
                                      ? t("ประเมินแล้ว")
                                      : t("ทำแบบประเมิน")}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
