const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAtlys() {
  console.log("=== INSPECTING ATLYS PROFILES ===");
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*').ilike('company', '%atlys%');
  if (pError) console.error(pError);
  else console.log("Profiles found:", JSON.stringify(profiles, null, 2));

  console.log("\n=== INSPECTING ATLYS SIGNALS ===");
  const { data: signals, error: sError } = await supabase.from('signals').select('*').eq('company', 'Atlys');
  if (sError) console.error(sError);
  else console.log("Signals found:", JSON.stringify(signals, null, 2));
}

inspectAtlys();
