// DOM元素
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const progressText = document.getElementById('progressText');
const searchLog = document.getElementById('searchLog');
const recordsList = document.getElementById('recordsList');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 获取当前状态
  updateStatus();
  
  // 获取积分记录
  loadRecords();
  
  // 获取设置
  loadSettings();
  
  // 设置事件监听器
  startBtn.addEventListener('click', startAutomation);
  stopBtn.addEventListener('click', stopAutomation);
  saveSettingsBtn.addEventListener('click', saveSettings);
  
  // 设置标签页切换
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // 更新标签页状态
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${tabId}Content`).classList.add('active');
    });
  });
  
  // 监听来自后台的状态更新
  chrome.runtime.onMessage.addListener((message) => {
    console.debug('收到消息:', message);
    if (message.type === 'statusUpdate') {
      updateUI(message);
    }
  });
});

// 获取当前状态
function updateStatus() {
  // 获取运行状态
  chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
    console.debug('获取到的状态:', response);
    if (response) {
      updateUI(response);
    }
  });
  
  // 获取当前积分
  chrome.runtime.sendMessage({ type: 'getCurrentPoints' }, (pointInfo) => {
    console.debug('获取到的积分:', pointInfo);
    const pointsElement = document.getElementById('currentPoints');
    if (pointsElement && pointInfo.points !== undefined) {
      pointsElement.textContent = `当前积分: ${pointInfo.points}`;
    } else if (pointsElement) {
      pointsElement.textContent = '当前积分: 获取失败';
    }
  });
}

// 更新UI
function updateUI(status) {
  // 更新进度条
  const progress = status.totalSearches > 0 
    ? (status.currentSearchCount / status.totalSearches) * 100 
    : 0;
  
  progressBar.style.width = `${progress}%`;
  progressText.textContent = `${status.currentSearchCount}/${status.totalSearches}`;
  
  // 更新状态文本和按钮状态
  if (status.isRunning) {
    statusText.textContent = '正在运行';
    startBtn.disabled = true;
    startBtn.textContent = '开始'; // 确保文本正确
    stopBtn.disabled = false;
    stopBtn.textContent = '停止'; // 确保文本正确
    
    // 为运行状态添加动态效果
    statusText.style.color = '#107c10';
    
    // 如果有积分信息，显示积分变化
    if (status.currentPoints !== undefined) {
      const pointsElement = document.getElementById('currentPoints');
      if (pointsElement) {
        pointsElement.textContent = `当前积分: ${status.currentPoints}`;
      }
    }
  } else {
    // 根据当前状态显示不同的文本
    if (status.currentSearchCount > 0) {
      // 计算成功搜索次数
      const successCount = status.searchResults.filter(r => r.success).length;
      statusText.textContent = `已完成 (成功率: ${Math.round((successCount / status.searchResults.length) * 100)}%)`;
      statusText.style.color = '#107c10';
    } else {
      statusText.textContent = '就绪';
      statusText.style.color = '#333';
    }
    
    startBtn.disabled = false;
    startBtn.textContent = '开始';
    stopBtn.disabled = true;
    stopBtn.textContent = '停止';
  }
  
  // 更新搜索日志
  updateSearchLog(status.searchResults);
}

// 更新搜索日志
function updateSearchLog(results) {
  searchLog.innerHTML = '';
  
  if (results.length === 0) {
    searchLog.innerHTML = '<div class="search-log-item">暂无搜索记录</div>';
    return;
  }
  
  // 只显示最近的10条记录
  const recentResults = results.slice(-10);
  
  recentResults.forEach(result => {
    const logItem = document.createElement('div');
    logItem.className = `search-log-item ${result.success ? 'search-success' : 'search-failed'}`;
    
    const statusIcon = result.success ? '✓' : '✗';
    const pointsText = result.success ? `+${result.points}` : '';
    
    logItem.textContent = `${statusIcon} ${result.keyword} ${pointsText}`;
    searchLog.appendChild(logItem);
  });
  
  // 滚动到底部
  searchLog.scrollTop = searchLog.scrollHeight;
}

// 加载积分记录
function loadRecords() {
  chrome.runtime.sendMessage({ type: 'getRecords' }, (response) => {
    console.debug('获取到的积分记录:', response);
    if (response && response.records) {
      displayRecords(response.records);
    }
  });
}

// 显示积分记录
function displayRecords(records) {
  recordsList.innerHTML = '';
  
  if (records.length === 0) {
    recordsList.innerHTML = '<div class="record-item"><div class="record-date">暂无积分记录</div></div>';
    return;
  }
  
  // 按日期降序排序
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // 只显示最近的10条记录
  const recentRecords = records.slice(0, 10);
  
  recentRecords.forEach(record => {
    const recordItem = document.createElement('div');
    recordItem.className = 'record-item';
    
    const date = new Date(record.date);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    recordItem.innerHTML = `
      <div class="record-date">${formattedDate} ${record.time}</div>
      <div class="record-details">
        <span>搜索: ${record.searches}次</span>
        <span>成功: ${record.successCount}次</span>
        <span>积分: +${record.earnedPoints}</span>
      </div>
    `;
    
    recordsList.appendChild(recordItem);
  });
}

// 加载设置
function loadSettings() {
  chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
    console.debug('获取到的设置:', response);
    if (response && response.settings) {
      document.getElementById('dailySearches').value = response.settings.dailySearches;
      document.getElementById('searchInterval').value = response.settings.searchInterval;
      document.getElementById('useHotTopics').checked = response.settings.useHotTopics;
      document.getElementById('hotTopicSource').value = response.settings.hotTopicSource;
    }
  });
}

// 保存设置
function saveSettings() {
  // 验证设置
  const dailySearches = parseInt(document.getElementById('dailySearches').value);
  const searchInterval = parseInt(document.getElementById('searchInterval').value);
  
  if (isNaN(dailySearches) || dailySearches <= 0) {
    showNotification('请输入有效的每日搜索次数', 'warning');
    return;
  }
  
  if (isNaN(searchInterval) || searchInterval <= 0) {
    showNotification('请输入有效的搜索间隔', 'warning');
    return;
  }
  
  // 设置按钮为加载状态
  saveSettingsBtn.disabled = true;
  saveSettingsBtn.textContent = '保存中...';
  saveSettingsBtn.style.opacity = '0.7';
  
  const settings = {
    dailySearches: dailySearches,
    searchInterval: searchInterval,
    useHotTopics: document.getElementById('useHotTopics').checked,
    hotTopicSource: document.getElementById('hotTopicSource').value
  };
  
  chrome.runtime.sendMessage({ type: 'saveSettings', settings }, (response) => {
    console.debug('保存设置响应:', response);
    // 恢复按钮状态
    saveSettingsBtn.disabled = false;
    saveSettingsBtn.textContent = '保存设置';
    saveSettingsBtn.style.opacity = '1';
    
    if (response && response.status === 'saved') {
      showNotification('设置已保存', 'success');
    } else {
      showNotification('保存设置失败，请稍后再试', 'error');
      console.error('保存设置失败:', response);
    }
  });
}

// 添加通知提示函数
function showNotification(message, type = 'info') {
  // 检查通知元素是否存在，不存在则创建
  let notification = document.getElementById('notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification';
    document.body.prepend(notification);
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .notification {
        position: fixed;
        bottom: 15px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .notification.show {
        opacity: 1;
      }
      .notification.info {
        background-color: #0078d4;
      }
      .notification.success {
        background-color: #107c10;
      }
      .notification.error {
        background-color: #e81123;
      }
      .notification.warning {
        background-color: #ffb900;
        color: #333;
      }
    `;
    document.head.appendChild(style);
  }
  
  // 设置消息和类型
  notification.textContent = message;
  notification.className = `notification ${type}`;
  
  // 显示通知
  setTimeout(() => notification.classList.add('show'), 10);
  
  // 3秒后隐藏通知
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// 开始自动化
function startAutomation() {
  // 设置按钮为加载状态
  startBtn.disabled = true;
  startBtn.textContent = '启动中...';
  startBtn.style.opacity = '0.7';
  
  chrome.runtime.sendMessage({ type: 'startAutomation' }, (response) => {
    console.debug('启动响应:', response);
    // 恢复按钮状态
    startBtn.style.opacity = '1';
    
    if (response && response.status === 'started') {
      updateStatus();
      showNotification('自动化搜索已开始', 'success');
    } else {
      startBtn.disabled = false;
      startBtn.textContent = '开始';
      showNotification('启动失败，请稍后再试', 'error');
      console.error('启动失败:', response);
    }
  });
}

// 停止自动化
function stopAutomation() {
  // 设置按钮为加载状态
  stopBtn.disabled = true;
  stopBtn.textContent = '停止中...';
  stopBtn.style.opacity = '0.7';
  
  chrome.runtime.sendMessage({ type: 'stopAutomation' }, (response) => {
    console.debug('停止响应:', response);
    // 恢复按钮状态
    stopBtn.style.opacity = '1';
    
    if (response && response.status === 'stopped') {
      updateStatus();
      showNotification('自动化搜索已停止', 'info');
    } else {
      stopBtn.disabled = false;
      stopBtn.textContent = '停止';
      showNotification('停止失败，请稍后再试', 'error');
      console.error('停止失败:', response);
    }
  });
}
