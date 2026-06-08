// Restaurant data is loaded from Supabase.

const catColors = {
  breakfast:"#BA7517",
  brunch:"#D85A30",
  lunch:"#185FA5",
  dinner:"#533AB7",
  hotpot:"#A32D2D"
};

const defaultPhotoSlots = [
  {src:"",caption:"Add a storefront photo URL here"},
  {src:"",caption:"Add a menu or dish photo URL here"}
];

let places = [];

const state = {
  category:"all",
  group:"all",
  visit:"all",
  search:"",
  selectedPlaceId:null,
  locationStatus:"Loading restaurant data\u2026",
  loadError:""
};

const map = L.map("map",{zoomControl:true}).setView([24.799,120.975],13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  attribution:"&copy; OpenStreetMap",
  maxZoom:19
}).addTo(map);

const campusIcon = L.divIcon({
  className:"",
  html:'<div style="width:22px;height:22px;border-radius:5px;background:#0F6E56;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;font-family:var(--font-sans)">N</div>',
  iconSize:[22,22],
  iconAnchor:[11,11]
});

const campusMarker = L.marker([24.7942950,120.9653557],{icon:campusIcon,zIndexOffset:1000});
campusMarker.bindPopup(
  '<div class="popup"><div class="popup-title">NTHU Nanda Campus</div><div class="popup-sub">\u570B\u7ACB\u6E05\u83EF\u5927\u5B78\u5357\u5927\u6821\u5340</div><div class="popup-desc">No. 521, Nanda Rd, East District, Hsinchu City, Taiwan 300</div></div>',
  {maxWidth:220}
).addTo(map);

let userMarker = null;
let userCircle = null;
let currentLocation = null;

const markerRecords = new Map();

document.getElementById("search-input").addEventListener("input",event => {
  state.search = event.target.value.trim();
  render();
});

document.getElementById("category-controls").addEventListener("click",event => {
  const button = event.target.closest("[data-cat]");
  if(!button) return;
  state.category = button.dataset.cat;
  render();
});

document.getElementById("group-controls").addEventListener("click",event => {
  const button = event.target.closest("[data-group]");
  if(!button) return;
  state.group = button.dataset.group;
  render();
});

document.getElementById("visit-controls").addEventListener("click",event => {
  const button = event.target.closest("[data-visit]");
  if(!button) return;
  state.visit = button.dataset.visit;
  render();
});

document.getElementById("fit-results-btn").addEventListener("click",() => fitVisibleMarkers());
document.getElementById("locate-btn").addEventListener("click",() => focusCurrentLocation(true));

document.addEventListener("click",event => {
  const actionNode = event.target.closest("[data-place-action]");
  if(!actionNode) return;
  const placeId = actionNode.dataset.placeId;
  if(actionNode.dataset.placeAction === "select" && placeId){
    selectPlace(placeId,true);
  }

  const imageNode = event.target.closest("[data-full-image]");
  if(imageNode){
    openImageModal(imageNode.dataset.fullImage,imageNode.dataset.fullCaption || imageNode.alt || "");
    return;
  }

  if(event.target.closest("[data-close-image-modal]")){
    closeImageModal();
  }
});

document.addEventListener("keydown",event => {
  if(event.key === "Escape"){
    closeImageModal();
  }
});

initApp();

async function initApp(){
  try{
    const loadedPlaces = await loadPlaces();
    places = loadedPlaces.map(place => ({
      ...place,
      group:place.group || "recommended",
      visited:Boolean(place.visited),
      visitedDate:place.visitedDate || "",
      photos:Array.isArray(place.photos) && place.photos.length ? place.photos : defaultPhotoSlots
    }));
    state.selectedPlaceId = places.find(place => place.visited)?.id || places[0]?.id || null;
    state.locationStatus = "Trying to locate you\u2026";
    state.loadError = "";
    buildMarkers();
    render(true);
    focusCurrentLocation(false);
  }catch(error){
    const message = error && error.message
      ? error.message
      : "The map could not load restaurant data from Supabase.";
    if(window.NandaFoodSupabase && !window.NandaFoodSupabase.isConfigured()){
      console.warn(message);
    }else{
      console.error("Failed to load Supabase restaurant data", error);
    }
    state.loadError = message;
    state.locationStatus = "Restaurant data could not be loaded.";
    render(true);
  }
}

async function loadPlaces(){
  if(!window.NandaFoodSupabase){
    throw new Error("Supabase helper script is missing.");
  }
  if(!window.NandaFoodSupabase.isConfigured()){
    throw new Error(window.NandaFoodSupabase.getConfigIssue());
  }
  const client = window.NandaFoodSupabase.createClient();
  try{
    return await window.NandaFoodSupabase.fetchRestaurants(client);
  }catch(error){
    throw new Error(error?.message || "Supabase query failed. Check your schema and row-level security policies.");
  }
}

function buildMarkers(){
  markerRecords.forEach(({marker}) => marker.remove());
  markerRecords.clear();

  places.forEach(place => {
    const marker = L.marker([place.lat,place.lng],{icon:makeIcon(place),zIndexOffset:10});
    marker.on("click",() => {
      state.selectedPlaceId = place.id;
      render(false);
    });
    marker.bindPopup(makePopupMarkup(place),{maxWidth:285});
    marker.addTo(map);
    markerRecords.set(place.id,{marker,place});
  });
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[char]));
}

function titleCase(value){
  return String(value).replace(/\b[a-z]/g,match => match.toUpperCase());
}

function getColor(cats){
  if(cats.length > 2) return "#3B6D11";
  const order = ["hotpot","dinner","brunch","breakfast","lunch"];
  for(const category of order){
    if(cats.includes(category)) return catColors[category];
  }
  return "#888";
}

function getFilteredPlaces(){
  const query = state.search.toLowerCase();
  return places.filter(place => {
    const matchesCategory = state.category === "all" || place.cat.includes(state.category);
    const matchesGroup = state.group === "all" || place.group === state.group;
    const matchesVisit = state.visit === "all" || (state.visit === "visited" ? place.visited : !place.visited);
    const haystack = [place.name,place.en,place.desc,place.cat.join(" "),place.group].join(" ").toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    return matchesCategory && matchesGroup && matchesVisit && matchesSearch;
  });
}

function render(shouldFit = false){
  const filteredPlaces = getFilteredPlaces();
  if(state.loadError){
    syncControlStates();
    renderStats(filteredPlaces);
    renderLoadError();
    renderSummary(filteredPlaces);
    if(shouldFit) fitVisibleMarkers(filteredPlaces);
    return;
  }
  if(filteredPlaces.length && !filteredPlaces.some(place => place.id === state.selectedPlaceId)){
    state.selectedPlaceId = filteredPlaces[0].id;
  }
  syncControlStates();
  syncMarkers(filteredPlaces);
  renderStats(filteredPlaces);
  renderList(filteredPlaces);
  renderDetailCard();
  renderSummary(filteredPlaces);
  if(shouldFit) fitVisibleMarkers(filteredPlaces);
}

function renderLoadError(){
  document.getElementById("detail-card").innerHTML = `<div class="detail-empty">${escapeHtml(state.loadError)}</div>`;
  document.getElementById("place-list").innerHTML = '<div class="detail-card"><div class="detail-empty">No restaurant data is available yet.</div></div>';
  document.getElementById("count").textContent = "Showing 0 places";
  document.getElementById("list-title").textContent = "Places";
  document.getElementById("list-subcopy").textContent = "Data load failed";
}

function syncControlStates(){
  document.querySelectorAll("[data-cat]").forEach(button => {
    button.classList.toggle("active",button.dataset.cat === state.category);
  });
  document.querySelectorAll("[data-group]").forEach(button => {
    button.classList.toggle("active",button.dataset.group === state.group);
  });
  document.querySelectorAll("[data-visit]").forEach(button => {
    button.classList.toggle("active",button.dataset.visit === state.visit);
  });
}

function makeIcon(place){
  const mealColor = getColor(place.cat);
  const outlineColor = place.group === "new" ? "#2f74c8" : "#0f6e56";
  const selected = state.selectedPlaceId === place.id;
  const size = selected ? 30 : 26;
  const innerSize = selected ? 7 : 6;
  const accentSize = selected ? 14 : 12;
  const statusColor = "#f7f4ee";
  const opacity = place.visited ? 1 : 0.42;
  const wrapperTransform = selected ? "scale(1.08)" : "scale(1)";
  const shadow = selected
    ? "drop-shadow(0 0 0 rgba(0,0,0,0)) drop-shadow(0 10px 16px rgba(0,0,0,.28))"
    : "drop-shadow(0 7px 12px rgba(0,0,0,.24))";
  return L.divIcon({
    className:"",
    html:`
      <div style="width:${size}px;height:${size + 8}px;display:flex;align-items:flex-start;justify-content:center;transform:${wrapperTransform};filter:${shadow};opacity:${opacity}">
        <div style="position:relative;width:${size}px;height:${size + 6}px;">
          <div style="position:absolute;left:50%;top:0;width:${size}px;height:${size}px;background:${mealColor};border:2px solid ${outlineColor};border-radius:50% 50% 50% 0;transform:translateX(-50%) rotate(-45deg);"></div>
          <div style="position:absolute;left:50%;top:${Math.round(size * 0.32)}px;width:${accentSize}px;height:${accentSize}px;border-radius:50%;background:${mealColor};border:2px solid rgba(255,255,255,.96);transform:translate(-50%,-50%);"></div>
          <div style="position:absolute;left:50%;top:${Math.round(size * 0.32)}px;width:${innerSize}px;height:${innerSize}px;border-radius:50%;background:${statusColor};box-shadow:0 0 0 1.5px rgba(31,42,36,.18);transform:translate(-50%,-50%);"></div>
        </div>
      </div>
    `,
    iconSize:[size,size + 8],
    iconAnchor:[size / 2,size + 5]
  });
}

function makeBadges(place){
  const mealBadges = place.cat.map(category =>
    `<span class="meal-badge" style="background:${catColors[category] || "#888"}">${escapeHtml(category)}</span>`
  ).join("");
  const groupBadge = `<span class="group-badge ${place.group === "new" ? "new" : ""}">${escapeHtml(place.group)}</span>`;
  return `${groupBadge}${mealBadges}`;
}

function makePopupMarkup(place){
  const photoMarkup = (place.photos.length ? place.photos : defaultPhotoSlots).map(photo => {
    if(photo.src){
      return `<div class="popup-photo"><button type="button" class="image-open" data-full-image="${photo.src}" data-full-caption="${escapeHtml(photo.caption || place.en)}" onclick="document.getElementById('image-modal-img').src=this.dataset.fullImage;document.getElementById('image-modal-img').alt=this.dataset.fullCaption||'Full image';document.getElementById('image-modal-caption').textContent=this.dataset.fullCaption||'';document.getElementById('image-modal').classList.add('open');document.getElementById('image-modal').setAttribute('aria-hidden','false');"><img src="${photo.src}" alt="${escapeHtml(photo.caption || place.en)}"></button></div>`;
    }
    return `<div class="popup-photo"><div class="popup-photo-placeholder">Photo placeholder</div></div>`;
  }).join("");
  const visitedDateMarkup = place.visited && place.visitedDate
    ? `<span class="visited-date">Visited on ${escapeHtml(place.visitedDate)}</span>`
    : "";
  return `
    <div class="popup">
      <div class="popup-gallery">${photoMarkup}</div>
      <div class="popup-title">${escapeHtml(place.en)}</div>
      <div class="popup-sub">${escapeHtml(place.name)}</div>
      <div class="badge-row">${makeBadges(place)}</div>
      <div class="popup-desc">${escapeHtml(place.desc)}</div>
      <div class="popup-meta">
        <span>${place.visited ? "Visited" : "Not yet visited"}</span>
        ${visitedDateMarkup}
      </div>
      <div class="popup-actions">
        <button type="button" data-place-action="select" data-place-id="${place.id}">Details</button>
        <a href="${place.url}" target="_blank" rel="noopener">Open in Maps</a>
      </div>
    </div>
  `;
}

function syncMarkers(filteredPlaces){
  const visibleIds = new Set(filteredPlaces.map(place => place.id));
  markerRecords.forEach(({marker,place},placeId) => {
    marker.setIcon(makeIcon(place));
    marker.setPopupContent(makePopupMarkup(place));
    if(visibleIds.has(placeId)){
      if(!map.hasLayer(marker)) marker.addTo(map);
    }else if(map.hasLayer(marker)){
      marker.remove();
    }
  });
  if(!map.hasLayer(campusMarker)) campusMarker.addTo(map);
  if(userMarker && !map.hasLayer(userMarker)) userMarker.addTo(map);
  if(userCircle && !map.hasLayer(userCircle)) userCircle.addTo(map);
}

function renderStats(filteredPlaces){
  const recommendedCount = filteredPlaces.filter(place => place.group === "recommended").length;
  const newCount = filteredPlaces.filter(place => place.group === "new").length;
  const visitedCount = filteredPlaces.filter(place => place.visited).length;
  document.getElementById("stats").innerHTML = `
    <div class="stat-card"><strong>${filteredPlaces.length}</strong><span>Shown now</span></div>
    <div class="stat-card"><strong>${recommendedCount}</strong><span>Recommended</span></div>
    <div class="stat-card"><strong>${newCount}</strong><span>New / later adds</span></div>
  `;
  document.getElementById("list-subcopy").textContent = `${visitedCount} visited in the current view`;
}

function renderList(filteredPlaces){
  document.getElementById("count").textContent = `Showing ${filteredPlaces.length} place${filteredPlaces.length !== 1 ? "s" : ""}`;
  document.getElementById("list-title").textContent =
    state.group === "all" ? "Places" : state.group === "recommended" ? "Recommended Places" : "New Places";

  if(!filteredPlaces.length){
    document.getElementById("place-list").innerHTML = '<div class="detail-card"><div class="detail-empty">No places match the current filters. Try clearing the search or switching the place type.</div></div>';
    return;
  }

  const groups = [
    {key:"recommended",label:"Recommended"},
    {key:"new",label:"New"}
  ];

  const groupsMarkup = groups.map(group => {
    const groupPlaces = filteredPlaces.filter(place => place.group === group.key);
    if(!groupPlaces.length) return "";
    return `
      <div class="list-group">
        <div class="group-header">
          <strong>${group.label}</strong>
          <span>${groupPlaces.length} place${groupPlaces.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="group-items">
          ${groupPlaces.map(place => `
            <button type="button" class="place-item ${state.selectedPlaceId === place.id ? "selected" : ""}" data-place-action="select" data-place-id="${place.id}">
              <div class="place-title">
                <div>
                  <strong>${escapeHtml(place.en)}</strong>
                  <span>${escapeHtml(place.name)}</span>
                </div>
                <div class="state-pill ${place.visited ? "visited" : "unvisited"}">${place.visited ? "Visited" : "Not yet"}</div>
              </div>
              <div class="badge-row">${makeBadges(place)}</div>
              <div class="place-meta">
                <span>${place.visited && place.visitedDate ? place.visitedDate : `${place.photos.filter(photo => photo.src).length} photo${place.photos.filter(photo => photo.src).length !== 1 ? "s" : ""}`}</span>
                <span><strong>${titleCase(place.group)}</strong></span>
              </div>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("place-list").innerHTML = groupsMarkup;
}

function renderDetailCard(){
  const place = places.find(item => item.id === state.selectedPlaceId);
  if(!place){
    document.getElementById("detail-card").innerHTML = '<div class="detail-empty">Select a place from the map or list to see details.</div>';
    return;
  }

  const photoMarkup = place.photos.map(photo => {
    if(photo.src){
      return `
        <div class="photo-slot">
          <button type="button" class="image-open" data-full-image="${photo.src}" data-full-caption="${escapeHtml(photo.caption || place.en)}" onclick="document.getElementById('image-modal-img').src=this.dataset.fullImage;document.getElementById('image-modal-img').alt=this.dataset.fullCaption||'Full image';document.getElementById('image-modal-caption').textContent=this.dataset.fullCaption||'';document.getElementById('image-modal').classList.add('open');document.getElementById('image-modal').setAttribute('aria-hidden','false');">
            <img src="${photo.src}" alt="${escapeHtml(photo.caption || place.en)}">
          </button>
          <div class="photo-caption">${escapeHtml(photo.caption || "Photo")}</div>
        </div>
      `;
    }
    return `
      <div class="photo-slot">
        <div class="photo-placeholder">Photo placeholder</div>
        <div class="photo-caption">${escapeHtml(photo.caption || "Add an image URL in the code later")}</div>
      </div>
    `;
  }).join("");

  document.getElementById("detail-card").innerHTML = `
    <div class="section-label">Selected Place</div>
    <div class="detail-head">
      <div>
        <h3>${escapeHtml(place.en)}</h3>
        <p>${escapeHtml(place.name)}</p>
      </div>
      <div class="state-pill ${place.visited ? "visited" : "unvisited"}">${place.visited ? "Visited" : "Not yet"}</div>
    </div>
    <div class="badge-row">${makeBadges(place)}</div>
    <div class="detail-desc">${escapeHtml(place.desc)}</div>
    ${place.visited && place.visitedDate ? `<div class="visited-date">Visited on ${escapeHtml(place.visitedDate)}</div>` : ""}
    <div class="action-row">
      <button type="button" class="action-btn" data-place-action="select" data-place-id="${place.id}">Focus on map</button>
      <a class="link-btn" href="${place.url}" target="_blank" rel="noopener">Open in Maps</a>
    </div>
    <div>
      <div class="section-label">Photos</div>
      <div class="photo-strip">${photoMarkup}</div>
    </div>
  `;
}

function renderSummary(filteredPlaces){
  const visitedShown = filteredPlaces.filter(place => place.visited).length;
  const queryText = state.search ? ` for "${state.search}"` : "";
  const locationText = currentLocation
    ? "Map centered on your current location."
    : state.locationStatus;
  document.getElementById("summary-text").textContent =
    `Showing ${filteredPlaces.length} result${filteredPlaces.length !== 1 ? "s" : ""}${queryText}. ${visitedShown} marked visited. ${locationText}`;
}

function selectPlace(placeId,openPopup){
  state.selectedPlaceId = placeId;
  render(false);
  const record = markerRecords.get(placeId);
  if(!record) return;
  map.flyTo([record.place.lat,record.place.lng],Math.max(map.getZoom(),15),{duration:.45});
  if(openPopup) record.marker.openPopup();
}

function fitVisibleMarkers(filteredPlaces = getFilteredPlaces()){
  if(!filteredPlaces.length){
    if(currentLocation){
      map.flyTo(currentLocation,15,{duration:.45});
    }else{
      map.setView([24.799,120.975],13);
      campusMarker.openPopup();
    }
    return;
  }

  const bounds = L.latLngBounds(filteredPlaces.map(place => [place.lat,place.lng]));
  bounds.extend(campusMarker.getLatLng());
  if(currentLocation) bounds.extend(currentLocation);
  map.fitBounds(bounds,{padding:[30,30]});
}

function focusCurrentLocation(forcePrompt){
  if(!navigator.geolocation){
    state.locationStatus = "This browser does not support geolocation. Showing campus instead.";
    render(false);
    return;
  }

  state.locationStatus = forcePrompt ? "Requesting your location\u2026" : "Trying to locate you\u2026";
  render(false);

  navigator.geolocation.getCurrentPosition(
    position => {
      currentLocation = [position.coords.latitude, position.coords.longitude];
      setUserLocationMarker(currentLocation,position.coords.accuracy);
      map.flyTo(currentLocation,15,{duration:.55});
      state.locationStatus = "Location found.";
      render(false);
    },
    () => {
      state.locationStatus = "Location permission was unavailable, so the map stayed focused on the campus area.";
      render(false);
    },
    {enableHighAccuracy:true,timeout:10000,maximumAge:60000}
  );
}

function setUserLocationMarker(latlng,accuracy){
  if(userMarker){
    userMarker.remove();
    userMarker = null;
  }
  if(userCircle){
    userCircle.remove();
    userCircle = null;
  }

  const userIcon = L.divIcon({
    className:"",
    html:'<div style="width:22px;height:22px;border-radius:50%;background:#0b4f7a;border:3px solid #fff;box-shadow:0 0 0 2px rgba(24,36,45,.8),0 8px 16px rgba(0,0,0,.24);"></div>',
    iconSize:[22,22],
    iconAnchor:[11,11]
  });

  userMarker = L.marker(latlng,{icon:userIcon,zIndexOffset:1200});
  userMarker.bindPopup('<div class="popup"><div class="popup-title">Your current location</div><div class="popup-desc">Used to focus the map around where you are now.</div></div>',{maxWidth:220});
  userCircle = L.circle(latlng,{
    radius:Math.max(accuracy || 0,40),
    color:"#0b4f7a",
    weight:1.5,
    fillColor:"#2d82bb",
    fillOpacity:.12
  });
  userMarker.addTo(map);
  userCircle.addTo(map);
}

function openImageModal(src,caption){
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("image-modal-img");
  const modalCaption = document.getElementById("image-modal-caption");
  if(!modal || !modalImg || !src) return;
  modalImg.src = src;
  modalImg.alt = caption || "Full image";
  modalCaption.textContent = caption || "";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
}

function closeImageModal(){
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("image-modal-img");
  const modalCaption = document.getElementById("image-modal-caption");
  if(!modal || !modalImg) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  modalImg.src = "";
  modalImg.alt = "";
  if(modalCaption) modalCaption.textContent = "";
}
