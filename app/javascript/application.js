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
  if (!container) return;
  let top = 16; // デフォルト（/me など search-bar 無しの画面）
  if (searchBar) {
    const bar = searchBar.getBoundingClientRect();
    const cont = container.getBoundingClientRect();
    top = Math.max(8, bar.bottom - cont.top + 8);
  }
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

// ===== 投稿編集オーバーレイ =====
function openEditPostOverlay(post) {
  const overlay = document.getElementById("post-overlay");
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="absolute inset-0 bg-white/80"></div>
    <div class="relative w-full h-full flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl shadow-xl p-5 relative">
        <button id="post-overlay-close" class="absolute top-3 right-3 text-gray-500 hover:text-black text-xl" aria-label="閉じる">✕</button>

        <h2 class="text-lg font-semibold mb-4">投稿を編集</h2>
        <form id="edit-post-form" class="space-y-3">
          <input type="hidden" name="post[id]" value="${post.id}">

          <div>
            <label class="block text-sm text-gray-600 mb-1">投稿本文</label>
            <textarea name="post[body]" rows="5" class="w-full border rounded-lg p-2">${(post.body || "").replace(/</g,"&lt;")}</textarea>
          </div>

          <div>
            <label class="block text-sm text-gray-600 mb-1">タグ（カンマ区切り）</label>
            <input type="text" name="post[tag_list]" class="w-full border rounded-lg p-2" value="${(Array.isArray(post.tags)?post.tags:[]).join(", ")}">
          </div>

          <div>
            <label class="block text-sm text-gray-600 mb-1">画像・動画</label>
            <input type="file" name="post[media][]" accept="image/*,video/*" multiple class="block w-full border rounded-lg p-2">
            <p class="text-xs text-gray-500 mt-1">選択すると既存メディアは置き換えられます</p>
          </div>

          <div id="edit-post-error" class="text-sm text-red-600 hidden"></div>

          <div class="pt-2 flex gap-2">
            <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white">保存</button>
            <button type="button" id="edit-post-cancel" class="px-4 py-2 rounded-lg border">キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  `;
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const close = () => { overlay.classList.add("hidden"); overlay.innerHTML=""; document.body.style.overflow=""; };
  overlay.querySelector("#post-overlay-close")?.addEventListener("click", close);
  overlay.querySelector("#edit-post-cancel")?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    const card = overlay.querySelector("form")?.parentElement;
    if (card && !card.contains(e.target)) close();
  });
  document.addEventListener("keydown", function escCloseOnce(ev) {
    if (ev.key === "Escape") { close(); document.removeEventListener("keydown", escCloseOnce); }
  });

  const form = overlay.querySelector("#edit-post-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = overlay.querySelector("#edit-post-error");
    err.classList.add("hidden"); err.textContent = "";

    const fd = new FormData(form);
    const postId = fd.get("post[id]");

    try {
      const res = await fetch(`/posts/${postId}.json`, {
        method: "PATCH",
        headers: { "X-CSRF-Token": csrfToken(), "Accept": "application/json" },
        body: fd,
        credentials: "same-origin"
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error((data.errors||[]).join("\n") || `HTTP ${res.status}`);
      close();
      loadMyPosts(); // 反映
    } catch (e) {
      err.textContent = e.message || "更新に失敗しました。";
      err.classList.remove("hidden");
    }
  });
}

// ===== 削除 =====
async function confirmDeletePost(id) {
  if (!window.confirm("この投稿を削除します。よろしいですか？")) return;
  try {
    const res = await fetch(`/posts/${id}.json`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken(), "Accept": "application/json" },
      credentials: "same-origin"
    });
    if (!res.ok) {
      const data = await res.json().catch(()=>({}));
      throw new Error((data.errors||[]).join("\n") || `HTTP ${res.status}`);
    }
    loadMyPosts();
  } catch (e) {
    alert(e.message || "削除に失敗しました。");
  }
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
  // 左の余白を消す
  ul.classList.add("list-none", "pl-0");

  if (!posts || posts.length === 0) {
    const li = document.createElement("li");
    li.className = "text-sm text-gray-500";
    li.textContent = "この場所の投稿はまだありません。";
    ul.appendChild(li);
    return;
  }

  posts.forEach((p) => {
    // ユーザー情報
    const userName = p.user_name || "アカウント名";

    // メディア（画像 or 動画）: ある時だけ表示
    const first = (Array.isArray(p.media) ? p.media : [])[0];
    const mediaHtml = (() => {
      if (!first) return "";
      if (first.type === "image") {
        return `
          <div class="w-full bg-gray-50">
            <img src="${first.url}" alt="" class="w-full h-48 object-cover">
          </div>`;
      } else {
        const poster = first.poster ? ` poster="${first.poster}"` : "";
        return `
          <div class="w-full bg-gray-50">
            <video src="${first.url}"${poster} class="w-full h-48 object-cover" muted controls preload="metadata"></video>
          </div>`;
      }
    })();

    // 本文（空ならプレースホルダー）
    const rawBody = (p.body ?? "");
    const bodyText = rawBody.replace(/^[\s\u3000]+|[\s\u3000]+$/g, "") || "（本文は未入力です）";

    // 投稿のHTML
    const li = document.createElement("li");
    li.className = "bg-white rounded-lg border overflow-hidden";
    li.innerHTML = `
      <div class="px-3 py-2 flex items-center gap-2 border-b">
        <span class="text-sm text-gray-700">${userName}</span>
      </div>

      ${mediaHtml}

      <div class="px-3 py-2">
        <div class="text-sm text-gray-700 leading-relaxed">
          ${bodyText}
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
    const res = await fetch("/me/pins", { headers: { "Accept": "application/json" }});
    const pins = await res.json();
    ul.innerHTML = "";
    if (pins.length === 0) {
      ul.innerHTML = `<li class="text-sm text-gray-500">ピンはまだありません。</li>`;
      return;
    }
    renderMyPins(pins);  // ← ここで呼び出す！
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

    posts.forEach(p => {
      const first = (Array.isArray(p.media) ? p.media : [])[0];

      // メディアブロック（左カラム）— 画像/動画が無ければ空
      let mediaBlock = "";
      if (first) {
        if (first.type === "image") {
          mediaBlock = `
            <div class="w-40 h-28 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
              <img src="${first.url}" alt="" class="w-full h-full object-cover">
            </div>`;
        } else {
          const poster = first.poster ? ` poster="${first.poster}"` : "";
          mediaBlock = `
            <div class="w-40 h-28 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
              <video src="${first.url}"${poster} class="w-full h-full object-cover" muted controls preload="metadata"></video>
            </div>`;
        }
      }

      // 本文（常に出す）
      const bodyText = (p.body ?? "").replace(/^[\s\u3000]+|[\s\u3000]+$/g, "") || "（本文は未入力です）";

      // カードDOM
      const li = document.createElement("li");
      li.className = "bg-white rounded-lg border overflow-hidden";

      // 2カラム/1カラムの切り替え
      if (mediaBlock) {
        // 画像あり → 左サムネ + 右本文
        li.innerHTML = `
          <div class="p-3 flex gap-3">
            ${mediaBlock}
            <div class="flex-1 min-w-0">
              <div class="flex items-start gap-2 mb-2">
                <div class="ml-auto flex gap-2">
                  <button type="button"
                          class="btn-edit px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs hover:bg-yellow-200"
                          title="編集">✏ 編集</button>
                  <button type="button"
                          class="btn-delete px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                          title="削除">🗑 削除</button>
                </div>
              </div>
              <div class="text-sm text-gray-700 leading-relaxed break-words">
                ${bodyText.replace(/</g,"&lt;")}
              </div>
            </div>
          </div>
        `;
      } else {
        // 画像なし → ワンカラム
        li.innerHTML = `
          <div class="p-3">
            <div class="flex items-start gap-2 mb-2">
              <div class="ml-auto flex gap-2">
                <button type="button"
                        class="btn-edit px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs hover:bg-yellow-200"
                        title="編集">✏ 編集</button>
                <button type="button"
                        class="btn-delete px-2 py-1 rounded bg-red-100 text-red-700 text-xs hover:bg-red-200"
                        title="削除">🗑 削除</button>
              </div>
            </div>
            <div class="text-sm text-gray-700 leading-relaxed break-words">
              ${bodyText.replace(/</g,"&lt;")}
            </div>
          </div>
        `;
      }

      // ボタンクリック
      ul.appendChild(li);
      li.querySelector(".btn-edit")?.addEventListener("click", () => openEditPostOverlay(p));
      li.querySelector(".btn-delete")?.addEventListener("click", () => confirmDeletePost(p.id));
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
  // 既存CSRFヘルパーを利用
  const token = csrfToken() || "";

  // オーバーレイの入れ物を（無ければ）作る
  let overlay = document.getElementById("profile-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "profile-overlay";
    overlay.className = "fixed inset-0 z-[9999] hidden";
    document.body.appendChild(overlay);
  }

  // 1) 現在値の取得（表示のためだけ。送信は同期なのでJSで送らない）
  fetch("/profile.json", { headers: { "Accept": "application/json" } })
    .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
    .catch(() => ({})) // 失敗しても空で続行
    .then((p) => {
      const displayName = p.display_name || p.full_name || "";

      overlay.innerHTML = `
        <div class="absolute inset-0 bg-white/80"></div>
        <div class="relative w-full h-full flex items-center justify-center p-4">
          <div class="bg-white w-full max-w-xl max-h-[90vh] overflow-auto rounded-2xl shadow-xl p-5 relative">
            <button id="ov-close" class="absolute top-3 right-3 text-gray-500 hover:text-black text-xl" aria-label="閉じる">✕</button>
            <h2 class="text-lg font-semibold mb-4">プロフィール編集</h2>

            <!-- ★同期送信フォーム：Turbo無効化 -->
            <form id="profile-form"
                  action="/profile"
                  method="post"
                  enctype="multipart/form-data"
                  data-turbo="false"
                  class="space-y-3">

              <input type="hidden" name="_method" value="patch">
              <input type="hidden" name="authenticity_token" value="${token}">

              <div>
                <label class="block text-sm text-gray-600 mb-1">ユーザー名</label>
                <input name="user[username]" class="w-full border rounded-lg p-2" value="${p.username || ""}">
              </div>

              <div>
                <label class="block text-sm text-gray-600 mb-1">名前・ニックネーム</label>
                <!-- HTMLはfull_nameで受ける。初期値はdisplay_name優先 -->
                <input name="user[full_name]" class="w-full border rounded-lg p-2" value="${displayName}">
              </div>

              <div>
                <label class="block text-sm text-gray-600 mb-1">会社名</label>
                <input name="user[company]" class="w-full border rounded-lg p-2" value="${p.company || ""}">
              </div>

              <div>
                <label class="block text-sm text-gray-600 mb-1">部署名</label>
                <input name="user[department]" class="w-full border rounded-lg p-2" value="${p.department || ""}">
              </div>

              <div>
                <label class="block text-sm text-gray-600 mb-1">勤務地</label>
                <input name="user[work_location]" class="w-full border rounded-lg p-2" value="${p.work_location || ""}">
              </div>

              <div>
                <label class="block text-sm text-gray-600 mb-1">自己紹介</label>
                <textarea name="user[bio]" rows="4" class="w-full border rounded-lg p-2">${p.bio || ""}</textarea>
              </div>

              <div class="pt-2 flex gap-2">
                <button type="submit" class="px-4 py-2 rounded-lg bg-blue-600 text-white">保存</button>
                <button type="button" id="profile-cancel" class="px-4 py-2 rounded-lg border">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      `;

      // 表示
      overlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";

      // 閉じる関数
      const close = () => {
        overlay.classList.add("hidden");
        overlay.innerHTML = "";
        document.body.style.overflow = "";
      };

      // 閉じるイベント
      overlay.querySelector("#ov-close")?.addEventListener("click", close);
      overlay.querySelector("#profile-cancel")?.addEventListener("click", close);
      overlay.addEventListener("click", (e) => {
        const card = overlay.querySelector("form")?.parentElement;
        if (card && !card.contains(e.target)) close();
      });
      document.addEventListener("keydown", function escOnce(ev) {
        if (ev.key === "Escape") { close(); document.removeEventListener("keydown", escOnce); }
      });

      // ★ 送信時は「何もしない」＝ブラウザの通常送信に任せる
      //     もし二重送信防止だけ入れたい場合は以下（通信は介入しない）
      const form = overlay.querySelector("#profile-form");
      form?.addEventListener("submit", () => {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = "保存中..."; }
      });
    });
}

function renderPinsOnMap(pins) {
  if(!map) return;
  const bounds = new google.maps.LatLngBounds();

  const PIN_PATH = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z";

  pins.forEach(p => {
    if (!p.latitude || !p.longitude) return;
    const pos = new google.maps.LatLng(p.latitude, p.longitude);

    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: {
        path: PIN_PATH,
        fillColor: "#22c55e",     // 緑（Tailwind green-500）
        fillOpacity: 1,
        strokeColor: "#166534",   // 濃い緑（green-700）
        strokeWeight: 1.5,
        scale: 1.8,               // 大きさ調整
        anchor: new google.maps.Point(12, 22) // 先端を座標に合わせる
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
    openPanel();

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

  // /posts 検索ページ
  if (location.pathname === "/posts") {
    initPostsSearchPage();
    return;
  }
});

function renderMyPins(pins) {
  const list = document.getElementById("my-pins");
  if (!list) return;
  list.innerHTML = "";

  pins.forEach(pin => {
    const li = document.createElement("li");
    li.className = "p-3 hover:bg-gray-100 cursor-pointer border-b";
    li.dataset.placeId = pin.google_place_id;

    // 右側サムネ（Placesの1枚目）
    const thumb = document.createElement("img");
    thumb.className = "w-24 h-24 object-cover rounded-md border";
    if (map && service) {
      service.getDetails({ placeId: pin.google_place_id, fields: ["photos"] }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.photos?.length) {
          thumb.src = place.photos[0].getUrl({ maxWidth: 200, maxHeight: 200 });
        } else {
          thumb.src = "data:image/svg+xml;utf8," +
            encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#e5e7eb"/></svg>');
        }
      });
    }

    // 左側テキスト
    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";
    info.innerHTML = `
      <div class="font-semibold truncate">${pin.name ?? ""}</div>
      <div class="text-sm text-gray-600 truncate">${pin.address ?? ""}</div>
      <div class="mt-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded inline-block">保存済み</div>
    `;

    const row = document.createElement("div");
    row.className = "flex gap-3 items-center";
    row.appendChild(info);
    row.appendChild(thumb);
    li.appendChild(row);

    // ✅ クリックで：地図オフセット移動 → 詳細パネル表示
    li.addEventListener("click", () => {
      if (service) {
        service.getDetails({ placeId: pin.google_place_id, fields: ["geometry"] }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            // 検索結果と同じ「右UIぶんオフセット」移動
            focusPlaceWithRightUIOffset(place.geometry.location);
          }
          // 地図移動の成否に関わらずパネルは開く
          showPlaceDetails(pin.google_place_id);
        });
      } else {
        showPlaceDetails(pin.google_place_id);
      }
    });

    list.appendChild(li);
  });
}

async function fetchPostsByQuery(q) {
  const url = `/posts.json?q=${encodeURIComponent(q || "")}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function renderPostsSearchResults(posts) {
  const ul = document.getElementById("posts-results");
  if (!ul) return;
  ul.innerHTML = "";

  if (!posts || posts.length === 0) {
    ul.innerHTML = `<li class="text-sm text-gray-500">該当する投稿はありません。</li>`;
    return;
  }

  posts.forEach(p => {
    const first = (Array.isArray(p.media) ? p.media : [])[0];
    const user = p.user?.username || "user";

    const mediaBlock = first ? (
      first.type === "image"
        ? `<div class="w-40 h-28 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
            <img src="${first.url}" alt="" class="w-full h-full object-cover">
          </div>`
        : `<div class="w-40 h-28 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
            <video src="${first.url}" ${first.poster?`poster="${first.poster}"`:""}
                    class="w-full h-full object-cover" muted controls preload="metadata"></video>
          </div>`
    ) : "";

    const bodyText = (p.body || "").trim() || "（本文は未入力です）";

    const li = document.createElement("li");
    li.className = "bg-white rounded-lg border overflow-hidden cursor-pointer hover:bg-gray-50";
    li.dataset.placeId = p.google_place_id || "";   // ← 付与！
    li.innerHTML = `
      <div class="p-3 flex gap-3">
        ${mediaBlock || ""}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 text-sm text-gray-700">
            <span>@${user}</span>
          </div>
          <div class="text-sm text-gray-700 leading-relaxed break-words">
            ${bodyText.replace(/</g, "&lt;")}
          </div>
        </div>
      </div>`;

    // クリック → マップ中央へ移動 + 詳細パネル表示
    li.addEventListener("click", () => {
      const pid = li.dataset.placeId;
      if (!pid) return; // place 紐付け無しの投稿

      // 緯度経度が JSON にあるなら即オフセット移動、無ければ Places 詳細で取得
      if (p.latitude && p.longitude) {
        const ll = new google.maps.LatLng(p.latitude, p.longitude);
        focusPlaceWithRightUIOffset(ll);
        showPlaceDetails(pid);
      } else if (service) {
        service.getDetails({ placeId: pid, fields: ["geometry"] }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            focusPlaceWithRightUIOffset(place.geometry.location);
          }
          showPlaceDetails(pid);
        });
      } else {
        showPlaceDetails(pid);
      }
    });

    ul.appendChild(li);
  });

  // ← 検索結果の場所を地図にマーカー表示
  renderMarkersForPosts(posts);
}

function initPostsSearchPage() {
  openPanel(); // 右パネル幅を反映させる（重なり防止）

  const input = document.getElementById("post-search-input");
  const btn   = document.getElementById("post-search-btn");
  const doSearch = async () => {
    const q = input.value.trim();
    const ul = document.getElementById("posts-results");
    if (ul) ul.innerHTML = `<li class="text-sm text-gray-500">検索中...</li>`;
    try {
      const posts = await fetchPostsByQuery(q);
      renderPostsSearchResults(posts);
    } catch (e) {
      if (ul) ul.innerHTML = `<li class="text-sm text-red-600">検索に失敗しました。</li>`;
    }
  };

  input?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); }});
  btn?.addEventListener("click", doSearch);

  // URLに ?q= があれば初期検索
  const urlQ = new URLSearchParams(location.search).get("q");
  if (urlQ) { input.value = urlQ; doSearch(); }
}

function renderMarkersForPosts(posts) {
  if (!map || !service) return;

  // 既存マーカーをクリア（/posts では地図はこの用途なので全消しでOK）
  clearMarkers();

  const seen = new Set();
  posts.forEach(p => {
    const pid = p.google_place_id;
    if (!pid || seen.has(pid)) return;
    seen.add(pid);

    // 緯度経度がAPIで返っているなら非同期を待たずに置ける
    if (p.latitude && p.longitude) {
      const pos = new google.maps.LatLng(p.latitude, p.longitude);
      const mk = new google.maps.Marker({ map, position: pos });
      markers.push(mk);
      mk.addListener("click", () => {
        focusPlaceWithRightUIOffset(pos);
        showPlaceDetails(pid);
      });
      return;
    }

    // 位置が無い場合は Places Details で取得
    service.getDetails({ placeId: pid, fields: ["geometry"] }, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) return;
      const mk = new google.maps.Marker({ map, position: place.geometry.location });
      markers.push(mk);
      mk.addListener("click", () => {
        focusPlaceWithRightUIOffset(place.geometry.location);
        showPlaceDetails(pid);
      });
    });
  });
}