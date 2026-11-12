import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, deleteDoc, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Trash2, Edit2, ShieldAlert, Loader2, CheckCircle2, UserPlus, Download } from 'lucide-react';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

interface User {
  id: string;
  email: string;
  role: 'user' | 'staff' | 'admin';
  status?: 'pending' | 'approved';
  createdAt?: string;
}

export default function UserManagementView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user'|'staff'|'admin'>('staff');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      const fetched: User[] = [];
      snap.forEach(d => {
        fetched.push({ id: d.id, ...d.data() } as User);
      });
      setUsers(fetched);
      setLoading(false);
      setError('');
    }, (err: any) => {
      setError(err.message || 'Error fetching users');
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setCreatingUser(true);
    try {
      let uid = '';
      let userEmail = newEmail;
      
      try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
        if (userCredential.user) {
           uid = userCredential.user.uid;
           userEmail = userCredential.user.email || newEmail;
        }
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          // Try signing in to get the UID so we can set the role
          try {
            const loginCredential = await signInWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
            if (loginCredential.user) {
               uid = loginCredential.user.uid;
               userEmail = loginCredential.user.email || newEmail;
            }
          } catch (loginErr: any) {
            throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว (สร้างจากระบบอื่น) กรุณาให้ผู้ใช้นี้นำอีเมลนี้ไปล็อคอินเข้าสู่ระบบ 1 ครั้ง ระบบจะเพิ่มผู้ใช้นี้เข้าฐานข้อมูลโดยอัตโนมัติ');
          }
        } else {
          throw err;
        }
      }

      if (uid) {
        await setDoc(doc(db, 'users', uid), {
          email: userEmail,
          role: newRole,
          status: 'approved',
          createdAt: new Date().toISOString()
        });
      }
      
      await secondaryAuth.signOut();
      
      setNewEmail('');
      setNewPassword('');
      alert('เพิ่มผู้ใช้สำเร็จ (User added successfully)');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'user' | 'staff' | 'admin') => {
    if (!window.confirm(`เปลี่ยนบทบาทเป็น ${newRole} หรือไม่?`)) return;
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      const updatedUser = users.find(u => u.id === userId);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      
      try {
        const configDoc = await getDoc(doc(db, "settings", "config"));
        if (configDoc.exists()) {
          const configData = configDoc.data();
          if (configData.lineNotifyEnabled && configData.lineChannelId && configData.lineChannelSecret) {
            const { sendNotification } = await import("../utils/notify");
            await sendNotification("line_messaging_api", {
              message: `🔄 อัปเดตข้อมูล: แอดมินได้เปลี่ยนบทบาทของ ${updatedUser?.email || userId} เป็น ${newRole}`,
              channelId: configData.lineChannelId,
              channelSecret: configData.lineChannelSecret,
              targetUserId: configData.lineAdminUserId,
            });
          }
        }
      } catch (notifyErr) {
        console.error("Failed to send LINE notification:", notifyErr);
      }

    } catch (err: any) {
      alert('Error updating role: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'pending' | 'approved') => {
    if (!window.confirm(`เปลี่ยนสถานะเป็น ${newStatus === 'approved' ? 'อนุมัติ' : 'รอตรวจสอบ'} หรือไม่?`)) return;
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      const updatedUser = users.find(u => u.id === userId);
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));

      try {
        const configDoc = await getDoc(doc(db, "settings", "config"));
        if (configDoc.exists()) {
          const configData = configDoc.data();
          if (configData.lineNotifyEnabled && configData.lineChannelId && configData.lineChannelSecret) {
            const { sendNotification } = await import("../utils/notify");
            const statusText = newStatus === 'approved' ? 'อนุมัติ (Approved) ✅' : 'รอตรวจสอบ (Pending) ⏳';
            await sendNotification("line_messaging_api", {
              message: `✅ แจ้งเตือนสถานะ: แอดมินได้อัปเดตสถานะของ ${updatedUser?.email || userId} เป็น ${statusText}`,
              channelId: configData.lineChannelId,
              channelSecret: configData.lineChannelSecret,
              targetUserId: configData.lineAdminUserId,
            });
          }
        }
      } catch (notifyErr) {
        console.error("Failed to send LINE notification:", notifyErr);
      }

    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารผู้ใช้นี้ (ลบสิทธิ์ออกจากระบบ)?')) return;
    setUpdatingId(userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err: any) {
      alert('Error deleting user info: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportCSV = () => {
    const csvContent = ['Email,Role,Joined At'];
    users.forEach((u) => {
      csvContent.push(`"${u.email}","${u.role}","${u.createdAt ? new Date(u.createdAt).toLocaleString('th-TH') : '-'}"`);
    });
    
    const blob = new Blob(['\uFEFF' + csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearAllExceptAdmin = async () => {
    if (!window.confirm('คุณต้องการรีเซ็ตข้อมูล (ลบผู้ใช้ทั่วไปและสตาฟทุกคน ยกเว้น Admin) ใช่หรือไม่?')) return;
    try {
      for (const u of users) {
        if (u.role !== 'admin' && u.email !== 'jaikladigital@gmail.com' && u.email !== 'admin@jaikladigital.com') {
          await deleteDoc(doc(db, 'users', u.id));
        }
      }
      alert('ลบข้อมูลสตาฟและผู้ใช้สำเร็จ');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 font-bold text-slate-600">กำลังโหลดข้อมูลผู้ใช้...</span>
      </div>
    );
  }

  const roleCounts = users.reduce((acc, user) => {
    acc[user.role || 'user'] = (acc[user.role || 'user'] || 0) + 1;
    acc.total = (acc.total || 0) + 1;
    return acc;
  }, { total: 0, admin: 0, staff: 0, user: 0 });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" /> 
          จัดการสิทธิ์ผู้ใช้งาน (Roles)
        </h2>
        <div className="flex gap-3">
          <button onClick={handleExportCSV} className="text-sm font-bold text-slate-500 hover:text-primary transition flex items-center gap-1">
            <Download className="w-4 h-4" /> ส่งออก (CSV)
          </button>
          <button onClick={handleClearAllExceptAdmin} className="text-sm font-bold text-rose-500 hover:text-rose-600 transition flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> เคลียร์สตาฟและผู้ใช้
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 print:hidden">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-slate-700">{roleCounts.total}</div>
          <div className="text-xs font-bold text-slate-500">ทั้งหมด (Total)</div>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-rose-600">{roleCounts.admin}</div>
          <div className="text-xs font-bold text-rose-500">Admin</div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-blue-600">{roleCounts.staff}</div>
          <div className="text-xs font-bold text-blue-500">Staff</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-emerald-600">{roleCounts.user}</div>
          <div className="text-xs font-bold text-emerald-500">User</div>
        </div>
      </div>
      
      {/* Create New User Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 print:hidden">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
          <UserPlus className="w-5 h-5 text-primary" />
          เพิ่มผู้ใช้ใหม่ (Add User)
        </h3>
        <form onSubmit={handleAddUser} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-primary text-sm"
              placeholder="user@example.com"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
            <input 
              type="password" 
              required
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-primary text-sm"
              placeholder="Min 6 chars"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-bold text-slate-500 mb-1">Role</label>
            <select 
              value={newRole}
              onChange={e => setNewRole(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-primary text-sm bg-white"
            >
              <option value="user">User</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={creatingUser}
            className="px-6 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition flex items-center gap-2 h-[38px]"
          >
            {creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'เพิ่ม (Add)'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none print:overflow-visible">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-800">Email</th>
                <th className="px-6 py-4 font-bold text-slate-800">Role</th>
                <th className="px-6 py-4 font-bold text-slate-800">Status</th>
                <th className="px-6 py-4 font-bold text-slate-800">Joined At</th>
                <th className="px-6 py-4 font-bold text-slate-800 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-800">{user.email}</td>
                  <td className="px-6 py-4 text-slate-800">
                    <select
                      value={user.role || 'user'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                      disabled={updatingId === user.id}
                      className="border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-sm focus:ring-2 focus:ring-primary/20 outline-none print:appearance-none print:border-none print:px-0 print:bg-transparent"
                    >
                      <option value="user">User</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-slate-800">
                    <select
                      value={user.status || 'approved'}
                      onChange={(e) => handleStatusChange(user.id, e.target.value as any)}
                      disabled={updatingId === user.id}
                      className={`border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none print:appearance-none print:border-none print:px-0 print:bg-transparent ${user.status === 'pending' ? 'text-amber-600 border-amber-300 bg-amber-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}`}
                    >
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-right print:hidden">
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={updatingId === user.id}
                      className="p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                      title="Remove privileges"
                    >
                      {updatingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    ไม่พบข้อมูลผู้ใช้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-slate-400 px-2 mt-4">
        * หมายเหตุ: การลบผู้ใช้ที่นี่ จะเป็นการลบข้อมูลสิทธิ์ในฐานข้อมูล (Users Collection) ทำให้ผู้ใช้นั้นมีสิทธิ์เป็นค่าเริ่มต้น (ไม่สามารถเข้าระบบ Staff/Admin ได้อีกจนกว่าจะตั้งค่าสิทธิ์ให้ใหม่)
      </div>
    </div>
  );
}
