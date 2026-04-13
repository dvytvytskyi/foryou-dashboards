

import fs from 'fs';
import path from 'path';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const fileId = params.id;
        
        const tokensPath = path.join(process.cwd(), 'secrets/amo_tokens.json');
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        const headers = { 'Authorization': 'Bearer ' + tokens.access_token };

        // 1. Try to fetch file metadata to get the download URL
        let downloadUrl = null;
        const fileMetaRes = await fetch('https://reforyou.amocrm.ru/api/v4/files/' + fileId, { headers });
        
        if (fileMetaRes.ok) {
            const fileMeta = await fileMetaRes.json();
            downloadUrl = fileMeta._links?.download?.href || fileMeta.download_url;
        }

        // 2. If no metadata or URL, try multiple fallback patterns
        if (!downloadUrl) {
            const fallbacks = [
                'https://reforyou.amocrm.ru/download/' + fileId,
                'https://reforyou.amocrm.ru/api/v4/files/' + fileId + '/download_url'
            ];
            
            for (const fUrl of fallbacks) {
                const check = await fetch(fUrl, { headers, method: 'HEAD' });
                if (check.ok) {
                    downloadUrl = fUrl;
                    break;
                }
            }
        }

        if (!downloadUrl) return new Response('Cannot resolve file URL for ' + fileId, { status: 404 });

        // 3. Fetch binary with optional auth
        let imageRes = await fetch(downloadUrl, { headers });
        if (!imageRes.ok) {
            // Some links (S3) must be fetched without Auth header
            imageRes = await fetch(downloadUrl);
        }

        if (!imageRes.ok) {
            const errorText = await imageRes.text();
            return new Response('Download failed from ' + downloadUrl + ': ' + errorText, { status: imageRes.status });
        }

        const buffer = await imageRes.arrayBuffer();
        return new Response(buffer, {
            headers: {
                'Content-Type': imageRes.headers.get('content-type') || 'image/png',
                'Cache-Control': 'public, max-age=31536000',
            },
        });

    } catch (error: any) {
        return new Response(error.message, { status: 500 });
    }
}
