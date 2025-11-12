// Service Worker - バックグラウンド動作用

const CACHE_NAME = 'fullscreen-notis-v1';
const CHECK_INTERVAL = 10000; // 10秒ごとにチェック

// Service Workerのインストール
self.addEventListener('install', (event) => {
  console.log('Service Worker: インストール中...');
  self.skipWaiting();
});

// Service Workerのアクティベーション
self.addEventListener('activate', (event) => {
  console.log('Service Worker: アクティベート中...');
  event.waitUntil(clients.claim());

  // スケジュールチェックを開始
  startScheduleChecking();
});

// 定期的にスケジュールをチェック
function startScheduleChecking() {
  setInterval(async () => {
    await checkSchedules();
  }, CHECK_INTERVAL);

  // 初回チェック
  checkSchedules();
}

// スケジュールをチェックして通知を表示
async function checkSchedules() {
  try {
    // すべてのクライアント（タブ）からlocalStorageを取得する必要がある
    // Service WorkerはlocalStorageに直接アクセスできないため、
    // メッセージングを使用するか、IndexedDBを使用する

    const clients = await self.clients.matchAll({ type: 'window' });

    for (const client of clients) {
      // 各クライアントにスケジュールチェックを依頼
      client.postMessage({
        type: 'CHECK_SCHEDULES'
      });
    }
  } catch (error) {
    console.error('スケジュールチェックエラー:', error);
  }
}

// クライアントからのメッセージを受信
self.addEventListener('message', (event) => {
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    showNotification(title, body, data);
  }
});

// 通知を表示
async function showNotification(title, body, data) {
  try {
    const options = {
      body: body,
      icon: '/icon.png', // アイコンがある場合
      badge: '/badge.png', // バッジがある場合
      vibrate: [200, 100, 200],
      tag: 'fullscreen-notification',
      requireInteraction: true, // ユーザーが閉じるまで表示
      data: data,
      actions: [
        {
          action: 'view',
          title: '確認'
        },
        {
          action: 'close',
          title: '閉じる'
        }
      ]
    };

    await self.registration.showNotification(title, options);
  } catch (error) {
    console.error('通知表示エラー:', error);
  }
}

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    // 通知をクリックした時の処理
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // すでに開いているウィンドウがあればフォーカス
        for (const client of clientList) {
          if (client.url.includes('notification.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // なければ新しいウィンドウを開く
        if (clients.openWindow) {
          return clients.openWindow('/notification.html');
        }
      })
    );
  }
});

// フェッチイベント（キャッシュ戦略）
self.addEventListener('fetch', (event) => {
  // 基本的なパススルー
  event.respondWith(fetch(event.request));
});
