import { computed } from 'vue';
import { useEntityStore } from '../stores/entityStore.js';

export default {
    name: 'EntitiesSection',
    setup() {
        const entityStore = useEntityStore();
        const count = computed(() => entityStore.totalCount);
        return { count };
    },
    template: `
        <section class="p-4">
            <h2 class="text-lg font-semibold mb-2">Entités ({{ count }})</h2>
        </section>
    `
};
