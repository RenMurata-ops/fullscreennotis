// スケジュール管理
class ScheduleManager {
  constructor() {
    this.storageKey = 'fullscreen-schedules';
    this.checkInterval = null;
    this.serviceWorkerRegistration = null;
    this.init();
  }

  async init() {
    // Service Workerの登録
    await this.registerServiceWorker();

    // 通知権限のリクエスト
    await this.requestNotificationPermission();

    // Service Workerからのメッセージを受信
    this.setupServiceWorkerListener();

    this.loadSchedules();
    this.startChecking();
    this.setupEventListeners();
    this.renderSchedules();
  }

  // Service Workerの登録
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker登録成功:', this.serviceWorkerRegistration);

        // Service Workerのステータスを表示
        this.updateServiceWorkerStatus(true);
      } catch (error) {
        console.error('Service Worker登録失敗:', error);
        this.updateServiceWorkerStatus(false);
      }
    } else {
      console.log('Service Workerはこのブラウザでサポートされていません');
      this.updateServiceWorkerStatus(false);
    }
  }

  // 通知権限のリクエスト
  async requestNotificationPermission() {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        console.log('通知権限:', permission);
        this.updateNotificationStatus(permission);
        return permission === 'granted';
      } catch (error) {
        console.error('通知権限リクエストエラー:', error);
        return false;
      }
    } else {
      console.log('通知機能はこのブラウザでサポートされていません');
      return false;
    }
  }

  // Service Workerステータスの更新
  updateServiceWorkerStatus(active) {
    const statusElement = document.getElementById('swStatus');
    if (statusElement) {
      statusElement.className = `status-indicator ${active ? 'status-active' : 'status-inactive'}`;
      const textElement = document.getElementById('swStatusText');
      if (textElement) {
        textElement.textContent = active ? 'バックグラウンド動作: 有効' : 'バックグラウンド動作: 無効';
      }
    }
  }

  // 通知権限ステータスの更新
  updateNotificationStatus(permission) {
    const statusElement = document.getElementById('notifStatus');
    if (statusElement) {
      const isGranted = permission === 'granted';
      statusElement.className = `status-indicator ${isGranted ? 'status-active' : 'status-inactive'}`;
      const textElement = document.getElementById('notifStatusText');
      if (textElement) {
        textElement.textContent = isGranted ? '通知権限: 許可済み' : '通知権限: 未許可';
      }
    }
  }

  // Service Workerからのメッセージを受信
  setupServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'CHECK_SCHEDULES') {
          // Service Workerからスケジュールチェックの要求を受信
          this.checkSchedulesForServiceWorker();
        }
      });
    }
  }

  // Service Worker用のスケジュールチェック
  checkSchedulesForServiceWorker() {
    const schedules = this.loadSchedules();
    const now = new Date();

    schedules.forEach(schedule => {
      if (!schedule.executed) {
        const scheduleDate = new Date(schedule.datetime);

        if (now >= scheduleDate) {
          // Service Workerに通知を依頼
          this.sendNotificationToServiceWorker(schedule);

          // スケジュールを削除
          this.deleteSchedule(schedule.id);
        }
      }
    });
  }

  // Service Workerに通知を送信
  async sendNotificationToServiceWorker(schedule) {
    if (this.serviceWorkerRegistration) {
      try {
        // Service Workerを通じて通知を表示
        await this.serviceWorkerRegistration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: 'スケジュール通知',
          body: schedule.message,
          data: schedule
        });
      } catch (error) {
        console.error('Service Workerへの通知送信エラー:', error);
        // フォールバック: 直接通知を表示
        this.showBrowserNotification(schedule);
      }
    } else {
      // Service Workerが利用できない場合は直接通知
      this.showBrowserNotification(schedule);
    }
  }

  // ブラウザ通知を直接表示
  async showBrowserNotification(schedule) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification('スケジュール通知', {
          body: schedule.message,
          requireInteraction: true,
          vibrate: [200, 100, 200]
        });

        notification.onclick = () => {
          window.focus();
          this.showNotification(schedule);
          notification.close();
        };
      } catch (error) {
        console.error('ブラウザ通知エラー:', error);
        // 最終フォールバック: ページ遷移
        this.showNotification(schedule);
      }
    } else {
      // 通知権限がない場合はページ遷移
      this.showNotification(schedule);
    }
  }

  // localStorageからスケジュールを読み込む
  loadSchedules() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('スケジュールの読み込みエラー:', error);
      return [];
    }
  }

  // localStorageにスケジュールを保存
  saveSchedules(schedules) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(schedules));
    } catch (error) {
      console.error('スケジュールの保存エラー:', error);
    }
  }

  // スケジュールを追加
  addSchedule(datetime, message) {
    const schedules = this.loadSchedules();
    const newSchedule = {
      id: Date.now(),
      datetime: datetime,
      message: message,
      executed: false
    };
    schedules.push(newSchedule);
    this.saveSchedules(schedules);
    this.renderSchedules();
  }

  // スケジュールを削除
  deleteSchedule(scheduleId) {
    const schedules = this.loadSchedules();
    const filtered = schedules.filter(s => s.id !== scheduleId);
    this.saveSchedules(filtered);
    this.renderSchedules();
  }

  // スケジュールのチェックを開始
  startChecking() {
    // 10秒ごとにチェック
    this.checkInterval = setInterval(() => {
      this.checkSchedules();
    }, 10000);

    // 初回チェック
    this.checkSchedules();
  }

  // スケジュールをチェックして実行
  checkSchedules() {
    const schedules = this.loadSchedules();
    const now = new Date();

    const updatedSchedules = schedules.filter(schedule => {
      if (!schedule.executed) {
        const scheduleDate = new Date(schedule.datetime);

        // 現在時刻がスケジュール時刻を過ぎているかチェック
        if (now >= scheduleDate) {
          console.log('スケジュール実行:', schedule);
          this.showNotification(schedule);
          return false; // このスケジュールを削除（1回のみ実行）
        }
      }
      return true; // まだ実行していないスケジュールは保持
    });

    // 実行されたスケジュールがあれば更新
    if (updatedSchedules.length !== schedules.length) {
      this.saveSchedules(updatedSchedules);
      this.renderSchedules();
    }
  }

  // フルスクリーン通知を表示
  showNotification(schedule) {
    // スケジュール情報をsessionStorageに保存
    sessionStorage.setItem('currentNotification', JSON.stringify(schedule));

    // 通知ページに遷移
    window.location.href = 'notification.html';
  }

  // スケジュール一覧を表示
  renderSchedules() {
    const schedules = this.loadSchedules();
    const listElement = document.getElementById('scheduleList');

    if (schedules.length === 0) {
      listElement.innerHTML = `
        <div class="empty-state">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
          </svg>
          <p>予定されている通知はありません</p>
        </div>
      `;
      return;
    }

    listElement.innerHTML = schedules
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
      .map(schedule => {
        const date = new Date(schedule.datetime);
        const formattedDate = date.toLocaleString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        return `
          <li class="schedule-item">
            <div class="schedule-info">
              <div class="schedule-datetime">${formattedDate}</div>
              <div class="schedule-message">${this.escapeHtml(schedule.message)}</div>
            </div>
            <button class="btn btn-danger" data-schedule-id="${schedule.id}">削除</button>
          </li>
        `;
      })
      .join('');

    // 削除ボタンのイベントリスナーを設定
    document.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const scheduleId = parseInt(e.target.dataset.scheduleId);
        if (confirm('このスケジュールを削除しますか？')) {
          this.deleteSchedule(scheduleId);
        }
      });
    });
  }

  // HTMLエスケープ
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // イベントリスナーの設定
  setupEventListeners() {
    const form = document.getElementById('scheduleForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const datetime = document.getElementById('datetime').value;
      const message = document.getElementById('message').value;

      if (datetime && message) {
        this.addSchedule(new Date(datetime).toISOString(), message);

        // フォームをリセット
        document.getElementById('datetime').value = '';
        document.getElementById('message').value = '';
      }
    });
  }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  window.scheduleManager = new ScheduleManager();
});
