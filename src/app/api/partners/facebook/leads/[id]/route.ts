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

async function fetchAllLeadNotes(leadId: string) {
    const out: any[] = [];
    const limit = 250;

    for (let page = 1; page <= 20; page++) {
        const res = await amoFetch(`/api/v4/leads/${leadId}/notes?limit=${limit}&page=${page}`);
        if (!res.ok || res.status === 204) break;

        const data = await safeJson(res, { _embedded: { notes: [] } });
        const notes = data?._embedded?.notes || [];
        if (!notes.length) break;

        out.push(...notes);
        if (notes.length < limit) break;
    }

    return out;
}

async function fetchLeadTalks(leadId: string) {
    const res = await amoFetch(`/api/v4/talks?filter[entity_id]=${leadId}&filter[entity_type]=lead&limit=250`);
    if (!res.ok || res.status === 204) return [];
    const data = await safeJson(res, { _embedded: { talks: [] } });
    return data?._embedded?.talks || [];
}

async function fetchLeadChatEvents(leadId: string) {
    const types = ['incoming_chat_message', 'outgoing_chat_message'];
    const events: any[] = [];

    for (const type of types) {
        const res = await amoFetch(
            `/api/v4/events?filter[type]=${type}&filter[entity]=lead&filter[entity_id]=${leadId}&limit=250`
        );
        if (!res.ok || res.status === 204) continue;
        const data = await safeJson(res, { _embedded: { events: [] } });
        events.push(...(data?._embedded?.events || []));
    }

    return events.sort((a, b) => Number(a.created_at || 0) - Number(b.created_at || 0));
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const leadId = params.id;

        // Phase 1: Fetch Lead and other main entity data in parallel
        const [leadRes, filesRes, entityFilesRes, tasksRes, allNotes, talks, chatEvents] = await Promise.all([
            amoFetch(`/api/v4/leads/${leadId}?with=contacts,companies`),
            amoFetch(`/api/v4/files?filter[entity_type]=leads&filter[entity_id]=${leadId}`),
            amoFetch(`/api/v4/leads/${leadId}/files`),
            amoFetch(`/api/v4/tasks?filter[entity_id]=${leadId}&filter[entity_type]=leads&filter[is_completed]=0`),
            fetchAllLeadNotes(leadId),
            fetchLeadTalks(leadId),
            fetchLeadChatEvents(leadId)
        ]);

        if (!leadRes.ok) {
            const errText = await leadRes.text();
            return NextResponse.json({ success: false, error: 'Lead not found: ' + errText }, { status: leadRes.status });
        }

        const leadData = await leadRes.json();
        
        // Parse the rest in parallel
        const [filesData, entityFilesData, tasksData] = await Promise.all([
            safeJson(filesRes, { _embedded: { files: [] } }),
            safeJson(entityFilesRes, { _embedded: { files: [] } }),
            safeJson(tasksRes, { _embedded: { tasks: [] } })
        ]);

        // Phase 2: Fetch Contacts and Companies in parallel
        const contactsPromises = (leadData._embedded?.contacts || []).map((c: any) => 
            amoFetch(`/api/v4/contacts/${c.id}`).then(r => safeJson(r, null))
        );
        
        const companiesPromises = (leadData._embedded?.companies || []).map((comp: any) => 
            amoFetch(`/api/v4/companies/${comp.id}`).then(r => safeJson(r, null))
        );

        const [contactsData, companiesData] = await Promise.all([
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
                contacts: contactsData.filter(Boolean),
                companies: companiesData.filter(Boolean),
                files: allFiles,
                tasks: tasksData._embedded?.tasks || [],
                history: allNotes,
                whatsappTalks: talks,
                whatsappEvents: chatEvents
            }
        });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
