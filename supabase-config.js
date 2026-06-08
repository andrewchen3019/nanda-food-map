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
      lat:Number(formState.lat),
      lng:Number(formState.lng),
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
      Number(place.lat).toFixed(6),
      Number(place.lng).toFixed(6)
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
    toRestaurantPayload,
    makeMatchKey
  };
})();
