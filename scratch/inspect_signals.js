const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id, name, company, linkedin_url');
  console.log("PROFILES:");
  profiles.forEach(p => {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Company: ${p.company}, URL: ${p.linkedin_url}`);
  });

  const { data: signals } = await supabase.from('signals').select('id, company, label, profile');
  console.log("\nSIGNALS:");
  signals.forEach(s => {
    console.log(`- ID: ${s.id}, Company: ${s.company}, Label: ${s.label}, Profile: ${s.profile}`);
  });
}

run();
