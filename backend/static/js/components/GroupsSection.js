import { computed } from 'vue';
import { useGroupStore } from '../stores/groupStore.js';

export default {
    name: 'GroupsSection',
    setup() {
        const groupStore = useGroupStore();
        const count = computed(() => groupStore.totalCount);
        return { count };
    },
    template: `
        <section class="p-4">
            <h2 class="text-lg font-semibold mb-2">Groupes ({{ count }})</h2>
        </section>
    `
};
