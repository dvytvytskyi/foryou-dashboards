
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

async function safeJson(res: Response, fallback: any = {}) {
    if (!res.ok || res.status === 204) return fallback;
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : fallback;
    } catch (e) {
        return fallback;
    }
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const leadId = params.id;
        const tokensPath = path.join(process.cwd(), 'secrets/amo_tokens.json');
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

        const headers = { 'Authorization': 'Bearer ' + tokens.access_token };

        // 1. Fetch Lead
        const leadRes = await fetch('https://reforyou.amocrm.ru/api/v4/leads/' + leadId + '?with=contacts,companies', { headers });
        if (!leadRes.ok) {
            const errText = await leadRes.text();
            return NextResponse.json({ success: false, error: 'Lead not found: ' + errText }, { status: leadRes.status });
        }
        const leadData = await leadRes.json();

        // 2. Fetch Full Contacts Data
        let contactsData = [];
        if (leadData._embedded?.contacts) {
            for (const c of leadData._embedded.contacts) {
                const cRes = await fetch('https://reforyou.amocrm.ru/api/v4/contacts/' + c.id, { headers });
                const cJson = await safeJson(cRes, null);
                if (cJson) contactsData.push(cJson);
            }
        }

        // 3. Fetch Full Companies Data
        let companiesData = [];
        if (leadData._embedded?.companies) {
            for (const comp of leadData._embedded.companies) {
                const compRes = await fetch('https://reforyou.amocrm.ru/api/v4/companies/' + comp.id, { headers });
                const compJson = await safeJson(compRes, null);
                if (compJson) companiesData.push(compJson);
            }
        }

        // 4. Fetch Files (using both entity files and global filter for maximum coverage)
        let allFiles: any[] = [];
        
        // Strategy A: Filtered files
        const filesRes = await fetch('https://reforyou.amocrm.ru/api/v4/files?filter[entity_type]=leads&filter[entity_id]=' + leadId, { headers });
        const filesData = await safeJson(filesRes, { _embedded: { files: [] } });
        if (filesData._embedded?.files) allFiles = [...allFiles, ...filesData._embedded.files];

        // Strategy B: Entity files (Drive)
        const entityFilesRes = await fetch('https://reforyou.amocrm.ru/api/v4/leads/' + leadId + '/files', { headers });
        const entityFilesData = await safeJson(entityFilesRes, { _embedded: { files: [] } });
        if (entityFilesData._embedded?.files) {
            // Merge avoiding duplicates
            for (const f of entityFilesData._embedded.files) {
                if (!allFiles.find(x => x.id === f.id)) allFiles.push(f);
            }
        }

        // 5. Fetch Notes (general + file notes)
        const notesRes = await fetch('https://reforyou.amocrm.ru/api/v4/leads/' + leadId + '/notes', { headers });
        const notesData = await safeJson(notesRes, { _embedded: { notes: [] } });

        // 6. Fetch Tasks
        const tasksRes = await fetch('https://reforyou.amocrm.ru/api/v4/tasks?filter[entity_id]=' + leadId + '&filter[entity_type]=leads&filter[is_completed]=0', { headers });
        const tasksData = await safeJson(tasksRes, { _embedded: { tasks: [] } });

        return NextResponse.json({ 
            success: true, 
            data: {
                lead: leadData,
                contacts: contactsData,
                companies: companiesData,
                files: allFiles,
                tasks: tasksData._embedded?.tasks || [],
                history: notesData._embedded?.notes || []
            }
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
