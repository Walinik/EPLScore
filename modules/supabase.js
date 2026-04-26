// ===== ЗАПРОСЫ К SUPABASE =====
async function supabaseFetch(endpoint) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('Fetch error:', e);
        return [];
    }
}

async function supabasePost(endpoint, body) {
    return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function supabasePatch(endpoint, id, body) {
    return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

async function supabaseDelete(endpoint, id) {
    return fetch(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
}
