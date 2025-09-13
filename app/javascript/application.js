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
    li.className = "p-3 hover:bg-gray-50 cursor-pointer";
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
            </span>
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
      map.panTo(place.geometry.location);
      map.setZoom(16);
      flash(li);
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
}
function closePanel() {
  const panel = document.getElementById("search-panel");
  if (!panel) return;
  panel.classList.remove("show");
  panel.classList.add("hidden");
}

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
