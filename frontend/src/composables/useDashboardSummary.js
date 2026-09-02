import { apiFetch } from '@/utils/api';
import { ref } from 'vue';

const summary = ref(null);
const loading = ref(false);
const loaded = ref(false);
let inflight = null;

export function useDashboardSummary() {
    async function loadDashboardSummary(force = false) {
        if (!force && loaded.value) {
            return summary.value;
        }
        if (inflight) {
            return inflight;
        }

        loading.value = true;
        inflight = apiFetch('/api/dashboard/summary')
            .then((data) => {
                summary.value = data;
                loaded.value = true;
                return data;
            })
            .catch((error) => {
                loaded.value = false;
                throw error;
            })
            .finally(() => {
                loading.value = false;
                inflight = null;
            });

        return inflight;
    }

    return {
        summary,
        loading,
        loadDashboardSummary
    };
}
