const refs = {
  banner:document.getElementById("status-banner"),
  loginScreen:document.getElementById("login-screen"),
  adminScreen:document.getElementById("admin-screen"),
  loginForm:document.getElementById("login-form"),
  emailInput:document.getElementById("email-input"),
  passwordInput:document.getElementById("password-input"),
  logoutBtn:document.getElementById("logout-btn"),
  authState:document.getElementById("auth-state"),
  authStatePanel:document.getElementById("auth-state-panel"),
  reloadBtn:document.getElementById("reload-btn"),
  newRestaurantBtn:document.getElementById("new-restaurant-btn"),
  importJsonBtn:document.getElementById("import-json-btn"),
  searchInput:document.getElementById("search-input"),
  restaurantCount:document.getElementById("restaurant-count"),
  restaurantList:document.getElementById("restaurant-list"),
  restaurantForm:document.getElementById("restaurant-form"),
  editorTitle:document.getElementById("editor-title"),
  deleteRestaurantBtn:document.getElementById("delete-restaurant-btn"),
  resetFormBtn:document.getElementById("reset-form-btn"),
  photoEmpty:document.getElementById("photo-empty"),
  photoManager:document.getElementById("photo-manager"),
  photoList:document.getElementById("photo-list"),
  uploadPhotoForm:document.getElementById("upload-photo-form"),
  photoFileInput:document.getElementById("photo-file-input"),
  photoCaptionInput:document.getElementById("photo-caption-input"),
  photoSortInput:document.getElementById("photo-sort-input"),
  urlPhotoForm:document.getElementById("url-photo-form"),
  photoUrlInput:document.getElementById("photo-url-input"),
  photoUrlCaptionInput:document.getElementById("photo-url-caption-input"),
  photoUrlSortInput:document.getElementById("photo-url-sort-input")
};

const state = {
  client:null,
  session:null,
  restaurants:[],
  selectedId:null,
  search:"",
  busy:false
};

init();

refs.loginForm.addEventListener("submit",handleLogin);
refs.logoutBtn.addEventListener("click",handleLogout);
refs.reloadBtn.addEventListener("click",() => loadRestaurants(true));
refs.newRestaurantBtn.addEventListener("click",() => selectRestaurant(null));
refs.importJsonBtn.addEventListener("click",importFromJsonSnapshot);
refs.searchInput.addEventListener("input",event => {
  state.search = event.target.value.trim().toLowerCase();
  renderRestaurantList();
});
refs.restaurantForm.addEventListener("submit",saveRestaurant);
refs.deleteRestaurantBtn.addEventListener("click",deleteRestaurant);
refs.resetFormBtn.addEventListener("click",() => selectRestaurant(null));
refs.uploadPhotoForm.addEventListener("submit",uploadPhotoFile);
refs.urlPhotoForm.addEventListener("submit",addPhotoUrl);
refs.photoList.addEventListener("click",handlePhotoListClick);

async function init(){
  if(!window.NandaFoodSupabase){
    setBanner("Supabase helper script is missing.","error");
    setDisabledState(true);
    return;
  }

  if(!window.NandaFoodSupabase.isConfigured()){
    setBanner(window.NandaFoodSupabase.getConfigIssue(),"warning");
    setDisabledState(true);
    return;
  }

  try{
    state.client = window.NandaFoodSupabase.createClient();
    const {data:{session},error} = await state.client.auth.getSession();
    if(error) throw error;
    setSession(session);
    state.client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    setBanner(
      session
        ? "Signed in. Admin tools are unlocked."
        : "Supabase is connected. Sign in to unlock the admin tools.",
      "info"
    );
    if(session){
      await loadRestaurants(false);
    }else{
      renderRestaurantList();
      renderEditor();
    }
  }catch(error){
    console.error(error);
    setBanner(error.message || "Failed to connect to Supabase.","error");
    setDisabledState(true);
  }
}

function setSession(session){
  state.session = session;
  const authText = session?.user?.email
    ? `Signed in as ${session.user.email}`
    : "Not signed in.";
  refs.authState.textContent = authText;
  refs.authStatePanel.textContent = authText;
  syncAuthView();
  if(!session){
    state.search = "";
    state.selectedId = null;
    state.restaurants = [];
    refs.searchInput.value = "";
    refs.passwordInput.value = "";
    renderRestaurantList();
    renderEditor();
  }
  updateActionAvailability();
}

function syncAuthView(){
  const signedIn = Boolean(state.session);
  refs.loginScreen.classList.toggle("hidden",signedIn);
  refs.adminScreen.classList.toggle("hidden",!signedIn);
}

function updateActionAvailability(){
  const signedIn = Boolean(state.session);
  const hasSelection = Boolean(state.selectedId);
  refs.logoutBtn.disabled = !signedIn;
  refs.importJsonBtn.disabled = !signedIn || state.busy;
  refs.deleteRestaurantBtn.disabled = !signedIn || !hasSelection || state.busy;
  refs.uploadPhotoForm.querySelectorAll("input,button").forEach(node => {
    node.disabled = !signedIn || !hasSelection || state.busy;
  });
  refs.urlPhotoForm.querySelectorAll("input,button").forEach(node => {
    node.disabled = !signedIn || !hasSelection || state.busy;
  });
  refs.restaurantForm.querySelectorAll("input,textarea,select,button").forEach(node => {
    if(node === refs.resetFormBtn) return;
    if(node === refs.deleteRestaurantBtn) return;
    node.disabled = !signedIn || state.busy;
  });
  refs.resetFormBtn.disabled = state.busy;
  refs.reloadBtn.disabled = state.busy;
  refs.newRestaurantBtn.disabled = state.busy;
}

function setDisabledState(disabled){
  document.querySelectorAll("button,input,textarea,select").forEach(node => {
    node.disabled = disabled;
  });
}

function setBusy(busy){
  state.busy = busy;
  updateActionAvailability();
}

function setBanner(text,tone){
  refs.banner.textContent = text;
  refs.banner.className = `status-banner ${tone}`;
}

function getFilteredRestaurants(){
  if(!state.search) return state.restaurants;
  return state.restaurants.filter(place => {
    const haystack = [
      place.en,
      place.name,
      place.desc,
      place.group,
      place.cat.join(" ")
    ].join(" ").toLowerCase();
    return haystack.includes(state.search);
  });
}

function renderRestaurantList(){
  const filtered = getFilteredRestaurants();
  refs.restaurantCount.textContent = `${filtered.length} loaded`;
  if(!filtered.length){
    refs.restaurantList.innerHTML = '<div class="empty-note">No restaurants match the current search.</div>';
    return;
  }

  refs.restaurantList.innerHTML = filtered.map(place => `
    <button type="button" class="restaurant-item ${state.selectedId === place.id ? "selected" : ""}" data-restaurant-id="${place.id}">
      <strong>${escapeHtml(place.en || place.name)}</strong>
      <span>${escapeHtml(place.name)}</span>
      <div class="pill-row">
        <span class="pill">${escapeHtml(place.group)}</span>
        <span class="pill">${place.visited ? "visited" : "not visited"}</span>
        <span class="pill">${escapeHtml(place.cat.join(", ") || "no meals")}</span>
      </div>
    </button>
  `).join("");

  refs.restaurantList.querySelectorAll("[data-restaurant-id]").forEach(button => {
    button.addEventListener("click",() => selectRestaurant(button.dataset.restaurantId));
  });
}

function renderEditor(){
  const place = state.restaurants.find(item => item.id === state.selectedId) || null;
  refs.editorTitle.textContent = place ? (place.en || place.name) : "New restaurant";
  refs.photoEmpty.classList.toggle("hidden",Boolean(place));
  refs.photoManager.classList.toggle("hidden",!place);
  if(place){
    fillRestaurantForm(place);
    renderPhotoList(place);
  }else{
    resetRestaurantForm();
    refs.photoList.innerHTML = "";
  }
  updateActionAvailability();
}

function renderPhotoList(place){
  if(!place.photos.length){
    refs.photoList.innerHTML = '<div class="empty-note">No photos yet. Upload one or add a URL.</div>';
    return;
  }
  refs.photoList.innerHTML = place.photos.map(photo => `
    <div class="photo-card">
      <img src="${escapeAttribute(photo.src)}" alt="${escapeAttribute(photo.caption || place.en || place.name)}">
      <div class="photo-card-body">
        <label>
          <span>Caption</span>
          <input type="text" value="${escapeAttribute(photo.caption || "")}" data-photo-caption="${photo.id}">
        </label>
        <label>
          <span>Sort order</span>
          <input type="number" value="${Number(photo.sort_order || 0)}" data-photo-sort="${photo.id}">
        </label>
        <div class="photo-actions">
          <button type="button" class="ghost-btn" data-photo-action="save" data-photo-id="${photo.id}">Save photo</button>
          <button type="button" class="danger-btn" data-photo-action="delete" data-photo-id="${photo.id}">Delete photo</button>
        </div>
      </div>
    </div>
  `).join("");
}

function selectRestaurant(id){
  state.selectedId = id;
  renderRestaurantList();
  renderEditor();
}

function resetRestaurantForm(){
  refs.restaurantForm.reset();
  refs.restaurantForm.elements.group.value = "recommended";
  refs.restaurantForm.elements.sortOrder.value = 0;
}

function fillRestaurantForm(place){
  refs.restaurantForm.elements.en.value = place.en || "";
  refs.restaurantForm.elements.name.value = place.name || "";
  refs.restaurantForm.elements.lat.value = Number.isFinite(place.lat) ? place.lat : "";
  refs.restaurantForm.elements.lng.value = Number.isFinite(place.lng) ? place.lng : "";
  refs.restaurantForm.elements.url.value = place.url || "";
  refs.restaurantForm.elements.sortOrder.value = Number.isFinite(place.sortOrder) ? place.sortOrder : 0;
  refs.restaurantForm.elements.desc.value = place.desc || "";
  refs.restaurantForm.elements.group.value = place.group || "recommended";
  refs.restaurantForm.elements.visited.checked = Boolean(place.visited);
  refs.restaurantForm.elements.visitedDate.value = place.visitedDate || "";
  refs.restaurantForm.querySelectorAll('input[name="cat"]').forEach(input => {
    input.checked = place.cat.includes(input.value);
  });
}

function readRestaurantForm(){
  const categories = Array.from(refs.restaurantForm.querySelectorAll('input[name="cat"]:checked')).map(input => input.value);
  return {
    en:refs.restaurantForm.elements.en.value.trim(),
    name:refs.restaurantForm.elements.name.value.trim(),
    lat:refs.restaurantForm.elements.lat.value,
    lng:refs.restaurantForm.elements.lng.value,
    url:refs.restaurantForm.elements.url.value.trim(),
    sortOrder:refs.restaurantForm.elements.sortOrder.value,
    desc:refs.restaurantForm.elements.desc.value.trim(),
    group:refs.restaurantForm.elements.group.value,
    visited:refs.restaurantForm.elements.visited.checked,
    visitedDate:refs.restaurantForm.elements.visitedDate.value,
    cat:categories
  };
}

async function loadRestaurants(showToast = true){
  if(!state.client || !state.session) return;
  try{
    if(showToast) setBanner("Loading restaurant data from Supabase…","info");
    const restaurants = await window.NandaFoodSupabase.fetchRestaurants(state.client);
    state.restaurants = restaurants;
    if(state.selectedId && !restaurants.some(place => place.id === state.selectedId)){
      state.selectedId = null;
    }
    renderRestaurantList();
    renderEditor();
    if(showToast) setBanner(`Loaded ${restaurants.length} restaurants from Supabase.`,"success");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Failed to load restaurants from Supabase.","error");
  }
}

async function handleLogin(event){
  event.preventDefault();
  if(!state.client) return;
  setBusy(true);
  try{
    const email = refs.emailInput.value.trim();
    const password = refs.passwordInput.value;
    const {data,error} = await state.client.auth.signInWithPassword({email,password});
    if(error) throw error;
    setSession(data?.session || null);
    refs.passwordInput.value = "";
    setBanner("Signed in. You can now edit restaurants and photos.","success");
    await loadRestaurants(false);
  }catch(error){
    console.error(error);
    setBanner(error.message || "Sign-in failed.","error");
  }finally{
    setBusy(false);
  }
}

async function handleLogout(){
  if(!state.client) return;
  setBusy(true);
  try{
    const {error} = await state.client.auth.signOut();
    if(error) throw error;
    setSession(null);
    setBanner("Signed out. Sign in again to unlock restaurant editing.","info");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Sign-out failed.","error");
  }finally{
    setBusy(false);
  }
}

async function saveRestaurant(event){
  event.preventDefault();
  if(!state.session){
    setBanner("Sign in before saving restaurant changes.","warning");
    return;
  }

  const formState = readRestaurantForm();
  if(!formState.name && !formState.en){
    setBanner("Add at least one restaurant name before saving.","warning");
    return;
  }
  if(!formState.cat.length){
    setBanner("Choose at least one meal category.","warning");
    return;
  }

  setBusy(true);
  try{
    const payload = window.NandaFoodSupabase.toRestaurantPayload(formState);
    let result;
    if(state.selectedId){
      const {data,error} = await state.client
        .from(window.NandaFoodSupabase.TABLES.restaurants)
        .update(payload)
        .eq("id",state.selectedId)
        .select("id")
        .single();
      if(error) throw error;
      result = data;
      setBanner("Restaurant updated.","success");
    }else{
      const {data,error} = await state.client
        .from(window.NandaFoodSupabase.TABLES.restaurants)
        .insert(payload)
        .select("id")
        .single();
      if(error) throw error;
      result = data;
      state.selectedId = result.id;
      setBanner("Restaurant created.","success");
    }
    await loadRestaurants(false);
    selectRestaurant(result.id);
  }catch(error){
    console.error(error);
    setBanner(error.message || "Saving failed.","error");
  }finally{
    setBusy(false);
  }
}

async function deleteRestaurant(){
  if(!state.session || !state.selectedId) return;
  const place = state.restaurants.find(item => item.id === state.selectedId);
  if(!place) return;
  if(!window.confirm(`Delete ${place.en || place.name}? This also removes its photo rows.`)){
    return;
  }

  setBusy(true);
  try{
    const storagePaths = (place.photos || [])
      .map(photo => extractStoragePath(photo.src))
      .filter(Boolean);

    const {error} = await state.client
      .from(window.NandaFoodSupabase.TABLES.restaurants)
      .delete()
      .eq("id",state.selectedId);
    if(error) throw error;

    if(storagePaths.length){
      await state.client.storage.from(window.NandaFoodSupabase.STORAGE_BUCKET).remove(storagePaths);
    }

    state.selectedId = null;
    await loadRestaurants(false);
    setBanner("Restaurant deleted.","success");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Delete failed.","error");
  }finally{
    setBusy(false);
  }
}

async function handlePhotoListClick(event){
  const button = event.target.closest("[data-photo-action]");
  if(!button || !state.session || !state.selectedId) return;
  const photoId = button.dataset.photoId;
  if(button.dataset.photoAction === "save"){
    await savePhotoMetadata(photoId);
  }
  if(button.dataset.photoAction === "delete"){
    await deletePhoto(photoId);
  }
}

async function savePhotoMetadata(photoId){
  const captionInput = refs.photoList.querySelector(`[data-photo-caption="${photoId}"]`);
  const sortInput = refs.photoList.querySelector(`[data-photo-sort="${photoId}"]`);
  if(!captionInput || !sortInput) return;

  setBusy(true);
  try{
    const {error} = await state.client
      .from(window.NandaFoodSupabase.TABLES.photos)
      .update({
        caption:captionInput.value.trim(),
        sort_order:Number.isFinite(Number(sortInput.value)) ? Number(sortInput.value) : 0
      })
      .eq("id",photoId);
    if(error) throw error;
    await loadRestaurants(false);
    setBanner("Photo details updated.","success");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Photo update failed.","error");
  }finally{
    setBusy(false);
  }
}

async function deletePhoto(photoId){
  if(!window.confirm("Delete this photo?")){
    return;
  }
  const place = state.restaurants.find(item => item.id === state.selectedId);
  const photo = place?.photos.find(item => item.id === photoId);

  setBusy(true);
  try{
    const {error} = await state.client
      .from(window.NandaFoodSupabase.TABLES.photos)
      .delete()
      .eq("id",photoId);
    if(error) throw error;

    const storagePath = extractStoragePath(photo?.src || "");
    if(storagePath){
      await state.client.storage.from(window.NandaFoodSupabase.STORAGE_BUCKET).remove([storagePath]);
    }
    await loadRestaurants(false);
    setBanner("Photo deleted.","success");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Photo delete failed.","error");
  }finally{
    setBusy(false);
  }
}

async function uploadPhotoFile(event){
  event.preventDefault();
  if(!state.session || !state.selectedId){
    setBanner("Save and select a restaurant before uploading photos.","warning");
    return;
  }
  const file = refs.photoFileInput.files[0];
  if(!file){
    setBanner("Choose a photo file first.","warning");
    return;
  }

  setBusy(true);
  try{
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g,"-");
    const storagePath = `${state.selectedId}/${Date.now()}-${safeName}`;
    const {data:uploadData,error:uploadError} = await state.client
      .storage
      .from(window.NandaFoodSupabase.STORAGE_BUCKET)
      .upload(storagePath,file,{cacheControl:"3600",upsert:false,contentType:file.type || undefined});
    if(uploadError) throw uploadError;

    const {data:publicData} = state.client
      .storage
      .from(window.NandaFoodSupabase.STORAGE_BUCKET)
      .getPublicUrl(uploadData.path);

    const {error:insertError} = await state.client
      .from(window.NandaFoodSupabase.TABLES.photos)
      .insert({
        restaurant_id:state.selectedId,
        src:publicData.publicUrl,
        caption:refs.photoCaptionInput.value.trim(),
        sort_order:Number.isFinite(Number(refs.photoSortInput.value)) ? Number(refs.photoSortInput.value) : 0
      });
    if(insertError) throw insertError;

    refs.uploadPhotoForm.reset();
    refs.photoSortInput.value = 0;
    await loadRestaurants(false);
    setBanner("Photo uploaded.","success");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Photo upload failed.","error");
  }finally{
    setBusy(false);
  }
}

async function addPhotoUrl(event){
  event.preventDefault();
  if(!state.session || !state.selectedId){
    setBanner("Save and select a restaurant before adding photo URLs.","warning");
    return;
  }
  const src = refs.photoUrlInput.value.trim();
  if(!src){
    setBanner("Enter an image URL first.","warning");
    return;
  }

  setBusy(true);
  try{
    const {error} = await state.client
      .from(window.NandaFoodSupabase.TABLES.photos)
      .insert({
        restaurant_id:state.selectedId,
        src,
        caption:refs.photoUrlCaptionInput.value.trim(),
        sort_order:Number.isFinite(Number(refs.photoUrlSortInput.value)) ? Number(refs.photoUrlSortInput.value) : 0
      });
    if(error) throw error;
    refs.urlPhotoForm.reset();
    refs.photoUrlSortInput.value = 0;
    await loadRestaurants(false);
    setBanner("Photo URL added.","success");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Adding the photo URL failed.","error");
  }finally{
    setBusy(false);
  }
}

async function importFromJsonSnapshot(){
  if(!state.session){
    setBanner("Sign in before importing restaurants.json.","warning");
    return;
  }

  setBusy(true);
  try{
    setBanner("Importing restaurants.json into Supabase…","info");
    const response = await fetch("restaurants.json",{cache:"no-store"});
    if(!response.ok){
      throw new Error(`Could not load restaurants.json (${response.status}).`);
    }
    const snapshot = await response.json();
    const currentByKey = new Map(state.restaurants.map(place => [window.NandaFoodSupabase.makeMatchKey(place), place]));

    let inserted = 0;
    let updated = 0;
    let photosAdded = 0;

    for(let index = 0; index < snapshot.length; index += 1){
      const source = snapshot[index];
      const normalizedSource = {
        name:source.name || source.en || "",
        en:source.en || source.name || "",
        lat:source.lat,
        lng:source.lng,
        url:source.url || "",
        desc:source.desc || "",
        group:source.group || "recommended",
        visited:Boolean(source.visited),
        visitedDate:source.visitedDate || "",
        cat:Array.isArray(source.cat) ? source.cat : [],
        sortOrder:index
      };

      const payload = window.NandaFoodSupabase.toRestaurantPayload(normalizedSource);
      const matchKey = window.NandaFoodSupabase.makeMatchKey(normalizedSource);
      const existing = currentByKey.get(matchKey);
      let restaurantId = existing?.id || null;
      let existingPhotos = new Set((existing?.photos || []).map(photo => photo.src));

      if(restaurantId){
        const {error} = await state.client
          .from(window.NandaFoodSupabase.TABLES.restaurants)
          .update(payload)
          .eq("id",restaurantId);
        if(error) throw error;
        updated += 1;
      }else{
        const {data,error} = await state.client
          .from(window.NandaFoodSupabase.TABLES.restaurants)
          .insert(payload)
          .select("id")
          .single();
        if(error) throw error;
        restaurantId = data.id;
        inserted += 1;
      }

      const photos = Array.isArray(source.photos) ? source.photos.filter(photo => photo && photo.src) : [];
      for(let photoIndex = 0; photoIndex < photos.length; photoIndex += 1){
        const photo = photos[photoIndex];
        if(existingPhotos.has(photo.src)) continue;
        const {error} = await state.client
          .from(window.NandaFoodSupabase.TABLES.photos)
          .insert({
            restaurant_id:restaurantId,
            src:photo.src,
            caption:photo.caption || "",
            sort_order:photoIndex
          });
        if(error) throw error;
        existingPhotos.add(photo.src);
        photosAdded += 1;
      }
    }

    await loadRestaurants(false);
    setBanner(`Import finished: ${inserted} inserted, ${updated} updated, ${photosAdded} photos added.`,"success");
  }catch(error){
    console.error(error);
    setBanner(error.message || "Import failed.","error");
  }finally{
    setBusy(false);
  }
}

function extractStoragePath(src){
  if(!src) return null;
  try{
    const url = new URL(src);
    const marker = `/storage/v1/object/public/${window.NandaFoodSupabase.STORAGE_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if(index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  }catch{
    return null;
  }
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

function escapeAttribute(value){
  return escapeHtml(value).replace(/`/g,"&#96;");
}
