const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanInspect() {
  const { data: profiles } = await supabase.from('profiles').select('id, name, company, title, snapshots').ilike('company', '%atlys%');
  for (const p of profiles || []) {
    console.log(`Profile: "${p.name}", Company: "${p.company}", Title: "${p.title}"`);
    if (p.snapshots && p.snapshots.length > 0) {
      const snap = p.snapshots[p.snapshots.length - 1];
      console.log(`  Snapshot keys:`, Object.keys(snap));
      console.log(`  Snapshot currentTitle: "${snap.currentTitle}"`);
      console.log(`  Snapshot currentCompany: "${snap.currentCompany}"`);
      console.log(`  Snapshot alternateContacts:`, JSON.stringify(snap.alternateContacts));
    }
  }

  const { data: signals } = await supabase.from('signals').select('id, company, label, profile').eq('company', 'Atlys');
  console.log(`Signals count for Atlys: ${signals?.length}`);
  for (const s of signals || []) {
    console.log(`  Signal ID: ${s.id}, Label: "${s.label}", Profile: "${s.profile}"`);
  }
}

cleanInspect();
