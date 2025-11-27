// 全局变量
let isRunning = false;
let currentSearchCount = 0;
let totalSearches = 50;
let searchResults = [];

let initialPoints = 0;
let finalPoints = 0;

// 默认关键词列表（当无法获取热点时使用）
const defaultKeywords = [
  "Microsoft Edge 最新更新", "Windows 11 新功能", "Microsoft 365 使用技巧",
  "人工智能最新发展", "云计算技术趋势", "数据分析方法",
  "网络安全最佳实践", "远程工作工具", "数字营销策略",
  "机器学习入门", "区块链应用", "5G技术应用",
  "虚拟现实体验", "增强现实应用", "元宇宙概念",
  "量子计算进展", "太空探索新闻", "气候变化研究",
  "健康生活方式", "可持续发展目标", " renewable energy",
  "电动汽车技术", "自动驾驶进展", "智能家居设备",
  "游戏产业新闻", "影视娱乐资讯", "音乐流媒体服务",
  "社交媒体趋势", "电子商务平台", "在线教育资源",
  "远程医疗服务", "心理健康关注", "营养饮食建议",
  "旅行目的地推荐", "美食烹饪技巧", "时尚设计趋势",
  "体育赛事新闻", "历史文化探索", "科学技术突破",
  "编程语言学习", "软件开发工具", "移动应用开发",
  "Web设计趋势", "用户体验优化", "内容创作技巧",
  "数字摄影教程", "视频编辑软件", "音频制作工具"
];

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log("Microsoft Rewards Automator installed");

  // 初始化存储
  chrome.storage.local.get(['searchHistory', 'pointRecords', 'settings'], (result) => {
    if (!result.searchHistory) {
      chrome.storage.local.set({ searchHistory: [] });
    }
    if (!result.pointRecords) {
      chrome.storage.local.set({ pointRecords: [] });
    }
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          dailySearches: 50,
          searchInterval: 15, // 秒
          useHotTopics: true,
          hotTopicSource: "baidu" // "baidu", "weibo", "zhihu"
        }
      });
    } else {
      totalSearches = result.settings.dailySearches;
    }
  });
});

// 获取热点关键词
async function getHotKeywords(source = "baidu") {
  try {
    let response, data;

    // 先检查响应状态
    const fetchWithCheck = async (url) => {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }

      // 检查响应内容类型
      const contentType = resp.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }

      console.debug('获取热点:', source, resp);
      return resp;
    };

    // 健壮的JSON解析函数
    const robustJSONParse = (text) => {
      let cleaned;
      try {
        // 基本清理
        cleaned = text.trim().replace(/^\ufeff/, '');

        // 处理可能的转义字符问题
        cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

        // 处理特殊字符
        cleaned = cleaned.replace(/[\x00-\x1F]/g, '');

        // 尝试正常解析
        return JSON.parse(cleaned);
      } catch (e) {
        console.error('首次解析失败，尝试使用正则提取数据:', e);

        // 尝试使用正则表达式提取有效JSON部分
        try {
          // 匹配完整的JSON对象结构
          const jsonMatch = cleaned.match(/\{[^{}]*"data"\s*:\s*\[[^\]]*\][^{}]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('无法匹配有效的JSON结构');
          }
        } catch (e2) {
          console.error('正则提取失败，尝试使用更宽松的解析:', e2);

          // 尝试使用JSON5风格的宽松解析
          try {
            // 替换单引号为双引号
            let json5Like = cleaned.replace(/'/g, '"');
            // 移除末尾可能的逗号
            json5Like = json5Like.replace(/,\s*([}\]])/g, '$1');
            // 处理未加引号的键
            json5Like = json5Like.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

            return JSON.parse(json5Like);
          } catch (e3) {
            console.error('宽松解析失败:', e3);
            throw new Error('JSON解析完全失败');
          }
        }
      }
    };

    // 统一的热点数据获取和解析逻辑
    const fetchAndParseHotTopics = async (url) => {
      response = await fetchWithCheck(url);
      const text = await response.text();

      // console.log('数据长度:', text.length);
      // console.log('数据前100字符:', text.substring(0, 100));
      // console.log('数据后100字符:', text.substring(text.length - 100));
      // console.log('text:', text);

      try {
        data = robustJSONParse(text);
        // console.log('解析后的数据:', data);
        console.log('解析后的数据结构:', data ? { hasCode: !!data.code, hasTitle: !!data.title, hasData: !!data.data && Array.isArray(data.data) && data.data.length > 0, dataType: Array.isArray(data.data) ? 'array' : typeof data.data } : '无数据');
      } catch (parseError) {
        console.error('热点数据解析失败:', parseError);
        throw new Error('热点数据解析失败');
      }

      if (data && data.data && Array.isArray(data.data)) {
        const keywords = data.data.map(item => item.title).filter(Boolean);
        console.log('提取的关键词数量:', keywords.length);
        console.log('部分关键词示例:', keywords.slice(0, 5));
        return {
          code: data?.code || 1,
          title: data?.title || '热点数据',
          source: source,
          success: true,
          keywords: keywords,
          message: '成功获取热点数据'
        };
      }

      throw new Error("Invalid data structure in response");
    };

    switch (source) {
      case "baidu":
        // https://api.aa1.cn/doc/baidu-rs.html
        return await fetchAndParseHotTopics("https://zj.v.api.aa1.cn/api/baidu-rs/");

      case "weibo":
        // https://api.aa1.cn/doc/weibo-rs.html
        return await fetchAndParseHotTopics("https://zj.v.api.aa1.cn/api/weibo-rs/");

      case "zhihu":
        // https://api.aa1.cn/doc/zhihu-rs.html
        return await fetchAndParseHotTopics("https://zj.v.api.aa1.cn/api/zhihu-rs/");

      default:
        return {
          code: 1,
          title: '热点数据',
          source: source,
          success: true,
          keywords: defaultKeywords,
          message: `获取${source}热点数据暂不支持，使用默认关键词`
        };
    }
  } catch (error) {
    console.error("Failed to get hot keywords:", error);
    // 返回默认关键词，确保功能不会中断
    return {
      code: 1,
      title: '热点数据',
      source: source,
      success: false,
      keywords: defaultKeywords,
      message: `获取${source}热点数据失败，使用默认关键词: ${error.message || '请求异常'}`
    };
  }
}


// 获取当前积分
async function getCurrentPoints() {
  return new Promise((resolve) => {
    // 即使获取积分失败，也不要reject，而是返回一个默认值，确保流程能继续
    chrome.tabs.create({ url: "https://rewards.microsoft.com/", active: false }, (tab) => {
      // 监听标签页加载完成事件
      const onUpdatedListener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          // 页面加载完成后移除监听器
          chrome.tabs.onUpdated.removeListener(onUpdatedListener);

          // 先检查标签页是否仍然存在
          chrome.tabs.get(tab.id, (tabInfo) => {
            if (chrome.runtime.lastError || !tabInfo) {
              // 标签页已不存在
              console.warn(`Tab ${tab.id} no longer exists for points retrieval`);
              try {
                chrome.tabs.remove(tab.id);
              } catch (removeError) {
                // 忽略移除错误
              }
              resolve(0); // 返回0而不是reject
              return;
            }

            try {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: async () => {
                  console.log("开始提取积分: ", document.readyState);

                  const pointInfo = {
                    points: null,
                    selector: null,
                    content: null,
                    counter: null
                  };

                  // 处理积分文本的辅助函数，支持带逗号的数字格式
                  const extractPoints = (text) => {
                    if (!text) return null;
                    // 移除逗号等千位分隔符
                    const cleanText = text.replace(/,/g, '');
                    const match = cleanText.match(/\d+/);
                    return match ? parseInt(match[0], 10) : null;
                  };

                  // 解析奖励脚本内容
                  const parseDashboardScriptContent = function (dashboard) {
                    try {
                      if (dashboard) {

                        // 安全处理morePromotions
                        let morePromotions = [];
                        if (dashboard?.morePromotions && Array.isArray(dashboard?.morePromotions)) {
                          dashboard?.morePromotions.forEach(item => {
                            if (item?.attributes) {
                              morePromotions.push(item?.attributes);
                            }
                          });
                        }

                        const dashboardData = {
                          // dashboard: dashboard, // 原始数据，用于调试
                          points: dashboard?.userStatus?.availablePoints || 0,
                          counter: {
                            dailyPoint_progress: dashboard?.userStatus?.counters?.dailyPoint?.[0]?.pointProgress || 0,
                            dailyPoint_max: dashboard?.userStatus?.counters?.dailyPoint?.[0]?.pointProgressMax || 0,
                            activityAndQuiz: {
                              pointProgress: dashboard?.userStatus?.counters?.activityAndQuiz?.[0]?.pointProgress || 0,
                              pointProgressMax: dashboard?.userStatus?.counters?.activityAndQuiz?.[0]?.pointProgressMax || 0,
                              destinationUrl: dashboard?.userStatus?.counters?.activityAndQuiz?.[0]?.destinationUrl || "",
                            },
                            pcSearch: {
                              pointProgress: dashboard?.userStatus?.counters?.pcSearch?.[0]?.pointProgress || 0,
                              pointProgressMax: dashboard?.userStatus?.counters?.pcSearch?.[0]?.pointProgressMax || 0,
                              destinationUrl: dashboard?.userStatus?.counters?.pcSearch?.[0]?.destinationUrl || "",
                            },
                            mobileSearch: {
                              pointProgress: dashboard?.userStatus?.counters?.mobileSearch?.[0]?.pointProgress || 0,
                              pointProgressMax: dashboard?.userStatus?.counters?.mobileSearch?.[0]?.pointProgressMax || 0,
                              destinationUrl: dashboard?.userStatus?.counters?.mobileSearch?.[0]?.destinationUrl || "",
                            },
                          },
                          morePromotions: morePromotions,
                        }

                        return dashboardData;
                      }
                      return null;
                    } catch (error) {
                      console.error('解析奖励脚本内容时出错:', error);
                      return null;
                    }
                  }

                  // 1. 尝试提取特定的script标签内容
                  let parsedRewardsData = null;
                  try {
                    let rewardsScriptContent = null;
                    const scriptTags = document.querySelectorAll('script[type="text/javascript"]');
                    for (const scriptTag of scriptTags) {
                      const content = scriptTag.textContent.trim();
                      if (content.includes('dashboard') && content.includes('MeePortal.Rewards')) {
                        rewardsScriptContent = content;
                        console.log('找到奖励脚本内容:', rewardsScriptContent.substring(0, 100) + '...');
                        break;
                      }
                    }

                    if (rewardsScriptContent) {
                      // 尝试从脚本内容中提取RewardsSessionData对象
                      // 查找以"dashboard":{ 开头，以 } 结尾的JSON字符串
                      const sessionDataMatch = rewardsScriptContent.match(/var dashboard\s*=\s*({.*?});/s);
                      if (sessionDataMatch && sessionDataMatch[1]) {
                        // 提取JSON字符串
                        const jsonString = sessionDataMatch[1];
                        // 尝试解析JSON
                        const dashboardData = JSON.parse(jsonString);
                        // 解析脚本内容中的用户信息和积分数据
                        parsedRewardsData = parseDashboardScriptContent(dashboardData);
                        if (parsedRewardsData) {
                          console.log('成功解析脚本内容:', parsedRewardsData);
                        }
                      }
                    } else {
                      console.log('未找到奖励脚本内容');
                    }
                  } catch (e) {
                    console.error('从页面提取dashboard对象时出错:', e);
                  }

                  // 2. 尝试从window对象中提取积分 - dashboard
                  if (!parsedRewardsData) {
                    try {
                      if (window.dashboard || dashboard) {
                        parsedRewardsData = parseDashboardScriptContent(window.dashboard || dashboard);
                        if (parsedRewardsData) {
                          console.log('成功解析脚本内容:', parsedRewardsData);
                        }
                      } else {
                        console.log('window对象中未找到dashboard对象');
                      }
                    } catch (e) {
                      console.warn("从window对象提取积分失败:", e);
                    }
                  }

                  // 3. 直接从页面元素中提取
                  if (!parsedRewardsData) {

                    // 检查元素内容是否稳定的辅助函数
                    const isContentStable = (element, checkInterval = 200, checkTimes = 5) => {
                      if (!element) return true;

                      let previousContent = -1;
                      let stableCount = 0;

                      return new Promise((resolve) => {
                        const checkContent = () => {
                          // 优先获取aria-label属性，如果没有则获取textContent
                          const content = element.getAttribute('aria-label') || element.textContent;
                          console.log("检查元素内容:", stableCount, previousContent, content);

                          if (content && previousContent && (content === previousContent)) {
                            stableCount++;
                            if (stableCount >= checkTimes) {
                              resolve(true); // 内容稳定
                            } else {
                              setTimeout(checkContent, checkInterval);
                            }
                          } else {
                            stableCount = 0;
                            previousContent = content;
                            setTimeout(checkContent, checkInterval);
                          }
                        };

                        checkContent();
                      });
                    };

                    // 等待动画完成的函数
                    const waitForAnimationComplete = (element, maxWaitTime = 5000, checkInterval = 200) => {
                      return new Promise((resolve) => {
                        const startTime = Date.now();

                        const checkAnimation = async () => {
                          const elapsed = Date.now() - startTime;

                          if (elapsed >= maxWaitTime) {
                            resolve(); // 超时，不再等待
                          } else {
                            const isStable = await isContentStable(element, checkInterval);
                            if (isStable) {
                              resolve(); // 内容稳定，动画完成
                            } else {
                              setTimeout(checkAnimation, checkInterval);
                            }
                          }
                        };

                        checkAnimation();
                      });
                    };

                    // 尝试多种可能的选择器来获取积分信息
                    const pointSelectors = [
                      // 新增支持mee-rewards-counter-animation结构
                      'mee-rewards-counter-animation span',
                      'mee-rewards-counter-animation',
                      // 原有选择器
                      '.points-balance',
                      '.points-container[data-tag="RewardsHeader.Counter"]',
                      // 尝试通过aria-label属性查找
                      '[aria-label*="积分"]',
                      '[aria-label*="points"]'
                    ];

                    // 按优先级尝试每个选择器
                    for (const selector of pointSelectors) {
                      let element = document.querySelector(selector);
                      console.log(`尝试选择器 ${selector}:`, element);

                      // 处理mee-rewards-counter-animation的特殊情况
                      if ((selector === 'mee-rewards-counter-animation' || selector === 'mee-rewards-counter-animation span') && element) {
                        // 确保获取到最内层的元素
                        if (selector === 'mee-rewards-counter-animation' && element.querySelector('span')) {
                          element = element.querySelector('span');
                        }

                        // 等待动画完成
                        await waitForAnimationComplete(element);
                      }

                      if (element) {
                        let textContent = null;
                        // 优先检查aria-label属性
                        if (element.getAttribute('aria-label')) {
                          textContent = element.getAttribute('aria-label');
                          console.log(`积分 ${selector} aria-label:`, textContent);
                        } else {
                          textContent = element.textContent.trim();
                        }
                        // 然后检查textContent
                        const points = extractPoints(textContent);
                        console.log(`积分 ${selector}:`, points);
                        if (points !== null) {
                          pointInfo.points = points;
                          pointInfo.selector = selector;
                          pointInfo.content = textContent;
                          return pointInfo;
                        }
                      }
                    }

                    // 兜底方案：尝试查找包含积分的文本元素
                    const elements = document.querySelectorAll('*');
                    for (let element of elements) {
                      if (element.textContent && /积分|points|点数/.test(element.textContent)) {
                        const points = extractPoints(element.textContent);
                        console.log(`积分 /积分|points|点数/:`, points);
                        if (points !== null) {
                          pointInfo.points = points;
                          pointInfo.selector = selector;
                          pointInfo.content = element.textContent;
                          return pointInfo;
                        }
                      }
                    }
                  }

                  const result = {
                    ...pointInfo,
                    ...parsedRewardsData,
                  }
                  return result;
                }
              }, (injectionResults) => {
                console.debug('注入积分脚本结果:', injectionResults);
                // 无论结果如何，都尝试关闭标签页
                try {
                  chrome.tabs.remove(tab.id);
                } catch (removeError) {
                  console.warn(`Failed to remove tab ${tab.id}:`, removeError);
                }

                if (injectionResults && injectionResults[0] && injectionResults[0].result !== null) {
                  resolve(injectionResults[0].result);
                } else {
                  console.warn("Failed to retrieve points, continuing with default value");
                  resolve(0); // 返回0而不是reject
                }
              });
            } catch (error) {
              console.error("Error executing points retrieval script:", error);
              // 尝试关闭标签页
              try {
                chrome.tabs.remove(tab.id);
              } catch (removeError) {
                console.warn(`Failed to remove tab ${tab.id}:`, removeError);
              }
              resolve(0); // 返回0而不是reject
            }
          });
        }
      };

      // 添加标签页更新监听器
      chrome.tabs.onUpdated.addListener(onUpdatedListener);
    });
  });
}

async function openNewTab(title, targetUrl) {

  if (!targetUrl || !targetUrl.startsWith('http')) {
    console.error(`任务 ${title} 的URL无效:`, targetUrl);
    return {
      title: title || "未知任务",
      targetUrl: targetUrl || "unknown",
      timestamp: new Date().toISOString(),
      success: false,
      points: "0",
      error: "Invalid destination URL"
    };
  }
  return new Promise((resolve) => {
    console.debug(`打开新标签页: ${title}`, { title, targetUrl });

    chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
      setTimeout(() => {
        // 检查tab创建是否成功
        if (chrome.runtime.lastError || !tab) {
          console.error(`创建标签失败: ${chrome.runtime.lastError?.message}`);
          resolve({
            title: title,
            targetUrl: targetUrl,
            timestamp: new Date().toISOString(),
            success: false,
            points: "0",
            error: chrome.runtime.lastError?.message || "Failed to create tab"
          });
          return;
        }

        console.log(`已创建标签ID: ${tab.id} 用于任务: ${title}`);

        // 先检查标签页是否仍然存在
        chrome.tabs.get(tab.id, (tabInfo) => {
          if (chrome.runtime.lastError || !tabInfo) {
            // 标签页已不存在
            console.warn(`Tab ${tab.id} no longer exists for search: ${title}`);
            const result = {
              title: title,
              targetUrl: targetUrl,
              timestamp: new Date().toISOString(),
              success: false,
              points: "0",
              totalPoints: "0",
              error: "Tab closed or unavailable"
            };
            resolve(result);
            return;
          }

          try {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => {

                console.log(`开始执行注入脚本获取积分`);

                // 处理积分文本的辅助函数，支持带逗号的数字格式
                const extractPoints = (text) => {
                  if (!text) return null;
                  // 移除逗号等千位分隔符
                  const cleanText = text.replace(/,/g, '');
                  const match = cleanText.match(/\d+/);
                  return match ? parseInt(match[0], 10) : null;
                };

                // 解析奖励脚本内容
                const parseRewardsScriptContent = function (sessionData) {
                  try {
                    if (sessionData) {
                      // 提取有用的用户信息
                      const userInfo = {
                        isRewardUser: sessionData.IsRewardUser,
                        isLevel2: sessionData.IsLevel2,
                        balance: sessionData.Balance,
                        rewardsBalance: sessionData.RewardsBalance,
                        rebatesBalance: sessionData.RebatesBalance,
                        previousBalance: sessionData.PreviousBalance,
                        goalTrackBalance: sessionData.GoalTrackBalance,
                        isAdultMSA: sessionData.IsAdultMSA,
                        isRebatesUser: sessionData.IsRebatesUser,
                        visitedCount: sessionData.VisitedCount,
                        lastVisitTime: sessionData.LastVisitTime,
                        timestamp: new Date().toISOString()
                      };

                      return userInfo;
                    }
                    return null;
                  } catch (error) {
                    console.error('解析奖励脚本内容时出错:', error);
                    return null;
                  }
                }

                // 1. 提取特定的script标签内容
                let parsedRewardsData = null;
                let rewardsScriptContent = null;
                try {
                  const scriptTags = document.querySelectorAll('script[type="text/javascript"][data-bing-script="1"]');
                  for (const scriptTag of scriptTags) {
                    const content = scriptTag.textContent.trim();
                    if (content.includes('sj_evt') && content.includes('ModernRewards.ReportActivity')) {
                      rewardsScriptContent = content;
                      console.log('找到奖励脚本内容:', rewardsScriptContent.substring(0, 100) + '...');
                      break;
                    }
                  }

                  if (rewardsScriptContent) {
                    // 尝试从脚本内容中提取RewardsSessionData对象
                    // 查找以"RewardsSessionData":{ 开头，以 } 结尾的JSON字符串
                    const sessionDataMatch = rewardsScriptContent.match(/"RewardsSessionData":(\{[^}]*\})/);
                    if (sessionDataMatch && sessionDataMatch[1]) {
                      // 提取JSON字符串
                      const jsonString = sessionDataMatch[1];
                      // 尝试解析JSON
                      const RewardsSessionData = JSON.parse(jsonString);
                      // 解析脚本内容中的用户信息和积分数据
                      parsedRewardsData = parseRewardsScriptContent(RewardsSessionData);
                      if (parsedRewardsData) {
                        console.log('成功解析脚本内容:', parsedRewardsData);
                        return {
                          hasPoint: !!parsedRewardsData,
                          pointAmount: parsedRewardsData?.balance || "0",
                          selector: null,
                          content: null,
                          rewardsScriptContent: rewardsScriptContent,
                          parsedRewardsData: parsedRewardsData
                        };
                      }
                    }

                  } else {
                    console.log('未找到奖励脚本内容');
                  }
                } catch (e) {
                  console.error('提取script标签内容时出错:', e);
                }


                // 2. 尝试从选择器中获取积分
                // 尝试从页面中查找积分相关元素 - 扩展的选择器列表
                const pointSelectors = [
                  // 原有选择器
                  '.points-container[data-tag="RewardsHeader.Counter"]',
                  // 尝试通过aria-label属性查找
                  '[aria-label*="积分"]',
                  '[aria-label*="points"]'
                ];

                for (const selector of pointSelectors) {
                  const elements = document.querySelectorAll(selector);
                  for (const element of elements) {
                    if (element) {
                      console.debug(`尝试选择器 ${selector}:`, element);
                      const text = (element.textContent || element.getAttribute('aria-label') || element.value || '').trim();
                      console.debug(`积分文本 ${selector}:`, text);
                      const points = extractPoints(text);
                      if (points !== null) {
                        return {
                          hasPoint: true,
                          pointAmount: points.toString(),
                          selector: selector,
                          content: text
                        };
                      }
                    }
                  }
                }

                // 如果以上方法都失败，仍然认为任务可能已完成，使用任务中的max值
                return {
                  hasPoint: false,
                  pointAmount: task.max || "0",
                };

              }
            }, (injectionResults) => {

              // 无论结果如何，都尝试关闭标签页
              try {
                chrome.tabs.remove(tab.id, () => {
                  if (chrome.runtime.lastError) {
                    console.warn(`尝试关闭标签 ${tab.id} 时出错:`, chrome.runtime.lastError.message);
                  } else {
                    console.debug(`已成功关闭标签 ${tab.id}`);
                  }
                });
              } catch (removeError) {
                console.warn(`关闭标签 ${tab.id} 异常:`, removeError);
              }

              console.info('注入搜索脚本结果:', injectionResults);

              const success = injectionResults[0] && injectionResults[0].result && injectionResults[0].result.hasPoint;
              const resultData = success ? injectionResults[0].result : null;
              const result = {
                title: title,
                targetUrl: targetUrl,
                timestamp: new Date().toISOString(),
                success: success,
                points: resultData ? resultData.pointAmount || "0" : "0",
                totalPoints: resultData ? resultData.totalPoints || "0" : "0",
                rewardsScriptContent: resultData ? resultData.rewardsScriptContent : null,
                parsedRewardsData: resultData ? resultData.parsedRewardsData : null,
                previousBalance: resultData && resultData.parsedRewardsData ? resultData.parsedRewardsData.previousBalance || "0" : "0",
                rewardsBalance: resultData && resultData.parsedRewardsData ? resultData.parsedRewardsData.rewardsBalance || "0" : "0",
              };

              result.awardPoints = parseInt(result.rewardsBalance) - parseInt(result.previousBalance);
              resolve(result);
            });
          } catch (error) {
            console.error(`执行脚本时出错: `, error);
            // 尝试关闭标签页
            try {
              chrome.tabs.remove(tab.id, () => {
                if (chrome.runtime.lastError) {
                  console.warn(`尝试关闭标签 ${tab.id} 时出错(错误路径):`, chrome.runtime.lastError.message);
                }
              });
            } catch (removeError) {
              console.warn(`关闭标签 ${tab.id} 异常(错误路径):`, removeError);
            }

            const result = {
              title: title,
              targetUrl: targetUrl,
              timestamp: new Date().toISOString(),
              success: false,
              points: "0",
              error: error.message
            };

            resolve(result);
          }

        })
      }, 5000)
    });
  })
}

// 执行一次搜索
async function performSearch(keyword) {
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&FORM=R5FD`;
  return openNewTab(keyword, searchUrl);
}

// 处理特殊奖励任务
async function processSpecialRewardTask(task) {
  console.debug("开始处理特殊奖励任务:", JSON.stringify(task, null, 2));

  // 参数验证
  if (!task || typeof task !== 'object') {
    console.error("无效的任务参数:", task);
    return {
      title: "未知任务",
      offerId: "unknown",
      timestamp: new Date().toISOString(),
      success: false,
      points: "0",
      error: "Invalid task object"
    };
  }

  // 清理目标URL，移除可能的额外空格
  const destinationUrl = task.destination?.replace(/`/g, '').trim() || '';

  const result = await openNewTab(task.title, destinationUrl);
  result.offerId = task.offerid || "unknown";
  return result;
}

// 主自动化函数
async function startAutomation() {
  if (isRunning) return;

  isRunning = true;
  currentSearchCount = 0;
  searchResults = [];

  // 获取设置
  const settings = await getSettings();

  totalSearches = settings.dailySearches;

  // 获取初始积分
  const initialPointInfo = await getCurrentPoints();
  console.log("Initial points:", initialPointInfo);
  initialPoints = initialPointInfo.points;


  // 更新状态
  updateStatus();

  // 处理特殊奖励任务
  const specialRewardTasks = initialPointInfo?.morePromotions || [];
  if (specialRewardTasks.length > 0) {
    console.log("发现特殊奖励任务，数量:", specialRewardTasks.length);

    // 筛选未完成的特殊奖励任务
    const incompleteTasks = specialRewardTasks.filter(task =>
      task.complete === "False" &&
      task.destination &&
      task.type === "urlreward"
    );

    console.log("未完成的特殊奖励任务数量:", incompleteTasks.length);

    // 处理每个未完成的特殊奖励任务
    for (const task of incompleteTasks) {
      if (!isRunning) break;

      console.log(`开始处理特殊奖励任务: ${task.title}`);

      const result = await processSpecialRewardTask(task);
      if (result) {
        searchResults.push(result);
        console.log(`特殊奖励任务处理结果: ${task.title}, 成功: ${result.success}, 积分: ${result.points}`);
      }

      // 更新状态
      updateStatus();

      // 添加延迟以避免过快操作
      const delay = 3000 + Math.random() * 2000; // 3-5秒的随机延迟
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    console.log("所有特殊奖励任务处理完成");
  }


  // 处理搜索任务
  const pcSearch = initialPointInfo?.counter?.pcSearch || null;
  if (pcSearch) {
    if (pcSearch.pointProgress >= pcSearch.pointProgressMax) {
      console.log("搜索任务已完成");
    } else {
      console.log("未完成的搜索任务积分:", pcSearch.pointProgressMax - pcSearch.pointProgress);

      // 获取关键词
      let keywords;
      if (settings.useHotTopics) {
        keywords = await getHotKeywords(settings.hotTopicSource).then(resp => resp?.keywords || defaultKeywords);
      } else {
        keywords = defaultKeywords;
      }

      // 确保有足够的关键词
      while (keywords.length < totalSearches) {
        keywords = keywords.concat(defaultKeywords);
      }

      // 随机打乱关键词
      keywords = keywords.sort(() => Math.random() - 0.5).slice(0, totalSearches);

      // 开始搜索循环
      for (const keyword of keywords) {
        if (!isRunning) break;

        currentSearchCount++;
        console.log(`Search ${currentSearchCount}/${totalSearches}: ${keyword}`);

        // 执行搜索
        const searchResult = await performSearch(keyword);
        if (searchResult) {
          searchResults.push(searchResult);
        }

        // 更新状态
        updateStatus();

        // 等待一段时间，添加1-5秒的随机延迟以模拟人类行为
        const randomDelay = Math.floor(Math.random() * 5) + 1; // 1-5秒的随机延迟
        const totalDelay = (settings.searchInterval + randomDelay) * 1000;
        console.log(`Search 间隔: ${settings.searchInterval}秒 + 随机延迟: ${randomDelay}秒 = 总计: ${totalDelay / 1000}秒`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }

      console.log("搜索任务完成");
    }
  }


  // 更新状态
  updateStatus();

  // 获取最终积分
  const finalPointInfo = await getCurrentPoints();
  console.log("Final points:", finalPointInfo);
  finalPoints = finalPointInfo.points;

  // 计算获得的积分
  const earnedPoints = finalPoints - initialPoints;

  const record = {
    searches: currentSearchCount,
    successCount: searchResults.filter(r => r.success).length,
    earnedPoints,
    initialPoints,
    finalPoints,
    details: searchResults
  };

  // 保存记录
  await saveRecord(record);

  // 保存搜索历史
  await saveSearchHistory(searchResults);

  // 完成
  isRunning = false;
  updateStatus();

  // // 通知用户
  // chrome.notifications.create({
  //   type: "basic",
  //   iconUrl: "icons/icon48.svg",
  //   title: "Microsoft Rewards Automator",
  //   message: `自动化搜索完成！\n执行了 ${record.searches} 次搜索\n成功 ${record.successCount} 次\n获得了 ${record.earnedPoints} 积分`
  // });
}


// 停止自动化
function stopAutomation() {
  isRunning = false;
  updateStatus();
}

// 更新状态
function updateStatus() {
  chrome.runtime.sendMessage({
    type: "statusUpdate",
    isRunning,
    currentSearchCount,
    totalSearches,
    searchResults
  });
}

/**
 * 获取设置
 * @returns {Promise<Object>} - 设置对象
 */
async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || { dailySearches: 50, searchInterval: 15, useHotTopics: true, });
    });
  });
}

/*
 * 保存记录
 * @param {Object} record - 记录对象
 */
async function saveRecord(record) {

  // 记录本次操作
  const now = new Date();

  // 使用本地时间构建日期字符串 (YYYY-MM-DD)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;

  // 使用本地时间构建时间字符串 (HH:MM:SS，24小时制)
  const hours = String(now.getHours()).padStart(2, '0'); // 24小时制
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const time = `${hours}:${minutes}:${seconds}`;

  record.date = date;
  record.time = time;

  // 保存记录
  chrome.storage.local.get(['pointRecords'], (result) => {
    const records = result.pointRecords || [];
    records.push(record);
    chrome.storage.local.set({ pointRecords: records });
  });
}

/**
 * 保存搜索历史
 * @param {Array} searchResults - 搜索结果数组
 */
async function saveSearchHistory(searchResults) {
  // 保存搜索历史
  chrome.storage.local.get(['searchHistory'], (result) => {
    const history = result.searchHistory || [];
    history.push(...searchResults);
    chrome.storage.local.set({ searchHistory: history });
  });
}

// 监听commands命令
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open_in_tab') {
    // 在新标签页中打开插件页面
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
  }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "startAutomation":
      if (isRunning) {
        sendResponse({ status: "already_running", message: "自动化已经在运行中" });
      } else {
        startAutomation();
        sendResponse({ status: "started" });
      }
      break;
    case "stopAutomation":
      if (!isRunning) {
        sendResponse({ status: "already_stopped", message: "自动化已经停止" });
      } else {
        stopAutomation();
        sendResponse({ status: "stopped" });
      }
      break;
    case "getStatus":
      sendResponse({
        isRunning,
        currentSearchCount,
        totalSearches,
        searchResults
      });
      break;
    case "getRecords":
      chrome.storage.local.get(['pointRecords'], (result) => {
        sendResponse({ records: result.pointRecords || [] });
      });
      return true; // 表示需要异步发送响应
    case "getSettings":
      getSettings().then(settings => {
        sendResponse({ settings });
      });
      return true;
    case "saveSettings":
      chrome.storage.local.set({ settings: message.settings }, () => {
        totalSearches = message.settings.dailySearches;
        sendResponse({ status: "saved" });
      });
      return true;
    case "getCurrentPoints":
      // 异步获取当前积分并响应
      getCurrentPoints().then(points => {
        console.debug('获取到的积分:', points);
        sendResponse(points);
      }).catch(error => {
        console.error('获取积分失败:', error);
        sendResponse(undefined);
      });
      return true;
    case "testHotTopics":
      // 异步获取热点数据并响应
      getHotKeywords(message.source).then(resp => {
        sendResponse({
          ...resp
        });
      }).catch(error => {
        console.error('测试热点数据获取失败:', error);
        sendResponse({
          success: false,
          error: error.message,
          source: message.source
        });
      });
      return true; // 保持消息通道打开，以便异步响应
    default:
      sendResponse({ status: "unknown command" });
  }
});
