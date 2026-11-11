// OMPNETWORK inquiry API — deploy only after provisioning a dedicated project.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS.
// Never expose service-role keys in Vite/frontend variables.
import { createClient } from 'npm:@supabase/supabase-js@2';
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Vary': 'Origin', ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, authorization, apikey', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
  const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
  if (!allowed.includes(origin)) return respond(403, { error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond(405, { error: 'Method not allowed' });
  if (Number(req.headers.get('content-length') || 0) > 16000) return respond(413, { error: 'Request too large' });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return respond(400, { error: 'Invalid JSON' }); }
  const str = (key: string, max: number) => typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, max + 1) : '';
  const full_name = str('fullName',160), email = str('email',254), contact_number = str('contactNumber',50), company = str('company',200), service_id = str('serviceId',100), project_description = str('projectDescription',10000), estimated_budget = str('estimatedBudget',100);
  if (!full_name || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !contact_number || !company || !service_id || project_description.length < 20 || body.privacyConsent !== true || [full_name,email,contact_number,company,service_id,project_description].some((v,i)=>v.length > [160,254,50,200,100,10000][i])) return respond(422, { error: 'Invalid inquiry fields' });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.from('opm_inquiries').insert({ full_name, email, contact_number, company, service_id, project_description, estimated_budget, privacy_consent: true }).select('id').single();
  if (error) { console.error('Inquiry persistence failed', error.code); return respond(503, { error: 'Unable to save inquiry' }); }
  return respond(201, { id: data.id, status: 'received', message: 'Inquiry securely received; email notification is not yet configured.' });
});
