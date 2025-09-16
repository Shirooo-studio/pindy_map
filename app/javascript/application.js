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

// Turboナビゲーションごとに初期化
document.addEventListener("turbo:load", () => {
  if (document.getElementById("map") && window.google?.maps) {
    window.initMap();
  }
});

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
      <div class="pm-actions">
        <div>
          <div class="text-xl">📍</div>
          <div>ピンをする</div>
        </div>
        <div>
          <div class="text-xl">➕</div>
          <div>投稿する</div>
        </div>
        <div>
          <div class="text-xl">🔗</div>
          <div>共有する</div>
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

    // まずは保存すみかチェックしてボタンを出し分け
    fetch(`/pins/check?place_ids=${encodeURIComponent(place.place_id)}`, { headers: { "Accept":"application/json" } })
      .then(r => r.ok ? r.json() : {})
      .then(saved => {
        const isSaved = !!saved[place.place_id];
        const saveBtn = document.getElementById("save-pin-btn");
        const savedBadge = document.getElementById("saved-badge");
        if (isSaved) {
          // 保存済み → ボタンを隠す／バッジを出す
          saveBtn?.classList.add("hidden");
          savedBadge.classList.remove("hidden");
        } else {
          // 未保存 → ボタンを出す&クリックで保存
          saveBtn?.classList.remove("hidden");
          savedBadge?.classList.add("hidden");
          saveBtn.onclick = () => savePinFromPlace(place);
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
function savePinFromPlace(place) {
  const payload = {
    pin: {
      name: place.name ?? "",
      address: place.formatted_address ?? "",
      place_id: place.place_id,
      latitude: place.geometry?.location?.lat() ?? null,
      longitude: place.geometry?.location?.lng() ?? null,
      visibility: "visibility_public" // デフォルトの公開範囲
    }
  };

  fetch("/pins.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken()
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.ok ? res.json() : Promise.reject(res))
  .then(() => {
    // 保存UI更新
    const btn = document.getElementById("save-pin-btn");
    const badge = document.getElementById("saved-badge");
    btn?.classList.add("hidden");
    badge?.classList.remove("hidden");
  })
  .catch(async (res) => {
    if (res.status === 401) {
      alert("保存するにはログインが必要です。");
      return;
    }
    let msg = "保存に失敗しました。";
    try { msg += " " + JSON.stringify(await res.json()); } catch(_){}
    alert(msg);
  });
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
    const hero = p.image_url ||
      "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#f3f4f6"/></svg>`
      );
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

        <div class="w-full bg-gray-50">
          <img src="${hero}" alt="" class="w-full h-48 object-cover">
        </div>

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

  // posts[].image_url を集めて並べる（将来、複数画像対応するなら配列化）
  const images = (posts || [])
    .map(p => p.image_url)
    .filter(Boolean);

  if (images.length === 0) {
    const note = document.createElement("div");
    note.className = "text-sm text-gray-500";
    note.textContent = "この場所の画像はまだありません。";
    wrap.appendChild(note);
    return;
  }

  images.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.className = "pm-thumb";
    wrap.appendChild(img);
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
    const rightUI = spw + gap + detailW + gap;

    // 左側に残っている「空き領域」の中央にピンを置きたい
    const leftFree = Math.max(0, mapW - rightUI);
    const targetX = leftFree / 2;        // 目標のピンのX座標
    const currentX = mapW / 2;           // いまは画面中央
    const delta = currentX - targetX;    // 左へ動かしたい量（px）

    // delta が極端に小さければ何もしない
    if (delta > 4) map.panBy(Math.round(delta), 0);
  });
}
