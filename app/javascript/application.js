// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./controllers"

window.initMap = function () {
  const map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 35.6812, lng: 139.7671 }, // 東京駅あたり
    zoom: 14,
  });

  const input = document.getElementById("pac-input");
  const autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ["place_id", "geometry", "name", "formatted_address"],
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) {
      alert("場所が見つかりません");
      return;
    }

    // ピンを立てる
    new google.maps.Marker({
      map,
      position: place.geometry.location,
    });

    // 中心を移動
    map.setCenter(place.geometry.location);

    const latInput = document.getElementById("post_latitude");
    const lngInput = document.getElementById("post_longitude");
    const placeIdInput = document.getElementById("post_place_id");
    const addressInput = document.getElementById("post_address");

    if (latInput) latInput.value = place.geometry.location.lat();
    if (lngInput) lngInput.value = place.geometry.location.lng();
    if (placeIdInput) placeIdInput.value = place.place_id;
    if (addressInput) addressInput.value = place.formatted_address;
  });
};

// Turboナビゲーションごとに初期化
document.addEventListener("turbo:load", () => {
  if (document.getElementById("map") && window.google?.maps) {
    window.initMap();
  }
});
