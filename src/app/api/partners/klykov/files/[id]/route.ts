
import { amoFetch, getAmoDomain } from '@/lib/amo';

function toAmoPath(urlOrPath: string): string | null {
    if (!urlOrPath) return null;
    if (urlOrPath.startsWith('/')) return urlOrPath;
    try {
        const u = new URL(urlOrPath);
        if (u.host !== getAmoDomain()) return null;
        return `${u.pathname}${u.search}`;
    } catch {
        return null;
    }
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const fileId = params.id;

        // 1. Try to fetch file metadata to get the download URL
        let downloadUrl = null;
        const fileMetaRes = await amoFetch('/api/v4/files/' + fileId);
        
        if (fileMetaRes.ok) {
            const fileMeta = await fileMetaRes.json();
            downloadUrl = fileMeta._links?.download?.href || fileMeta.download_url;
        }

        // 2. If no metadata or URL, try multiple fallback patterns
        if (!downloadUrl) {
            const fallbacks = [
                '/download/' + fileId,
                '/api/v4/files/' + fileId + '/download_url'
            ];
            
            for (const fUrl of fallbacks) {
                const check = await amoFetch(fUrl, { method: 'HEAD' });
                if (check.ok) {
                    downloadUrl = fUrl;
                    break;
                }
            }
        }

        if (!downloadUrl) return new Response('Cannot resolve file URL for ' + fileId, { status: 404 });

        // 3. Fetch binary with optional auth
        let imageRes: Response;
        const amoPath = toAmoPath(downloadUrl);
        if (amoPath) {
            imageRes = await amoFetch(amoPath);
            if (!imageRes.ok && /^https?:\/\//i.test(downloadUrl)) {
                // Some links can point to signed external storage and require a plain fetch.
                imageRes = await fetch(downloadUrl);
            }
        } else {
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
