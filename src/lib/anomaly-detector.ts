/**
 * 🔍 ANOMALY DETECTION SYSTEM
 * Система детекции подозрительной активности и аномалий
 */

interface UserActivity {
  userId: string;
  ip: string;
  action: string;
  timestamp: number;
  metadata?: any;
}

interface AnomalyScore {
  score: number; // 0-100, где 100 = очень подозрительно
  reasons: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Хранилище активности (в продакшене используйте Redis)
const activityStore = new Map<string, UserActivity[]>();
const anomalyAlerts = new Map<string, number>();

/**
 * Детекция аномалий в поведении пользователя
 */
export function detectAnomalies(activity: UserActivity): AnomalyScore {
  const userActivities = activityStore.get(activity.userId) || [];
  userActivities.push(activity);
  
  // Храним последние 1000 действий
  if (userActivities.length > 1000) {
    userActivities.shift();
  }
  
  activityStore.set(activity.userId, userActivities);
  
  const reasons: string[] = [];
  let score = 0;
  
  // 1. Проверка скорости действий (слишком быстро = бот)
  const recentActions = userActivities.filter(
    a => a.timestamp > Date.now() - 60000 // последняя минута
  );
  
  if (recentActions.length > 50) {
    score += 40;
    reasons.push('Unusually high activity rate (possible bot)');
  }
  
  // 2. Проверка смены IP адреса
  const recentIPs = new Set(
    userActivities
      .filter(a => a.timestamp > Date.now() - 3600000) // последний час
      .map(a => a.ip)
  );
  
  if (recentIPs.size > 3) {
    score += 30;
    reasons.push('Multiple IP addresses in short time');
  }
  
  // 3. Проверка необычного времени активности
  const hour = new Date(activity.timestamp).getHours();
  if (hour >= 2 && hour <= 5) {
    score += 15;
    reasons.push('Activity during unusual hours (2-5 AM)');
  }
  
  // 4. Проверка паттернов доступа
  const failedLogins = userActivities.filter(
    a => a.action === 'LOGIN_FAILED' && a.timestamp > Date.now() - 600000
  );
  
  if (failedLogins.length > 3) {
    score += 25;
    reasons.push('Multiple failed login attempts');
  }
  
  // 5. Проверка на массовый доступ к данным
  const dataAccess = userActivities.filter(
    a => a.action.includes('EXPORT') && a.timestamp > Date.now() - 300000
  );
  
  if (dataAccess.length > 5) {
    score += 35;
    reasons.push('Mass data export detected');
  }
  
  // Определение уровня серьезности
  let severity: 'low' | 'medium' | 'high' | 'critical';
  if (score >= 80) severity = 'critical';
  else if (score >= 60) severity = 'high';
  else if (score >= 40) severity = 'medium';
  else severity = 'low';
  
  // Логирование критических аномалий
  if (severity === 'critical' || severity === 'high') {
    console.error(`🚨 ANOMALY DETECTED: User ${activity.userId}, Score: ${score}`, reasons);
    
    // Увеличиваем счетчик алертов
    const alertCount = (anomalyAlerts.get(activity.userId) || 0) + 1;
    anomalyAlerts.set(activity.userId, alertCount);
    
    // Блокировка после 3 критических аномалий
    if (alertCount >= 3 && severity === 'critical') {
      console.error(`🔒 AUTO-BLOCKING USER: ${activity.userId}`);
      // TODO: Вызвать функцию блокировки пользователя
    }
  }
  
  return { score, reasons, severity };
}

/**
 * Проверка на DDoS атаку по паттерну запросов
 */
export function detectDDoSPattern(requests: Array<{ ip: string; timestamp: number }>): boolean {
  const now = Date.now();
  const window = 10000; // 10 секунд
  
  // Группировка по IP
  const ipCounts = new Map<string, number>();
  
  for (const req of requests) {
    if (now - req.timestamp > window) continue;
    ipCounts.set(req.ip, (ipCounts.get(req.ip) || 0) + 1);
  }
  
  // Если один IP делает > 100 запросов за 10 секунд
  for (const [ip, count] of ipCounts) {
    if (count > 100) {
      console.error(`🚨 DDoS PATTERN DETECTED from IP: ${ip}, Requests: ${count}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Детекция credential stuffing атаки
 */
export function detectCredentialStuffing(
  failedLogins: Array<{ username: string; ip: string; timestamp: number }>
): boolean {
  const now = Date.now();
  const window = 600000; // 10 минут
  
  const recentFailed = failedLogins.filter(f => now - f.timestamp < window);
  
  // Много разных username с одного IP = credential stuffing
  const uniqueUsernames = new Set(recentFailed.map(f => f.username));
  
  if (uniqueUsernames.size > 10) {
    console.error(`🚨 CREDENTIAL STUFFING DETECTED: ${uniqueUsernames.size} usernames tried`);
    return true;
  }
  
  return false;
}

/**
 * Очистка старых данных
 */
export function cleanupOldData(): void {
  const cutoff = Date.now() - 86400000; // 24 часа
  
  for (const [userId, activities] of activityStore.entries()) {
    const filtered = activities.filter(a => a.timestamp > cutoff);
    
    if (filtered.length === 0) {
      activityStore.delete(userId);
    } else {
      activityStore.set(userId, filtered);
    }
  }
}

// Автоматическая очистка каждый час
setInterval(cleanupOldData, 3600000);
