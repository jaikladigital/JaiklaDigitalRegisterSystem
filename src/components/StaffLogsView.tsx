import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Activity, Loader2, RefreshCcw, Search, Filter, Download, Trash2, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { ConfigContext } from '../ConfigContext';

export default function StaffLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  
  const { config } = React.useContext(ConfigContext);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Increase limit to 1000 for better client-side filtering/aggregation
      const q = query(collection(db, 'staff_logs'), orderBy('timestamp', 'desc'), limit(1000));
      const snap = await getDocs(q);
      const fetched: any[] = [];
      snap.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() });
      });
      setLogs(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExportCSV = () => {
    const header = ['Time', 'Email', 'UID', 'Action', 'Details', 'TargetID'];
    const csvContent = filteredLogs.map((log) => [
      new Date(log.timestamp).toLocaleString('th-TH'),
      `"${log.email || ''}"`,
      log.uid,
      log.action,
      `"${(log.details || '').replace(/"/g, '""')}"`,
      log.targetId || ''
    ].join(','));
    
    const csvString = [header.join(','), ...csvContent].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `staff_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      const snap = await getDocs(collection(db, 'staff_logs'));
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;
      
      snap.forEach(docSnap => {
        currentBatch.delete(doc(db, 'staff_logs', docSnap.id));
        opCount++;
        if (opCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      });
      if (opCount > 0) batches.push(currentBatch.commit());
      
      await Promise.all(batches);
      setLogs([]);
      setToast({ type: 'success', message: 'เคลียร์ข้อมูลบันทึกทั้งหมดเรียบร้อยแล้ว (Cleared all logs successfully)' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'เกิดข้อผิดพลาดในการเคลียร์ล็อก (Failed to clear logs)' });
    } finally {
      setClearing(false);
      setShowConfirmClear(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = searchTerm === '' || 
        (log.email && log.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.uid && log.uid.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchAction = filterAction === 'ALL' || log.action === filterAction;
      return matchSearch && matchAction;
    });
  }, [logs, searchTerm, filterAction]);

  const summary = useMemo(() => {
    if (!searchTerm) return null; // Only show summary when searching for a specific user
    
    let checksIn = 0;
    let surveys = 0;
    let drinksRedeemed = 0;

    filteredLogs.forEach(log => {
      if (log.action === 'CHECK_IN' || log.action === 'CHECK_IN_GROUP') checksIn++;
      if (log.action === 'SUBMIT_SURVEY') surveys++;
      if (log.action === 'REDEEM_DRINKS') {
        if (log.extraData && log.extraData.totalQty) {
          drinksRedeemed += log.extraData.totalQty;
        } else {
          drinksRedeemed++; // fallback if extraData is missing
        }
      }
    });

    return { checksIn, surveys, drinksRedeemed };
  }, [filteredLogs, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> 
          Staff Activity Logs
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={handleExportCSV} className="text-sm font-bold text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
            <Download className="w-4 h-4" /> ส่งออก (CSV)
          </button>
          <button onClick={() => setShowConfirmClear(true)} className="text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> ล้างข้อมูล
          </button>
          <button onClick={fetchLogs} className="text-sm font-bold text-slate-500 hover:text-primary transition-colors flex items-center gap-1 pl-3 border-l border-slate-200">
            <RefreshCcw className="w-4 h-4" /> รีเฟรช
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="ค้นหาด้วยอีเมล หรือ UID..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="w-full sm:w-48 relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
            >
              <option value="ALL">ทุกประเภท (All Actions)</option>
              <option value="CHECK_IN">การเช็คอิน (Check-in)</option>
              <option value="CHECK_IN_GROUP">การเช็คอินกลุ่ม (Group Check-in)</option>
              <option value="REDEEM_DRINKS">เสิร์ฟเครื่องดื่ม (Drinks)</option>
              <option value="SUBMIT_SURVEY">การประเมิน (Surveys)</option>
              <option value="CLAIM_PRIZE">รับรางวัล (Prizes)</option>
            </select>
          </div>
        </div>

        {summary && (
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <h4 className="text-sm font-bold text-slate-800 mb-2">สรุปผลงานของพนักงาน ({searchTerm})</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-3 rounded-lg border border-primary/10 text-center">
                <div className="text-2xl font-black text-primary">{summary.checksIn}</div>
                <div className="text-xs font-bold text-slate-500">เช็คอิน (ครั้ง)</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-primary/10 text-center">
                <div className="text-2xl font-black text-primary">{summary.drinksRedeemed}</div>
                <div className="text-xs font-bold text-slate-500">เครื่องดื่มที่เสิร์ฟ (แก้ว)</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-primary/10 text-center">
                <div className="text-2xl font-black text-primary">{summary.surveys}</div>
                <div className="text-xs font-bold text-slate-500">แบบประเมิน (ครั้ง)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold">Time</th>
                <th className="px-6 py-4 font-bold">Staff Email / UID</th>
                <th className="px-6 py-4 font-bold">Action</th>
                <th className="px-6 py-4 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                      {new Date(log.timestamp).toLocaleString('th-TH')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">{log.email}</div>
                      <div className="text-[10px] text-slate-400">{log.uid}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {log.details}
                      {log.targetId && (
                        <div className="mt-1 text-[10px] bg-slate-100 text-slate-500 py-0.5 px-1.5 rounded w-max">
                          Target: {log.targetId}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-lg text-slate-900">ยืนยันการล้างข้อมูลบันทึก?</h3>
                <p className="font-sans text-xs text-slate-500 font-medium">Confirm Clear Logs</p>
              </div>
            </div>
            <p className="font-sans text-sm text-slate-600 mb-6 leading-relaxed">
              คุณต้องการลบข้อมูลบันทึกการทำงานของพนักงาน (Staff Logs) ทั้งหมดในระบบใช่หรือไม่? <br />
              <span className="text-rose-600 font-bold font-sans">** การกระทำนี้จะไม่สามารถเรียกคืนข้อมูลกลับมาได้ **</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                disabled={clearing}
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors font-sans"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                disabled={clearing}
                onClick={handleClearLogs}
                className="px-5 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-md shadow-rose-600/10 flex items-center gap-2 font-sans"
              >
                {clearing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    ใช่, ยืนยันล้างข้อมูล
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg ${
            toast.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-bold font-sans">{toast.message}</span>
            <button 
              onClick={() => setToast(null)} 
              className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
