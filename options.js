// DOM元素
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const statusMessage = document.getElementById('statusMessage');

// 默认设置
const defaultSettings = {
  enableAutomation: true,
  dailySearches: 50,
  searchInterval: 15,
  autoRunTime: '09:00',
  useHotTopics: true,
  hotTopicSource: 'baidu',
  customKeywords: `Microsoft Edge 最新更新
Windows 11 新功能
Microsoft 365 使用技巧
人工智能最新发展
云计算技术趋势
数据分析方法
网络安全最佳实践
远程工作工具
数字营销策略
机器学习入门`,
  enableDetailedLogging: false,
  maxRetryCount: 3,
  userAgent: ''
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载设置
  loadSettings();
  
  // 设置事件监听器
  saveBtn.addEventListener('click', saveSettings);
  resetBtn.addEventListener('click', resetSettings);
});

// 加载设置
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = { ...defaultSettings, ...result.settings };
    
    // 加载基本设置
    document.getElementById('enableAutomation').checked = settings.enableAutomation;
    document.getElementById('dailySearches').value = settings.dailySearches;
    document.getElementById('searchInterval').value = settings.searchInterval;
    document.getElementById('autoRunTime').value = settings.autoRunTime || '09:00';
    
    // 加载搜索设置
    document.getElementById('useHotTopics').checked = settings.useHotTopics;
    document.getElementById('hotTopicSource').value = settings.hotTopicSource;
    document.getElementById('customKeywords').value = settings.customKeywords || defaultSettings.customKeywords;
    
    // 加载高级设置
    document.getElementById('enableDetailedLogging').checked = settings.enableDetailedLogging;
    document.getElementById('maxRetryCount').value = settings.maxRetryCount;
    document.getElementById('userAgent').value = settings.userAgent || '';
  });
}

// 保存设置
function saveSettings() {
  const settings = {
    enableAutomation: document.getElementById('enableAutomation').checked,
    dailySearches: parseInt(document.getElementById('dailySearches').value),
    searchInterval: parseInt(document.getElementById('searchInterval').value),
    autoRunTime: document.getElementById('autoRunTime').value,
    useHotTopics: document.getElementById('useHotTopics').checked,
    hotTopicSource: document.getElementById('hotTopicSource').value,
    customKeywords: document.getElementById('customKeywords').value,
    enableDetailedLogging: document.getElementById('enableDetailedLogging').checked,
    maxRetryCount: parseInt(document.getElementById('maxRetryCount').value),
    userAgent: document.getElementById('userAgent').value
  };
  
  chrome.storage.local.set({ settings }, () => {
    showStatus('设置已保存', 'success');
    
    // 通知background.js设置已更新
    chrome.runtime.sendMessage({ type: 'settingsUpdated', settings });
  });
}

// 重置设置
function resetSettings() {
  if (confirm('确定要恢复默认设置吗？')) {
    chrome.storage.local.set({ settings: defaultSettings }, () => {
      loadSettings();
      showStatus('已恢复默认设置', 'success');
      
      // 通知background.js设置已更新
      chrome.runtime.sendMessage({ type: 'settingsUpdated', settings: defaultSettings });
    });
  }
}

// 显示状态消息
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  
  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 3000);
}
