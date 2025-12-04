// src/App.tsx
import { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';
import { 
  CheckCircle2, AlertTriangle, FileText, 
  ChevronDown, ChevronUp, Share2, ClipboardCopy, 
  LayoutDashboard, ListTodo, Building2
} from 'lucide-react';
// Import from our local firebase file
import { db, auth } from './firebase'; 
import { 
  collection, doc, updateDoc, onSnapshot, 
  query, writeBatch, orderBy 
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Types ---
type Category = 'accreditation' | 'regulatory' | 'admin' | 'personnel' | 'client' | 'marketing';

interface Task {
  id: string;
  title: string;
  category: Category;
  isCompleted: boolean;
  isUrgent: boolean;
  note: string;
  subItems?: string[]; 
}

// --- Initial Data ---
const INITIAL_TASKS: Task[] = [
  {
    id: 'acc_1',
    title: '職業安全衛生顧問服務機構認可申請書 (附表二)',
    category: 'accreditation',
    isCompleted: false,
    isUrgent: true,
    note: '需加蓋機構大小章，確認勾選勞工健康顧問服務',
    subItems: ['填寫申請書', '蓋印鑑', '確認申請類別']
  },
  {
    id: 'acc_2',
    title: '營業處所 G2 類組證明 (關鍵)',
    category: 'accreditation',
    isCompleted: false,
    isUrgent: true,
    note: '使用執照必須註明 G2，否則會退件',
    subItems: ['確認使用執照', '若非 G2 需辦理變更']
  },
  {
    id: 'acc_3',
    title: '專職顧問人員配置 (4人以上)',
    category: 'accreditation',
    isCompleted: false,
    isUrgent: true,
    note: '需檢附投保證明，兼職不可算入此4人',
    subItems: ['蒐集畢業證書', '蒐集訓練合格證書', '蒐集離職/服務證明(2年資歷)']
  },
  {
    id: 'acc_4',
    title: '職業安全衛生顧問服務管理手冊',
    category: 'accreditation',
    isCompleted: false,
    isUrgent: true,
    note: '需包含SOP、組織圖、教育訓練計畫等7大章節'
  },
  {
    id: 'reg_1',
    title: '公司設立/變更登記',
    category: 'regulatory',
    isCompleted: true, 
    isUrgent: false,
    note: '確認營業項目含 IZ11010'
  },
  {
    id: 'reg_2',
    title: '負責人/主持人資格備查',
    category: 'regulatory',
    isCompleted: false,
    isUrgent: true,
    note: '需簽署未兼任切結書'
  },
  {
    id: 'adm_1',
    title: '儀器與設備採購',
    category: 'admin',
    isCompleted: false,
    isUrgent: false,
    note: '基本測量設備、電腦資訊設備',
    subItems: ['採購電腦/伺服器', '採購血壓計/測量儀器']
  },
  {
    id: 'adm_2',
    title: '勞工健康管理系統導入',
    category: 'admin',
    isCompleted: false,
    isUrgent: false,
    note: '需符合資安法規與個資保護'
  },
  {
    id: 'per_1',
    title: '員工勞健保與團保',
    category: 'personnel',
    isCompleted: false,
    isUrgent: false,
    note: '完成投保作業'
  },
  {
    id: 'per_2',
    title: '新進人員職前訓練',
    category: 'personnel',
    isCompleted: false,
    isUrgent: false,
    note: '系統操作、內部SOP教學'
  },
  {
    id: 'cli_1',
    title: '標準服務合約書定稿',
    category: 'client',
    isCompleted: false,
    isUrgent: true,
    note: '需經法律顧問審閱'
  },
  {
    id: 'mkt_1',
    title: '官方網站建置',
    category: 'marketing',
    isCompleted: false,
    isUrgent: false,
    note: '強調合規性與專業團隊'
  },
   {
    id: 'mkt_2',
    title: '拜訪工業區服務中心',
    category: 'marketing',
    isCompleted: false,
    isUrgent: false,
    note: '安排拜訪行程，尋求合作機會'
  }
];

const CATEGORY_LABELS: Record<Category, string> = {
  accreditation: '機構認可申請 (緊急)',
  regulatory: '法規遵循',
  admin: '行政管理',
  personnel: '人員管理',
  client: '客戶管理',
  marketing: '行銷活動'
};

const CATEGORY_COLORS: Record<Category, string> = {
  accreditation: '#ef4444', // Red
  regulatory: '#f97316', // Orange
  admin: '#3b82f6', // Blue
  personnel: '#10b981', // Emerald
  client: '#8b5cf6', // Violet
  marketing: '#ec4899' // Pink
};

// --- Sub Components ---

const TaskItem = ({ task, onToggle, onUpdateNote }: { task: Task, onToggle: (id: string, val: boolean) => void, onUpdateNote: (id: string, note: string) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [noteTemp, setNoteTemp] = useState(task.note);

  const handleSaveNote = () => {
    onUpdateNote(task.id, noteTemp);
    setIsEditing(false);
  };

  return (
    <div className={`p-4 mb-3 bg-white rounded-lg shadow-sm border-l-4 transition-all ${task.isCompleted ? 'border-green-500 opacity-70' : task.isUrgent ? 'border-red-500' : 'border-blue-400'}`}>
      <div className="flex items-start gap-3">
        <button 
          onClick={() => onToggle(task.id, !task.isCompleted)}
          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-slate-400'}`}
        >
          {task.isCompleted && <CheckCircle2 size={16} />}
        </button>
        
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className={`font-medium text-slate-800 ${task.isCompleted ? 'line-through text-slate-500' : ''}`}>
              {task.title}
            </h3>
            {task.isUrgent && !task.isCompleted && (
              <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <AlertTriangle size={12} />
                緊急
              </span>
            )}
          </div>
          
          {task.subItems && task.subItems.length > 0 && (
             <ul className="mt-2 ml-1 space-y-1">
                {task.subItems.map((sub, idx) => (
                  <li key={idx} className="text-xs text-slate-500 flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-slate-400" />
                    {sub}
                  </li>
                ))}
             </ul>
          )}

          <div className="mt-3">
            {isEditing ? (
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={noteTemp}
                  onChange={(e) => setNoteTemp(e.target.value)}
                  className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="新增備註..."
                />
                <button onClick={handleSaveNote} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">儲存</button>
              </div>
            ) : (
              <div 
                onClick={() => setIsEditing(true)}
                className="text-sm text-slate-500 hover:text-blue-600 cursor-pointer flex items-center gap-1 group"
              >
                <FileText size={14} className="group-hover:text-blue-600" />
                {task.note || "點擊新增備註..."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReportModal = ({ tasks, onClose }: { tasks: Task[], onClose: () => void }) => {
  const completed = tasks.filter(t => t.isCompleted).length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const urgentPending = tasks.filter(t => t.isUrgent && !t.isCompleted);

  const generateReportText = () => {
    const today = new Date().toLocaleDateString('zh-TW');
    let text = `【勞工健康機構建置進度報告】\n日期：${today}\n\n`;
    text += `📊 目前總進度：${progress}%\n`;
    text += `✅ 已完成項目：${completed}/${total}\n\n`;
    
    if (urgentPending.length > 0) {
      text += `⚠️ 滯後緊急項目 (需優先處理)：\n`;
      urgentPending.forEach(t => text += `- ${t.title}\n`);
      text += `\n`;
    }

    text += `📋 下階段重點：\n請團隊優先完成「認可申請」相關佐證文件蒐集。\n`;
    return text;
  };

  const copyToClipboard = () => {
    const text = generateReportText();
    // 使用現代 Clipboard API
    navigator.clipboard.writeText(text).then(() => {
      alert('報告已複製到剪貼簿！');
    }).catch(err => {
      console.error('複製失敗:', err);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2"><Share2 size={18} /> 產生股東報告</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">預覽內容：</p>
          <div className="bg-slate-100 p-4 rounded-lg text-sm whitespace-pre-wrap font-mono mb-6 max-h-60 overflow-y-auto border border-slate-200">
            {generateReportText()}
          </div>
          <button 
            onClick={copyToClipboard}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <ClipboardCopy size={18} /> 複製文字報告
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'checklist'>('dashboard');
  const [showReport, setShowReport] = useState(false);
  const [expandedCat, setExpandedCat] = useState<Category | null>('accreditation');

  // Auth & Init Data
  useEffect(() => {
    // 1. 監聽登入狀態
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
      } else {
        // 若未登入，自動匿名登入
        await signInAnonymously(auth);
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;

    // 2. 修改資料庫路徑為根目錄 'health_tasks'
    const q = query(collection(db, 'health_tasks'), orderBy('id'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Initialize if empty
        const batch = writeBatch(db);
        INITIAL_TASKS.forEach(task => {
          const docRef = doc(db, 'health_tasks', task.id);
          batch.set(docRef, task);
        });
        batch.commit();
      } else {
        const loadedTasks = snapshot.docs.map(d => d.data() as Task);
        setTasks(loadedTasks);
      }
      setLoading(false);
    }, (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Actions
  const toggleTask = async (id: string, newVal: boolean) => {
    if (!user) return;
    const taskRef = doc(db, 'health_tasks', id);
    await updateDoc(taskRef, { isCompleted: newVal });
  };

  const updateNote = async (id: string, newNote: string) => {
    if (!user) return;
    const taskRef = doc(db, 'health_tasks', id);
    await updateDoc(taskRef, { note: newNote });
  };

  // Metrics Calculation
  const completedCount = tasks.filter(t => t.isCompleted).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const urgentTasks = tasks.filter(t => t.isUrgent && !t.isCompleted);

  const chartData = useMemo(() => {
    const categories = Array.from(new Set(tasks.map(t => t.category)));
    return categories.map(cat => {
      const catTasks = tasks.filter(t => t.category === cat);
      return {
        name: CATEGORY_LABELS[cat].split(' ')[0],
        completed: catTasks.filter(t => t.isCompleted).length,
        total: catTasks.length,
        fullLabel: CATEGORY_LABELS[cat]
      };
    });
  }, [tasks]);

  const pieData = [
    { name: '已完成', value: completedCount },
    { name: '未完成', value: tasks.length - completedCount }
  ];
  const COLORS = ['#10b981', '#cbd5e1'];

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">系統載入中...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Building2 size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-900">HealthCheck Pro</h1>
              <p className="text-xs text-slate-500">機構建置進度管理</p>
            </div>
          </div>
          <button 
            onClick={() => setShowReport(true)}
            className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <Share2 size={16} />
            <span className="hidden sm:inline">股東報告</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Alerts */}
        {urgentTasks.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 p-2 rounded-full text-red-600">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-red-800 mb-1">注意：有 {urgentTasks.length} 項緊急工作滯後</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {urgentTasks.map(t => (
                    <div key={t.id} onClick={() => setActiveTab('checklist')} className="bg-white p-2 rounded border border-red-100 text-sm text-red-700 flex items-center gap-2 cursor-pointer hover:bg-red-50 transition-colors shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      {t.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Tabs */}
        <div className="flex p-1 bg-slate-200 rounded-lg sm:hidden">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
          >
            儀表板
          </button>
          <button 
            onClick={() => setActiveTab('checklist')} 
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'checklist' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
          >
            檢核清單
          </button>
        </div>

        {/* Dashboard View */}
        <div className={`${activeTab === 'checklist' ? 'hidden sm:block' : 'block'} space-y-6`}>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                <h3 className="text-slate-500 font-medium mb-4 w-full text-left flex items-center gap-2">
                  <LayoutDashboard size={18} /> 總體進度
                </h3>
                <div className="w-40 h-40 relative">
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-3xl font-bold text-slate-800">{progress}%</span>
                      <span className="text-xs text-slate-400">已完成</span>
                   </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-slate-500 font-medium mb-4 flex items-center gap-2">
                  <ListTodo size={18} /> 各類別完成狀況
                </h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                      <Bar dataKey="completed" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                      <Bar dataKey="total" stackId="a" fill="#f1f5f9" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
           </div>
        </div>

        {/* Checklist View */}
        <div className={`${activeTab === 'dashboard' ? 'hidden sm:block' : 'block'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-blue-600" />
              工作檢核清單
            </h2>
          </div>

          <div className="space-y-4">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => {
               const catTasks = tasks.filter(t => t.category === cat);
               const catCompleted = catTasks.filter(t => t.isCompleted).length;
               const isExpanded = expandedCat === cat;

               return (
                 <div key={cat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <button 
                    onClick={() => setExpandedCat(isExpanded ? null : cat)}
                    className="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                   >
                     <div className="flex items-center gap-3">
                        <div className={`w-2 h-8 rounded-full`} style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                        <div className="text-left">
                          <h3 className="font-bold text-slate-800">{CATEGORY_LABELS[cat]}</h3>
                          <p className="text-xs text-slate-500">進度：{catCompleted} / {catTasks.length}</p>
                        </div>
                     </div>
                     {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                   </button>
                   
                   {isExpanded && (
                     <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                        {catTasks.map(task => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            onToggle={toggleTask}
                            onUpdateNote={updateNote}
                          />
                        ))}
                     </div>
                   )}
                 </div>
               );
            })}
          </div>
        </div>
      </main>
      {showReport && <ReportModal tasks={tasks} onClose={() => setShowReport(false)} />}
    </div>
  );
}