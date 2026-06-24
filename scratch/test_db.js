const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching profiles...");
  const { data: profiles, error: pError } = await supabase.from('profiles').select('id, name, company, title, snapshots');
  if (pError) console.error("Error fetching profiles:", pError);
  else {
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(p => {
      console.log(`- ID: ${p.id}, Name: ${p.name}, Company: ${p.company}, Title: ${p.title}`);
      if (p.snapshots && p.snapshots.length > 0) {
        const last = p.snapshots[p.snapshots.length - 1];
        console.log(`  Last Snapshot alternateContacts:`, last.alternateContacts);
      }
    });
  }

  console.log("\nFetching signals...");
  const { data: signals, error: sError } = await supabase.from('signals').select('id, company, label, profile');
  if (sError) console.error("Error fetching signals:", sError);
  else {
    console.log(`Found ${signals.length} signals:`);
    signals.slice(0, 10).forEach(s => {
      console.log(`- ID: ${s.id}, Company: ${s.company}, Label: ${s.label}, Profile: ${s.profile}`);
    });
  }
}

test();
