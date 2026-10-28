
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wzethhepoxpyyuyllyas.supabase.co";

// यहाँ अपनी Supabase Publishable Key डालें।
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SCHrGNv_91t42NC-sxQpmQ_4pAFF2gH";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
