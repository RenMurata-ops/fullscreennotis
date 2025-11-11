// スケジュール管理
class ScheduleManager {
  constructor() {
    this.storageKey = 'fullscreen-schedules';
    this.checkInterval = null;
    this.init();
  }

  init() {
    this.loadSchedules();
    this.startChecking();
    this.setupEventListeners();
    this.renderSchedules();
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
