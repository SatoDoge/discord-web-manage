export async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
        credentials: 'include',
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error ?? 'request_failed');
        error.data = data;
        error.status = response.status;
        throw error;
    }

    return data;
}
