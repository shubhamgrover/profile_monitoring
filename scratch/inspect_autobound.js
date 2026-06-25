const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id, name, company, snapshots').eq('id', 'https:www.linkedin.comcompanyfactors-ai');
  console.log("Factors.ai profiles:");
  profiles.forEach(p => {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Company: ${p.company}`);
    if (p.snapshots && p.snapshots.length > 0) {
      const snap = p.snapshots[p.snapshots.length - 1];
      console.log("  Autobound signals:", snap.autoboundSignals);
      console.log("  Job Openings:", snap.jobOpenings);
    }
  });
}

run();
