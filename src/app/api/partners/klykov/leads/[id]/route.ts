import { NextResponse } from 'next/server';
import { amoFetch } from '@/lib/amo';

async function safeJson(res: Response, fallback: any = {}) {
    if (!res.ok || res.status === 204) return fallback;
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : fallback;
    } catch (e) {
        return fallback;
    }
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const leadId = params.id;

        // Phase 1: Fetch Lead and other main entity data in parallel
        const [leadRes, filesRes, entityFilesRes, notesRes, tasksRes] = await Promise.all([
            amoFetch(`/api/v4/leads/${leadId}?with=contacts,companies`),
            amoFetch(`/api/v4/files?filter[entity_type]=leads&filter[entity_id]=${leadId}`),
            amoFetch(`/api/v4/leads/${leadId}/files`),
            amoFetch(`/api/v4/leads/${leadId}/notes`),
            amoFetch(`/api/v4/tasks?filter[entity_id]=${leadId}&filter[entity_type]=leads&filter[is_completed]=0`)
        ]);

        if (!leadRes.ok) {
            const errText = await leadRes.text();
            return NextResponse.json({ success: false, error: 'Lead not found: ' + errText }, { status: leadRes.status });
        }

        const leadData = await leadRes.json();
        
        // Parse the rest in parallel
        const [filesData, entityFilesData, notesData, tasksData] = await Promise.all([
            safeJson(filesRes, { _embedded: { files: [] } }),
            safeJson(entityFilesRes, { _embedded: { files: [] } }),
            safeJson(notesRes, { _embedded: { notes: [] } }),
            safeJson(tasksRes, { _embedded: { tasks: [] } })
        ]);

        // Phase 2: Fetch Contacts and Companies in parallel
        const contactsPromises = (leadData._embedded?.contacts || []).map((c: any) => 
            amoFetch(`/api/v4/contacts/${c.id}`).then(r => safeJson(r, null))
        );
        
        const companiesPromises = (leadData._embedded?.companies || []).map((comp: any) => 
            amoFetch(`/api/v4/companies/${comp.id}`).then(r => safeJson(r, null))
        );

        const [contactsDataArray, companiesDataArray] = await Promise.all([
            Promise.all(contactsPromises),
            Promise.all(companiesPromises)
        ]);

        // Merge files
        let allFiles = [...(filesData._embedded?.files || [])];
        for (const f of (entityFilesData._embedded?.files || [])) {
            if (!allFiles.find(x => x.id === f.id)) allFiles.push(f);
        }

        return NextResponse.json({ 
            success: true, 
            data: {
                lead: leadData,
                contacts: contactsDataArray.filter(Boolean),
                companies: companiesDataArray.filter(Boolean),
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
