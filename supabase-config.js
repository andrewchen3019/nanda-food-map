(function(){
  const SUPABASE_URL = "https://zfevnzwgowvzbrzefhvd.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_mUIyDqei2-TKU91C_Tcmxg_IKSgU2_V";
  const STORAGE_BUCKET = "restaurant-photos";
  const TABLES = {
    restaurants:"restaurants",
    photos:"restaurant_photos"
  };

  const defaultPhotoSlots = [
    {src:"",caption:"Add a storefront photo URL here"},
    {src:"",caption:"Add a menu or dish photo URL here"}
  ];

  function isConfigured(){
    return (
      typeof SUPABASE_URL === "string" &&
      typeof SUPABASE_ANON_KEY === "string" &&
      SUPABASE_URL.startsWith("https://") &&
      !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
    );
  }

  function getConfigIssue(){
    return "Supabase is not configured yet. Open supabase-config.js and paste your project URL plus anon key.";
  }

  function createClient(){
    if(!window.supabase || typeof window.supabase.createClient !== "function"){
      throw new Error("Supabase JS client did not load.");
    }
    if(!isConfigured()){
      throw new Error(getConfigIssue());
    }
    if(!window.__nandaFoodSupabaseClient){
      window.__nandaFoodSupabaseClient = window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
        auth:{
          persistSession:true,
          autoRefreshToken:true,
          detectSessionInUrl:true
        }
      });
    }
    return window.__nandaFoodSupabaseClient;
  }

  function sortPhotos(photos){
    return [...photos].sort((a,b) => {
      const left = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 0;
      const right = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;
      return left - right;
    });
  }

  function normalizeRestaurantRows(rows){
    return rows.map(row => {
      const photos = Array.isArray(row.restaurant_photos) ? sortPhotos(row.restaurant_photos) : [];
      return {
        id:row.id,
        name:row.name_local || row.name_en || "",
        en:row.name_en || row.name_local || "",
        lat:Number(row.lat),
        lng:Number(row.lng),
        cat:Array.isArray(row.categories) ? row.categories.filter(Boolean) : [],
        desc:row.description || "",
        url:row.maps_url || "",
        group:row.place_group === "new" ? "new" : "recommended",
        visited:Boolean(row.visited),
        visitedDate:row.visited_date || "",
        sortOrder:Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
        createdAt:row.created_at || "",
        updatedAt:row.updated_at || "",
        photos:photos.map(photo => ({
          id:photo.id,
          src:photo.src || "",
          caption:photo.caption || "",
          sort_order:Number.isFinite(Number(photo.sort_order)) ? Number(photo.sort_order) : 0
        }))
      };
    });
  }

  function parseCoordinate(value,label,min,max){
    const trimmed = String(value ?? "").trim();
    if(!trimmed){
      throw new Error(`${label} is required.`);
    }
    const parsed = Number(trimmed);
    if(!Number.isFinite(parsed)){
      throw new Error(`${label} must be a valid decimal number.`);
    }
    if(parsed < min || parsed > max){
      throw new Error(`${label} must be between ${min} and ${max}.`);
    }
    return parsed;
  }

  function coordinateKey(value){
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toFixed(10).replace(/\.?0+$/,"")
      : "";
  }

  function extractCoordinatesFromMapUrl(rawUrl){
    const trimmed = String(rawUrl || "").trim();
    if(!trimmed){
      throw new Error("Paste a Google Maps URL first.");
    }

    let parsedUrl;
    try{
      parsedUrl = new URL(trimmed);
    }catch{
      throw new Error("The map link is not a valid URL.");
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if(hostname === "maps.app.goo.gl"){
      throw new Error("Short maps.app.goo.gl links do not include coordinates directly. Open the short link, then paste the full Google Maps URL.");
    }

    const searchParamCandidates = [
      parsedUrl.searchParams.get("q"),
      parsedUrl.searchParams.get("query"),
      parsedUrl.searchParams.get("ll"),
      parsedUrl.searchParams.get("center"),
      parsedUrl.searchParams.get("destination")
    ].filter(Boolean);

    for(const candidate of searchParamCandidates){
      const pair = extractCoordinatePair(candidate);
      if(pair) return pair;
    }

    const atMatch = decodedValue(parsedUrl.pathname).match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if(atMatch){
      return {
        lat:parseCoordinate(atMatch[1],"Latitude",-90,90),
        lng:parseCoordinate(atMatch[2],"Longitude",-180,180)
      };
    }

    const dataMatch = decodedValue(`${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if(dataMatch){
      return {
        lat:parseCoordinate(dataMatch[1],"Latitude",-90,90),
        lng:parseCoordinate(dataMatch[2],"Longitude",-180,180)
      };
    }

    throw new Error("Could not find latitude and longitude in that Google Maps URL.");
  }

  function extractCoordinatePair(value){
    const text = decodedValue(value);
    const pairMatch = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if(!pairMatch) return null;
    return {
      lat:parseCoordinate(pairMatch[1],"Latitude",-90,90),
      lng:parseCoordinate(pairMatch[2],"Longitude",-180,180)
    };
  }

  function decodedValue(value){
    try{
      return decodeURIComponent(String(value || ""));
    }catch{
      return String(value || "");
    }
  }

  async function fetchRestaurants(client){
    const {data,error} = await client
      .from(TABLES.restaurants)
      .select("id,name_local,name_en,lat,lng,categories,description,maps_url,place_group,visited,visited_date,sort_order,created_at,updated_at,restaurant_photos(id,src,caption,sort_order)")
      .order("sort_order",{ascending:true})
      .order("created_at",{ascending:true});

    if(error) throw error;
    return normalizeRestaurantRows(data || []);
  }

  function toRestaurantPayload(formState){
    return {
      name_local:String(formState.name || "").trim(),
      name_en:String(formState.en || "").trim(),
      lat:parseCoordinate(formState.lat,"Latitude",-90,90),
      lng:parseCoordinate(formState.lng,"Longitude",-180,180),
      categories:Array.isArray(formState.cat) ? formState.cat : [],
      description:String(formState.desc || "").trim(),
      maps_url:String(formState.url || "").trim(),
      place_group:formState.group === "new" ? "new" : "recommended",
      visited:Boolean(formState.visited),
      visited_date:formState.visited ? (formState.visitedDate || null) : null,
      sort_order:Number.isFinite(Number(formState.sortOrder)) ? Number(formState.sortOrder) : 0
    };
  }

  function makeMatchKey(place){
    return [
      String(place.url || "").trim().toLowerCase(),
      String(place.name || "").trim().toLowerCase(),
      String(place.en || "").trim().toLowerCase(),
      coordinateKey(place.lat),
      coordinateKey(place.lng)
    ].join("|");
  }

  window.NandaFoodSupabase = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    STORAGE_BUCKET,
    TABLES,
    defaultPhotoSlots,
    isConfigured,
    getConfigIssue,
    createClient,
    fetchRestaurants,
    normalizeRestaurantRows,
    parseCoordinate,
    extractCoordinatesFromMapUrl,
    toRestaurantPayload,
    makeMatchKey
  };
})();
