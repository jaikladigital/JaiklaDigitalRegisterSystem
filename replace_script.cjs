const fs = require('fs');

let content = fs.readFileSync('src/components/AdminDashboardView.tsx', 'utf-8');

// We want to replace sets of `setConfig({...config, field: value})` with `handleUpdateLocalConfig({field: value})`
// Actually, it's easier to just replace `setConfig({...config,` with `handleUpdateLocalConfig({` in most places except for specific ones.
// Wait, `handleUpdateLocalConfig` only takes the updates. So `handleUpdateLocalConfig({ field: value })`.
// The regex: `setConfig({\s*\.\.\.config,\s*([^}]*)\s*})` -> `handleUpdateLocalConfig({$1})`

content = content.replace(/setConfig\(\{\s*\.\.\.config,\s*([^}]+)\}\)/g, 'handleUpdateLocalConfig({$1})');

// We also need to change `config.something` to `localConfig.something` inside JSX.
content = content.replace(/config\./g, 'localConfig.');

// Fix imports and variable declarations
// The `config.` to `localConfig.` might have broken `const { config, setConfig } = useContext(ConfigContext);`
// It probably became `const { localConfig, setConfig } = useContext(ConfigContext);` which we need to fix back.
content = content.replace(/const { localConfig, setConfig } = useContext\(ConfigContext\);/, 'const { config, setConfig } = useContext(ConfigContext);');

// And we need to insert the state for localConfig.
const localConfigState = `
  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Sync localConfig on initial load if we don't have changes
    if (!hasChanges) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleUpdateLocalConfig = (updates: any) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSaveConfig = async () => {
    try {
      await setConfig(localConfig);
      setHasChanges(false);
      alert('บันทึกการตั้งค่าสำเร็จ');
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
      console.error(e);
    }
  };

  const handleResetConfig = () => {
    if (window.confirm('คุณต้องการยกเลิกการแก้ไขและคืนค่าเริ่มต้นหรือไม่?')) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  };
`;

content = content.replace('const activeZones =', localConfigState + '\n  const activeZones =');

// We need to inject the save/reset buttons.
// Let's create a Floating Action Bar or put it at the very top of settings.
// I will just add the FAB.
const fab = `
      {/* Floating Save Settings Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 px-4 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="text-sm font-medium text-slate-600 hidden sm:block">
            มีการเปลี่ยนแปลงรอการบันทึก
          </div>
          <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
          <button 
            onClick={handleResetConfig}
            className="text-slate-500 hover:text-slate-800 text-sm font-bold px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            คืนค่าเริ่มต้น
          </button>
          <button 
            onClick={handleSaveConfig}
            className="bg-primary text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-sm shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> บันทึกการตั้งค่า
          </button>
        </div>
      )}
`;

content = content.replace('{activeTab === \'emails\' && (', fab + '\n      {activeTab === \'emails\' && (');
content = content.replace('{activeTab === \'notifications\' && (', fab + '\n      {activeTab === \'notifications\' && (');
content = content.replace(/\\{activeTab === 'overview' \\?/g, fab + `\\n      {activeTab === 'overview' ?`);

// One more fix: config.zones might have been changed in handleSaveConfig
// wait, we replaced config. with localConfig.
// Let's make sure that's everywhere.

fs.writeFileSync('src/components/AdminDashboardView.tsx', content);

console.log("Done");
