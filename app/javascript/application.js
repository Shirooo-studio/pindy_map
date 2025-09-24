// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./controllers"

let map, service, markers = []

// Google Map 初期化
window.initMap = function () {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 35.6812, lng: 139.7671 }, // 東京駅あたり
    zoom: 14,
  });

  // PlaceService の準備
  service = new google.maps.places.PlacesService(map);

  // 検索窓のイベント
  const input = document.getElementById("search-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        performSearch(input.value.trim());
      }
    });
  }
};

// 検索実行
function performSearch(query) {
  if (!query) return;

  const bounds = map.getBounds();
  if (!bounds) return;

  const request = {
    query: query,
    bounds: bounds,
  };

  service.textSearch(request, (results, status) => {
    clearMarkers();

    if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
      showResults(results);
      return;
    }

    // 検索なし・エラーの簡易表示
    const list = document.getElementById("results-list");
    if (list) {
      list.innerHTML = "";
      const msg = document.createElement("li");
      const readable =
        status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS
          ? "該当する場所が見つかりませんでした。"
          : `検索に失敗しました：${status}`;
      msg.textContent = readable;
      list.appendChild(msg);
      openPanel();
    }
  });
}

// 検索結果を描画
function showResults(results) {
  const list = document.getElementById("results-list");
  if (!list) return;

  list.innerHTML = "";

  // 先に place_id を確かめる（保存済み判定と投稿数取得に使う）
  const placeIds = results.map(r => r.place_id).filter(Boolean);

  results.forEach((place) => {
    if (!place.geometry || !place.geometry.location) return;

    // マーカー
    const marker = new google.maps.Marker({
      map,
      position: place.geometry.location,
    });
    markers.push(marker);

    // 画像URL（無ければグレープレースホルダー）
    const photoUrl =
      place.photos?.[0]?.getUrl({ maxWidth: 96, maxHeight: 96 }) ||
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#f3f4f6"/></svg>');

      // 営業ステータス
      let statusHtml = "";
      if (place.opening_hours?.open_now === true) {
        statusHtml = `<span class="text-green-600">営業中</span>`;
      } else if (place.opening_hours?.open_now === false) {
        statusHtml = `<span class="text-red-600">営業時間外</span>`;
      }

    // リスト（カードUI）
    const li = document.createElement("li");
    li.dataset.placeId = place.place_id;
    li.className = "p-3 hover:bg-gray-100 cursor-pointer";
    li.innerHTML = `
      <div class="flex gap-3">
        <div class="flex-1 min-w-0">
          <div class="font-semibold flex items-center gap-2">
            <span class="truncate">${place.name ?? ""}</span>
            <span class="saved-badge-slot"></span>
          </div>
          <div class="text-sm text-gray-600 truncate">${place.formatted_address ?? ""}</div>
          <div class="mt-1 text-sm">
            ${statusHtml}
          </div>
          <div class="text-sm text-gray-700">
            投稿数：<span class="post-count" data-place-id="${place.place_id}">-</span> 件
          </div>
        </div>
        <img src="${photoUrl}" alt="" class="w-24 h-24 object-cover rounded-md border" />
      </div>
    `;
    list.appendChild(li);

    //相互フォーカス
    marker.addListener("click", () => {
      li.scrollIntoView({ behavior: "smooth", block: "center" });
      flash(li);
    });
    li.addEventListener("click", () => {
      // ① 既存の選択を解除
      document.querySelectorAll("#results-list li.active")
        .forEach(el => el.classList.remove("active"));

      // ② この要素を選択状態に
      li.classList.add("active");

      // ③ マップ移動&詳細表示
      // マップを対象へパン → 右UIぶんだけ左へオフセット
      focusPlaceWithRightUIOffset(place.geometry.location);
      showPlaceDetails(place.place_id);
    });
  });

  openPanel();

  // 保存済み判定
  if (placeIds.length > 0) {
    fetch(`/pins/check?place_ids=${encodeURIComponent(placeIds.join(","))}`)
      .then(res => res.json())
      .then(savedMap => {
        document.querySelectorAll("#results-list > li").forEach((li) => {
          const pid = li.dataset.placeId;
          if (pid && savedMap[pid]) {
            const slot = li.querySelector(".saved-badge-slot");
            if (slot && !slot.querySelector(".saved-badge")) {
              const badge = document.createElement("span");
              badge.className = "saved-badge ml-2 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded";
              badge.textContent = "保存済み（あなたのピン）";
              slot.appendChild(badge);
            }
          }
        });
      })
      .catch((e) => console.debug("saved-check skipped:", e.message));
  }
  // 投稿の取得
  if (placeIds.length > 0) {
    fetch(`/posts/count_by_place?place_ids=${encodeURIComponent(placeIds.join(","))}`, {
      headers: { "Accept": "application/json" }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then((counts) => {
        document.querySelectorAll(".post-count").forEach(span => {
          const pid = span.getAttribute("data-place-id");
          if (!pid) return;
          const n = counts[pid] ?? 0;
          span.textContent = n;
        });
      })
      .catch((e) => console.debug("post-count skipped:", e.message));
  }
}

// マーカーをクリア
function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  markers = [];
}

//右パネルを開閉
function openPanel() {
  const panel = document.getElementById("search-panel");
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.classList.add("show");

  const w = panel.getBoundingClientRect().width || 420;
  document.body.style.setProperty("--spw", `${w}px`);
  document.body.style.setProperty("--gap", "16px");
  document.body.classList.add("panel-open");

  updateDetailTop();
}
function closePanel() {
  const panel = document.getElementById("search-panel");
  if (!panel) return;
  panel.classList.remove("show");
  panel.classList.add("hidden");
  document.body.classList.remove("panel-open");
  closeDetail();
}
function updateDetailTop() {
  const searchBar = document.getElementById("search-bar");
  const container = document.getElementById("map-container");
  if (!searchBar || !container) return;
  const bar = searchBar.getBoundingClientRect();
  const cont = container.getBoundingClientRect();
  const top = Math.max(8, bar.bottom - cont.top + 8);
  document.body.style.setProperty("--detailTop", `${top}px`);
}

// 画面が変わったらパネル幅を再反映（開いてる時だけ）
window.addEventListener("resize", () => {
  if (!document.body.classList.contains("panel-open")) return;
  const panel = document.getElementById("search-panel");
  if (panel) {
    const w = panel.getBoundingClientRect().width || 420;
    document.body.style.setProperty("--spw", `${w}px`);
  }
  updateDetailTop();
});

function flash(el) {
  el.style.background = "#f0f0f0";
  setTimeout(() => (el.style.background = ""), 600);
}

// ↓↓↓詳細ドロワーのコード

// 詳細ポップアップの開閉
function openDetail() {
  const p = document.getElementById("detail-panel");
  p?.classList.remove("hidden");
  p?.classList.add("show");
  updateDetailTop();
}
function closeDetail() {
  const p = document.getElementById("detail-panel");
  p?.classList.remove("show");
  p?.classList.add("hidden");

  document.querySelectorAll("#results-list li.active")
    .forEach(el => el.classList.remove("active"));
}

// Place Details を取得して描画
function showPlaceDetails(placeId){
  if(!placeId) return;

  // 取得したいフィールド
  const fields = [
    "name","formatted_address","geometry","formatted_phone_number",
    "website","rating","user_ratings_total","opening_hours","photos","place_id"
  ];

  service.getDetails({ placeId, fields }, (place, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
      console.warn("getDetails failed:", status);
      return;
    }

    // サムネイル（大きめ）
    const heroUrl = place.photos?.[0]?.getUrl({ maxWidth: 800, maxHeight: 400 });

    // 今日の営業時間表示（簡易）
    let hoursHtml = "";
    if (place.opening_hours?.weekday_text) {
      const todayIndex = (new Date().getDay() + 6) % 7; // 月=0 … 日=6
      hoursHtml = `<div class="text-sm text-gray-700">${place.opening_hours.weekday_text[todayIndex] ?? ""}</div>`;
    }
    const openBadge = place.opening_hours?.isOpen?.() ?? place.opening_hours?.open_now;
    const openHtml = (openBadge === true)
      ? `<span class="text-green-600">営業中</span>`
      : (openBadge === false ? `<span class="text-red-600">営業時間外</span>` : "");

    // 本文
    const panel = document.getElementById("detail-body");
    panel.innerHTML = `
    <div class="detail-hero">
      ${heroUrl ? `<img src="${heroUrl}" alt="">` : `<div class="hero-ph"></div>`}
      <button id="detail-close-fab" class="pm-close" aria-label="閉じる">
        <span class="x" aria-hidden="true"></span>
      </button>
    </div>

    <div class="detail-section">
      <div class="text-lg font-semibold">${place.name ?? ""}</div>
      <div class="text-sm text-gray-600">${place.formatted_address ?? ""}</div>
      <div class="mt-1 text-sm">${openHtml}</div>
      ${hoursHtml}
      <div class="text-sm text-gray-700">
        ⭐ ${place.rating ?? "-"} (${place.user_ratings_total ?? 0}件)
      </div>
      ${place.formatted_phone_number ? `<div class="text-sm"><a class="text-blue-600 hover:underline" href="tel:${place.formatted_phone_number}">${place.formatted_phone_number}</a></div>` : ""}
      ${place.website ? `<div class="text-sm"><a class="text-blue-600 hover:underline" target="_blank" rel="noopener" href="${place.website}">公式サイト</a></div>` : ""}
    </div>

    <div class="mt-2 border-t">
      <div class="pm-actions grid grid-cols-3 text-center select-none">
        <div id="action-pin" class="pm-action cursor-pointer px-2 py-2 rounded hover:bg-gray-100 transition">
          <div class="text-xl">📍</div>
          <div class="label text-sm">ピンをする</div>
        </div>
        <div id="action-post" class="pm-action cursor-pointer px-2 py-2 rounded hover:bg-gray-100 transition">
          <div class="text-xl">➕</div>
          <div class="text-sm">投稿する</div>
        </div>
        <div id="action-share" class="pm-action cursor-pointer px-2 py-2 rounded hover:bg-gray-100 transition">
          <div class="text-xl">🔗</div>
          <div class="text-sm">共有する</div>
        </div>
      </div>
      <div class="px-3 pb-2 flex gap-2">
        <span id="saved-badge" class="ml-2 hidden text-xs text-green-700 bg-green-100 px-2 py-1 rounded self-center">
          保存済み（あなたのピン）
        </span>
      </div>
    </div>

    <div class="pm-tabs mt-2">
      <div id="tab-posts" class="pm-tab active">投稿</div>
      <div id="tab-media" class="pm-tab">画像・動画</div>
    </div>

    <div id="tab-contents" class="p-2">
      <div id="tab-panel-posts">
        <ul id="place-posts" class="space-y-6"></ul>
      </div>
      <div id="tab-panel-media" class="hidden">
        <div id="place-gallery" class="pm-gallery"></div>
      </div>
    </div>
    `;

    const actionPost = document.getElementById("action-post");
    if (actionPost) {
      actionPost.addEventListener("click", () => openPostOverlay(place));
    }

    // 浮遊xボタンで閉じる
    document.getElementById("detail-close-fab")?.addEventListener("click", closeDetail);

    const tabPosts = document.getElementById("tab-posts");
    const tabMedia = document.getElementById("tab-media");
    const panelPosts = document.getElementById("tab-panel-posts");
    const panelMedia = document.getElementById("tab-panel-media");

    function activate(tab) {
      if (tab === "posts") {
        tabPosts.classList.add("active"); tabMedia.classList.remove("active");
        panelPosts.classList.remove("hidden"); panelMedia.classList.add("hidden");
      } else {
        tabMedia.classList.add("active"); tabPosts.classList.remove("active");
        panelMedia.classList.remove("hidden"); panelPosts.classList.add("hidden");
      }
    }
    tabPosts.onclick = () => activate("posts");
    tabMedia.onclick = () => activate("media")

    // 投稿一覧を取得してカードを描画
    fetch(`/posts/by_place?place_id=${encodeURIComponent(place.place_id)}`, {
      headers: { "Accept": "application/json" }
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((posts) => {
        renderPlacePosts(posts);
        renderPlaceMedia(posts);
      })
      .catch(() => { renderPlacePosts([]); renderPlaceMedia([]); });

    // 保存済みかチェック → 📍タイルの状態を切り替え
    const actionPin = document.getElementById("action-pin");
    const savedBadge = document.getElementById("saved-badge");

    function updatePinActionUI(isSaved) {
      if (!actionPin) return;
      const label = actionPin.querySelector(".label");
      if (isSaved) {
        label && (label.textContent = "保存済み");
        actionPin.classList.add("opacity-60", "pointer-events-none");
        savedBadge?.classList.remove("hidden");
      } else {
        label && (label.textContent = "ピンをする");
        actionPin.classList.remove("opacity-60", "pointer-events-none");
        savedBadge?.classList.add("hidden");
      }
    }

    function reflectListBadge(pid) {
      const list = document.getElementById("results-list");
      if (!list) return;

      //data-place-id を持つ li を走査して一致する要素を探す
      const li = Array.from(list.querySelectorAll("li"))
        .find(el => el.dataset.placeId === String(pid));
        if(!li) return;

      const slot = li.querySelector(".saved-badge-slot");
      if (!slot || slot.querySelector(".saved-badge")) return;

      const b = document.createElement("span");
      b.className = "saved-badge ml-2 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded";
      b.textContent = "保存済み（あなたのピン）";
      slot.appendChild(b);
    }

    fetch(`/pins/check?place_ids=${encodeURIComponent(place.place_id)}`, { headers: { "Accept":"application/json" } })
      .then(r => r.ok ? r.json() : {})
      .then(saved => {
        const isSaved = !!saved[place.place_id];
        updatePinActionUI(isSaved);
        if (!isSaved && actionPin) {
          actionPin.addEventListener("click", async () => {
            // 押下 → 保存処理
            const label = actionPin.querySelector(".label");
            const prev = label?.textContent;
            actionPin.classList.add("opacity-60", "pointer-events-none");
            if (label) label.textContent = "保存中…";
            try {
              await savePinFromPlace(place); // 成功: UI反映
              updatePinActionUI(true);
              reflectListBadge(place.place_id);
            } catch (e) {
              alert("保存に失敗しました。" + (e?.message ? ` ${e.message}` : ""));
              updatePinActionUI(false); // 戻す
            }
          }, { once: true });
        }
      })
      .catch(()=>{/* 未ログインなどは無視 */});

    openDetail();
  });
}

// CSRFトークン取得（Rails）
function csrfToken() {
  const el = document.querySelector(`meta[name="csrf-token"]`);
  return el?.getAttribute("content");
}

// Place から Pin を作成（保存）
async function savePinFromPlace(place) {
  const payload = {
    pin: {
      name: place.name ?? "",
      address: place.formatted_address ?? "",
      google_place_id: place.place_id,
      latitude: place.geometry?.location?.lat() ?? null,
      longitude: place.geometry?.location?.lng() ?? null,
      visibility: "company_only" // enumに合わせる: everyone / company_only / private_
    }
  };

  const res = await fetch("/pins.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-CSRF-Token": csrfToken()
    },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  })

  // 本文がからの可能性も考慮してパース
  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (!res.ok) {
    const msg = data?.errors?.join(", ") || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data?.pin ?? data; // {pin; {...}} 形式にも対応
}

// 「この場所の投稿」をカードで描画
function renderPlacePosts(posts) {
  const ul = document.getElementById("place-posts");
  if (!ul) return;
  ul.innerHTML = "";

  if (!posts || posts.length === 0) {
    const li = document.createElement("li");
    li.className = "text-sm text-gray-500";
    li.textContent = "この場所の投稿はまだありません。";
    ul.appendChild(li);
    return;
  }

  posts.forEach((p) => {
    const avatar = p.user_avatar_url ||
      "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="#e5e7eb"/></svg>`
      );
    const userName = p.user_name || "アカウント名";

    const first = (p.media || [])[0];
    let heroHtml = `
      <div class="w-full bg-gray-50">
        <div class="w-full h-48 bg-gray-100"></div>
      </div>`;
    if (first) {
      if (first.type === "image") {
        heroHtml = `
          <div class="w-full bg-gray-50">
            <img src="${first.url}" alt="" class="w-full h-48 object-cover">
          </div>`;
      } else {
        const posterAttr = first.poster ? ` poster="${first.poster}"` : "";
        heroHtml = `
          <div class="w-full bg-gray-50">
            <video src="${first.url}"${posterAttr} class="w-full h-48 object-cover" muted preload="metadata"></video>
          </div>`;
      }
    }

    const title = p.title || "";
    const excerpt = (p.body || "").replace(/\s+/g, " ");
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const tagsHtml = tags.slice(0,5).map(t =>
      `<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">${t}</span>`
    ).join(" ");

    const li = document.createElement("li");
      li.className = "bg-white rounded-lg border overflow-hidden";
      li.innerHTML =`
        <div class="px-3 py-2 flex items-center gap-2 border-b">
          <img src="${avatar}" alt="" class="w-8 h-8 rounded-full object-cover border">
          <span class="text-sm text-gray-700">${userName}</span>
        </div>

        ${heroHtml}

        <div class="px-3 py-2">
          <div class="flex items-center gap-3 mb-2">
            <button class="text-pink-600" title="いいね">❤</button>
            <button class="text-gray-600" title="コメント">💬</button>
            <div class="flex flex-wrap gap-2 ml-auto">${tagsHtml}</div>
          </div>

          <div class="text-sm text-gray-900 font-medium mb-1">${title}</div>
          <div class="text-sm text-gray-700 leading-relaxed">
            ${excerpt.length > 80 ? excerpt.slice(0,80) + "…" : excerpt || "（本文は未入力です）"}
          </div>

          <div class="mt-1">
            <a href="/posts/${p.id}" class="text-xs text-gray-500 hover:underline">続きを読む</a>
          </div>
        </div>
      `;
      ul.appendChild(li);
  });
}

function renderPlaceMedia(posts) {
  const wrap = document.getElementById("place-gallery");
  if (!wrap) return;
  wrap.innerHTML = "";

  const items = (posts || []).flatMap(p => {
    const arr = Array.isArray(p.media) ? p.media : [];
    return arr.map(m => ({ type: m.type, url: m.url, poster:m.poster }));
  });

  if (items.length === 0) {
    const note = document.createElement("div");
    note.className = "text-sm text-gray-500";
    note.textContent = "この場所の画像・動画はまだありません。";
    wrap.appendChild(note);
    return;
  }

  items.forEach(it => {
    if (it.type === "image") {
      const img = document.createElement("img");
      img.src = it.url;
      img.alt = "";
      img.className = "pm-thumb";
      wrap.appendChild(img);
    } else {
      const v = document.createElement("video");
      v.src = it.url;
      if (it.poster) v.poster = it.poster;
      v.controls = true;
      v.preload = "metadata";
      v.className = "pm-thumb";
      wrap.appendChild(v);
    }
  });
}

function focusPlaceWithRightUIOffset(latLng) {
  if (!latLng || !map) return;

  // まず通常のセンターへ
  map.panTo(latLng);

  // センターに来た直後にオフセット（idle後にやるのが安定）
  google.maps.event.addListenerOnce(map, "idle", () => {
    const mapW = map.getDiv().clientWidth;

    // 右側UIの幅を取得（検索パネル幅 + ギャップ + 詳細ポップアップ幅）
    const cs = getComputedStyle(document.body);
    const gap = parseInt(cs.getPropertyValue("--gap")) || 16;

    const panel = document.getElementById("search-panel");
    const spw = panel?.getBoundingClientRect().width || parseInt(cs.getPropertyValue("--spw")) || 420;

    const detail = document.getElementById("detail-panel");
    const detailW = detail?.getBoundingClientRect().width || 360; // だいたいの最小想定

    // 右側UIの総占有幅
    const sidebar = document.getElementById("app-leftbar");
    const sidebarW = sidebar?.getBoundingClientRect().width || 72;
    const rightUI = spw + gap + detailW + gap;
    const totalTaken = sidebarW + rightUI;

    // 左側に残っている「空き領域」の中央にピンを置きたい
    const leftFree = Math.max(0, mapW - totalTaken);
    const targetX = sidebarW + (leftFree / 2);        // 目標のピンのX座標
    const currentX = mapW / 2;           // いまは画面中央
    const delta = currentX - targetX;    // 左へ動かしたい量（px）

    // delta が極端に小さければ何もしない
    if (Math.abs(delta) > 4) map.panBy(Math.round(delta), 0);
  });
}

function closePostOverlay() {
  const overlay = document.getElementById("post-overlay");
  if(!overlay) return;
  overlay.classList.add("hidden");
  overlay.innerHTML = ""; // 掃除
  // 背面スクロール復帰
  document.body.style.overflow = "";
}

async function submitPostForm(formData) {
  const res = await fetch("/posts.json", {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken(),
      "Accept": "application/json"
    },
    body: formData,
    credentials: "same-origin"
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (!res.ok) {
    const msg = data?.errors?.join("\n") || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function openPostOverlay(place) {
  const overlay = document.getElementById("post-overlay");
  if (!overlay) return;

  // 背景（白(0%）+フォームカード（中央寄せフルサイズ寄り）
  overlay.innerHTML = `
  <div class="absolute inset-0 bg-white/80"></div>
  <div class="relative w-full h-full flex items-center justify-center p-4">
    <div class="bg-white w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl shadow-xl p-5 relative">
      <button id="post-overlay-close" class="absolute top-3 right-3 text-gray-500 hover:text-black text-xl" aria-label="閉じる">✕</button>

      <h2 class="text-lg font-semibold mb-4">投稿する</h2>
      <form id="post-form" class="space-y-3">
        <input type="hidden" name="post[google_place_id]" value="${place.place_id}">

        <div>
          <label class="block text-sm text-gray-600 mb-1">投稿本文</label>
          <textarea name="post[body]" rows="5" class="w-full border rounded-lg p-2" placeholder="本文を入力..."></textarea>
        </div>

        <div>
          <label class="block text-sm text-gray-600 mb-1">タグ（カンマ区切り）</label>
          <input type="text" name="post[tag_list]" class="w-full border rounded-lg p-2" placeholder="例：ランチ, 個室, 接待">
        </div>

        <div>
          <label class="block text-sm text-gray-600 mb-1">公開範囲</label>
          <select name="post[visibility]" class="w-full border rounded-lg p-2">
            <option value="everyone">全員に公開</option>
            <option value="company_only" selected>会社内のみ</option>
            <option value="private_">非公開</option>
          </select>
        </div>

        <div>
          <label class="block text-sm text-gray-600 mb-1">画像・動画</label>
          <input type="file" name="post[media][]" accept="image/*,video/*" multiple class="block w-full border rounded-lg p-2">
          <p class="text-xs text-gray-500 mt-1">画像・動画をアップロードできます（合計10個まで）</p>
        </div>

        <div id="post-form-error" class="text-sm text-red-600 hidden"></div>

        <div class="pt-2 flex gap-2">
          <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white">投稿する</button>
          <button type="button" id="post-form-cancel" class="px-4 py-2 rounded-lg border">キャンセル</button>
        </div>
      </form>
    </div>
  </div>
  `;
  overlay.classList.remove("hidden");
  // 背面スクロール抑止
  document.body.style.overflow = "hidden";

  // 閉じる動作
  overlay.querySelector("#post-overlay-close")?.addEventListener("click", closePostOverlay);
  overlay.querySelector("#post-form-cancel")?.addEventListener("click", closePostOverlay);
  overlay.addEventListener("click", (e) => {
    // 外部クリックで閉じる（カードないクリックは無視）
    const card = overlay.querySelector("form")?.parentElement;
    if (card && !card.contains(e.target)) closePostOverlay();
  });
  document.addEventListener("keydown", escCloseOnce);

  function escCloseOnce(ev) {
    if (ev.key === "Escape") {
      closePostOverlay();
      document.removeEventListener("keydown", escCloseOnce);
    }
  }

  // 送信
  const form = overlay.querySelector("#post-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = overlay.querySelector("#post-form-error");
    err?.classList.add("hidden");
    err.textContent = "";

    const fd = new FormData(form);

    // UX: 二重送信防止
    const submitBtn = form.querySelector('button[type="submit"]');
    const prevTxt = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "投稿中...";

    const files = form.querySelector('input[name="post[media][]"]').files;
    if (files.length > 10) {
      err.textContent = "画像・動画は合計10個までです。";
      err.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = prevTxt;
      return;
    }

    try {
      await submitPostForm(fd);
      closePostOverlay();
      // 成功後：現在の place の投稿一覧をリロード
      fetch(`/posts/by_place?place_id=${encodeURIComponent(place.place_id)}`, { headers: { "Accept":"application/json" }})
        .then(r => r.ok ? r.json() : [])
        .then((posts) => { renderPlacePosts(posts); renderPlaceMedia(posts); })
        .catch(() => {});
    } catch (e) {
      err.textContent = e.message || "投稿に失敗しました。";
      err.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = prevTxt;
    }
  });
}

function activateMyTab(tab) {
  const map = {
    pins: "tab-pins",
    posts: "tab-posts",
    account: "tab-account",
  };
  Object.values(map).forEach(id => document.getElementById(id)?.classList.add("hidden"));
  document.getElementById(map[tab])?.classList.remove("hidden");
}

async function loadMyPins() {
  const ul = document.getElementById("my-pins");
  if (!ul) return;
  ul.innerHTML = `<li class="text-sm text-gray-500">読み込み中...</li>`;
  try {
    const res = await fetch("/me/pins", {  headers: { "Accept": "application/json" }});
    const pins = await res.json();
    ul.innerHTML = "";
    if (pins.length === 0) {
      ul.innerHTML = `<li class="text-sm text-gray-500">ピンはまだありません。</li>`;
      return;
    }
    pins.forEach(p => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between bg-white border rounded-lg p-3";
      li.innerHTML = `
        <div>
          <div class="font-medium">${p.name ?? ""}</div>
          <div class="text-sm text-gray-600">${p.address ?? ""}</div>
          <div class="text-xs text-gray-500 mt-1">投稿数：${p.posts_count || 0}</div>
        </div>
        <a class="text-blue-600 hover:underline text-sm"
        href="https://www.google.com/maps/search/?api=1&query=&query_place_id=${p.google_place_id}"
        target="_blank" rel="noopener">地図で見る</a>
      `;
      ul.appendChild(li);
    });
  } catch(_) {
    ul.innerHTML = `<li class="text-sm text-red-600">読み込みに失敗しました。</li>`;
  }
}

async function loadMyPosts() {
  const ul = document.getElementById("my-posts");
  if (!ul) return;
  ul.innerHTML = `<li class="text-sm text-gray-500">読み込み中...</li>`;
  try {
    const res = await fetch("/me/posts", { headers: { "Accept": "application/json" }});
    const posts = await res.json();
    ul.innerHTML = "";
    if (!posts.length) {
      ul.innerHTML = `<li class="text-sm text-gray-500">投稿はまだありません。</li>`;
      return;
    }
    // 既存のカードUIと同じ見た目で1枚ずつ
    posts.forEach(p => {
      const first = (p.media || [])[0];
      let hero = `<div class="w-full h-48 bg-gray-100"></div>`;
      if (first) {
        hero = first.type === "image"
          ? `<img src="${first.url}" class="w-full h-48 object-cover">`
          : `<video src="${first.url}" ${first.poster ? `poster="${first.poster}"` : ""} class="w-full h-48 object-cover" muted controls preload="metadata"></video>`;
      }
      const li = document.createElement("li");
      li.className = "bg-white rounded-lg border overflow-hidden";
      li.innerHTML =`
        <div class="w-full bg-gray-50">${hero}</div>
        <div class="px-3 py-2">
          <div class="text-sm text-gray-900 font-medium mb-1">${p.title || ""}</div>
          <div class="text-sm text-gray-700 leading-relaxed">
            ${(p.body || "").replace(/\s+/g," ").slice(0,80)}${(p.body||"").length>80?"…":""}
          </div>
          <div class="mt-1">
            <a href="/posts/${p.id}" class="text-xs text-gray-500 hover:underline">続きを読む</a>
          </div>
        </div>
      `;
      ul.appendChild(li);
    });
  } catch(_) {
    ul.innerHTML = `<li class="text-sm text-red-600">読み込みに失敗しました。</li>`;
  }
}

// =====================
// プロフィール編集 オーバーレイ
// ※ 既存の #post-overlay を共用
// =====================
function openProfileEditOverlay() {
  fetch("/profile", { headers: { "Accept": "application/json" }})
    .then(r => r.json())
    .then(p => {
      const overlay = document.getElementById("profile-overlay");
      if (!overlay) return;
      overlay.innerHTML = `
        <div class="absolute inset-0 bg-white/80"></div>
        <div class="relative w-full h-full flex items-center justify-center p-4">
          <div class="bg-white w-full max-w-xl max-h-[90vh] overflow-auto rounded-2xl shadow-xl p-5 relative">
            <button id="ov-close" class="absolute top-3 right-3 text-gray-500 hover:text-black text-xl" aria-label="閉じる">✕</button>
            <h2 class="text-lg font-semibold mb-4">プロフィール編集</h2>
            <form id="profile-form" class="space-y-3">
              <div>
                <label class="block text-sm text-gray-600 mb-1">ユーザー名</label>
                <input name="profile[username]" class="w-full border rounded-lg p-2" value="${p.username||""}">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">名前・ニックネーム</label>
                <input name="profile[display_name]" class="w-full border rounded-lg p-2" value="${p.display_name||""}">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">会社名</label>
                <input name="profile[company]" class="w-full border rounded-lg p-2" value="${p.company||""}">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">部署名</label>
                <input name="profile[department]" class="w-full border rounded-lg p-2" value="${p.department||""}">
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">自己紹介</label>
                <textarea name="profile[bio]" rows="4" class="w-full border rounded-lg p-2">${p.bio||""}</textarea>
              </div>

              <div>
                <label class="block text-sm text-gray-600 mb-1">プロフィール画像</label>
                <input type="file" name="profile[avatar]" accept="image/*" class="block w-full border rounded-lg p-2">
                ${p.avatar_url ? `<img src="${p.avatar_url}" class="mt-2 w-24 h-24 rounded-full border object-cover">` : ""}
              </div>

              <div id="profile-error" class="text-sm text-red-600 hidden"></div>

              <div class="pt-2 flex gap-2">
                <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white">保存</button>
                <button type="button" id="profile-cancel" class="px-4 py-2 rounded-lg border">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      `;
      overlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";

      // 上部 ✕ ボタンで閉じる
      const close = () => { overlay.classList.add("hidden"); overlay.innerHTML=""; document.body.style.overflow=""; };
      overlay.querySelector("#ov-close")?.addEventListener("click", close);
      overlay.addEventListener("click", (e) => {
        const card = overlay.querySelector("form")?.parentElement;
        if (card && !card.contains(e.target)) close();
      });

      // キャンセルボタンで閉じる
      overlay.querySelector("#profile-cancel")?.addEventListener("click", close);
      document.addEventListener("keydown", function escCloseOnce(ev) {
        if (ev.key === "Escape") {
          close();
          document.removeEventListener("keydown", escCloseOnce);
        }
      });

      const form = overlay.querySelector("#profile-form");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = overlay.querySelector("#profile-error");
        err.classList.add("hidden"); err.textContent = "";
        const fd = new FormData(form);

        const btn = form.querySelector('button[type="submit"]');
        const prev = btn.textContent; btn.disabled=true; btn.textContent="保存中...";
        try {
          const res = await fetch("/profile", {
            method: "PATCH",
            headers: { "X-CSRF-Token": csrfToken(), "Accept": "application/json" },
            body: fd, credentials: "same-origin"
          });
          const data = await res.json().catch(()=>({}));
          if (!res.ok) throw new Error((data && data.errors && data.errors.join("\n")) || `HTTP ${res.status}`);
          close();
          loadMyProfilePanelAndPins();
        } catch (e) {
          err.textContent = e.message || "更新に失敗しました。";
          err.classList.remove("hidden");
        } finally {
          btn.disabled=false; btn.textContent=prev;
        }
      });
    });
}

function renderPinsOnMap(pins) {
  if(!map) return;
  const bounds = new google.maps.LatLngBounds();

  pins.forEach(p => {
    if (!p.latitude || !p.longitude) return;
    const pos = new google.maps.LatLng(p.latitude, p.longitude);
    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: {
        // 見分けやすいシンプルな丸（必要ならカスタム画像に）
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
      }
    });
    markers.push(marker);
    bounds.extend(pos);
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds);
  }
}

// ===== /me 用：自分のプロフィールとピン =====
async function loadMyProfilePanelAndPins() {
  // プロフィール
  try {
    console.debug("[me] fetching /profile json...");
    const res = await fetch("/profile.json", { headers: { "Accept": "application/json" }});
    const p = await res.json();

    const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val ?? "-"; };
    set("#pf-username", p.username);
    set("#pf-display-name", p.display_name);
    set("#pf-company", p.company);
    set("#pf-dept", p.department);
    set("#pf-bio", p.bio);

    const avatarEl = document.getElementById("pf-avatar");
    if (avatarEl) {
      const url = p.avatar_thumb_url || p.avatar_url;
      if (url) {
        avatarEl.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      } else {
        avatarEl.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='100%' height='100%' fill='%23e5e7eb'/></svg>";
      }
    }

    // counts は既存の /profile JSONに無い想定なので別途取得
    // ピン・ポスト件数の簡易反映（必要に応じてAPI側で counts を返すよう拡張してOK）
    fetch("/me/pins", { headers: { "Accept": "application/json" }})
      .then(r => r.json())
      .then(pins => {
        const el = document.querySelector("#pf-count-pins"); if (el) el.textContent = pins.length || 0;
        renderPinsOnMap(pins);
      }).catch(()=>{});

    fetch("/me/posts", { headers: { "Accept": "application/json" }})
      .then(r => r.json())
      .then(posts => {
        const el = document.querySelector("#pf-count-posts"); if (el) el.textContent = posts.length || 0;
      }).catch(()=>{});

  } catch(_) {}
}

// ===== /users/:id 用：相手のプロフィールとピン =====
async function loadUserProfilePanelAndPins(userId) {
  try {
    const res = await fetch(`/users/${userId}.json`, { headers: { "Accept": "application/json" }});
    const u = await res.json();

    const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val ?? "-"; };
    set("#u-username", u.username);
    set("#u-display-name", u.display_name);
    set("#u-company", u.company);
    set("#u-dept", u.department);
    set("#u-bio", u.bio);

    set("#u-count-posts", u.counts?.posts ?? 0);
    set("#u-count-pins", u.counts?.pins ?? 0);
    set("#u-count-followers", u.counts?.followers ?? 0);
    set("#u-count-following", u.counts?.following ?? 0);

    // ピンをMapに描画
    const pr = await fetch(`/users/${userId}/pins.json`, { headers: { "Accept": "application/json" }});
    const pins = await pr.json();
    renderPinsOnMap(pins);
  } catch (e) {
    console.warn(e);
  }
}

// ===== 画面ごとの初期化 =====
document.addEventListener("turbo:load", () => {
  // 地図の初期化
  if (document.getElementById("map") && window.google?.maps && typeof window.initMap === "function") {
    window.initMap();
  }

  const editBtn = document.getElementById("profile-edit-btn");
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openProfileEditOverlay();
    });
  }

  // /me ページ用
  if (location.pathname === "/me") {
    loadMyProfilePanelAndPins();

    // タブ切替で読み込み
    document.getElementById("tab-btn-posts")?.addEventListener("click", () => {
      document.getElementById("tab-posts")?.classList.remove("hidden");
      document.getElementById("tab-pins")?.classList.add("hidden");
      loadMyPosts();
    });

    document.getElementById("tab-btn-pins")?.addEventListener("click", () => {
      document.getElementById("tab-pins")?.classList.remove("hidden");
      document.getElementById("tab-posts")?.classList.add("hidden");
      loadMyPins();
    });

    // 初期表示で投稿タブを読み込みたいなら
    loadMyPosts();

    return;
  }

  // /users/:id ページ用
  const m = location.pathname.match(/^\/users\/(\d+)/);
  if (m) {
    const userId = m[1];
    loadUserProfilePanelAndPins(userId);
  }
});
