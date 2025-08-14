import { ref } from 'vue';
import { useAppStore } from '../stores/appStore.js';
import { searchService } from '../services/searchService.js';

export default {
    name: 'SearchSection',
    setup() {
        const appStore = useAppStore();
        const term = ref('');
        const results = ref([]);

        const performSearch = async () => {
            if (!term.value) {
                results.value = [];
                return;
            }
            try {
                results.value = await searchService.performSemanticSearch(appStore.jobId, term.value);
            } catch (error) {
                // Errors already logged
            }
        };

        return { term, results, performSearch };
    },
    template: `
        <section class="p-4">
            <h2 class="text-lg font-semibold mb-2">Recherche</h2>
            <div class="flex space-x-2">
                <input v-model="term" class="border p-1 flex-1" placeholder="Rechercher..." />
                <button @click="performSearch" class="px-2 py-1 bg-blue-500 text-white rounded">Chercher</button>
            </div>
            <ul class="mt-2 list-disc list-inside">
                <li v-for="r in results" :key="r.text">{{ r.text }}</li>
            </ul>
        </section>
    `
};
