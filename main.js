const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(app.getPath('userData'), 'schedules.json');
let mainWindow = null;
let notificationWindow = null;
let checkInterval = null;

// スケジュールデータの読み込み
function loadSchedules() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('スケジュールの読み込みエラー:', error);
  }
  return [];
}

// スケジュールデータの保存
function saveSchedules(schedules) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(schedules, null, 2));
  } catch (error) {
    console.error('スケジュールの保存エラー:', error);
  }
}

// メインウィンドウの作成
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// フルスクリーン通知ウィンドウの作成
function createNotificationWindow(schedule) {
  if (notificationWindow) {
    return; // 既に表示されている場合は何もしない
  }

  notificationWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  notificationWindow.loadFile('notification.html');

  // 通知内容をウィンドウに送信
  notificationWindow.webContents.on('did-finish-load', () => {
    notificationWindow.webContents.send('show-notification', schedule);
  });

  notificationWindow.on('closed', () => {
    notificationWindow = null;
  });
}

// スケジュールのチェック
function checkSchedules() {
  const schedules = loadSchedules();
  const now = new Date();

  const updatedSchedules = schedules.filter(schedule => {
    if (!schedule.executed) {
      const scheduleDate = new Date(schedule.datetime);

      // 現在時刻がスケジュール時刻を過ぎているかチェック
      if (now >= scheduleDate) {
        console.log('スケジュール実行:', schedule);
        createNotificationWindow(schedule);
        return false; // このスケジュールを削除（1回のみ実行）
      }
    }
    return true; // まだ実行していないスケジュールは保持
  });

  // 実行されたスケジュールを削除
  if (updatedSchedules.length !== schedules.length) {
    saveSchedules(updatedSchedules);
  }
}

// アプリケーション起動時
app.whenReady().then(() => {
  createMainWindow();

  // 10秒ごとにスケジュールをチェック
  checkInterval = setInterval(checkSchedules, 10000);

  // 起動時にも一度チェック
  checkSchedules();
});

// すべてのウィンドウが閉じられた時
app.on('window-all-closed', () => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});

// IPCハンドラー
ipcMain.on('get-schedules', (event) => {
  event.reply('schedules-data', loadSchedules());
});

ipcMain.on('add-schedule', (event, schedule) => {
  const schedules = loadSchedules();
  schedules.push({
    id: Date.now(),
    datetime: schedule.datetime,
    message: schedule.message,
    executed: false
  });
  saveSchedules(schedules);
  event.reply('schedules-data', schedules);
});

ipcMain.on('delete-schedule', (event, scheduleId) => {
  const schedules = loadSchedules();
  const filtered = schedules.filter(s => s.id !== scheduleId);
  saveSchedules(filtered);
  event.reply('schedules-data', filtered);
});

ipcMain.on('close-notification', () => {
  if (notificationWindow) {
    notificationWindow.close();
  }
});
