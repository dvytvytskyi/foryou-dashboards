(function() {
    console.log('--- FORYOU TRACKER LOADED ---');
    
    // 1. Helpers
    function getCookie(name) {
        let value = "; " + document.cookie;
        let parts = value.split("; " + name + "=");
        if (parts.length == 2) return parts.pop().split(";").shift();
    }
    
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            let date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    // 2. Manage CID
    let cid = getCookie('foryou_cid');
    if (!cid) {
        cid = 'cid-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
        setCookie('foryou_cid', cid, 365);
        console.log('Generated new Foryou CID:', cid);
    }

    // 3. De-anon logic (look for lead_id in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const leadIdManual = urlParams.get('lead_id');

    // 4. Send Tracking Event
    async function sendTrackEvent() {
        try {
            await fetch('/api/track', { // Pointing to our Next.js API
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cid: cid,
                    url: window.location.href,
                    lead_id_manual: leadIdManual
                })
            });
        } catch (e) {
            console.error('Tracking Ping Failed:', e);
        }
    }

    // Ping on load
    sendTrackEvent();
    
    // Optional: Ping every 30s if still on page (to track "Online" status)
    setInterval(sendTrackEvent, 30000);
})();
