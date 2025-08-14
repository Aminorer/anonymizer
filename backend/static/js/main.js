import { createApp } from 'vue';
import { createPinia } from 'pinia';

import { useAppStore } from './stores/appStore.js';
import { useEntityStore } from './stores/entityStore.js';
import { useGroupStore } from './stores/groupStore.js';

import EntitiesSection from './components/EntitiesSection.js';
import GroupsSection from './components/GroupsSection.js';
import SearchSection from './components/SearchSection.js';

import { documentService } from './services/documentService.js';
import { searchService } from './services/searchService.js';
import { exportService } from './services/exportService.js';
import './notification-service.js';

// expose services globally for legacy usage
window.documentService = documentService;
window.searchService = searchService;
window.exportService = exportService;

const app = createApp({
    components: {
        EntitiesSection,
        GroupsSection,
        SearchSection
    },
    template: `
        <div class="space-y-4">
            <entities-section></entities-section>
            <groups-section></groups-section>
            <search-section></search-section>
        </div>
    `
});

const pinia = createPinia();
app.use(pinia);

// initialize stores
const appStore = useAppStore();
const entityStore = useEntityStore();
const groupStore = useGroupStore();

const jobId = new URLSearchParams(window.location.search).get('job_id');
if (jobId) {
    appStore.setJobId(jobId);
    appStore.fetchStatus = 'loading';
    Promise.all([entityStore.fetch(jobId), groupStore.fetch(jobId)])
        .then(() => { appStore.fetchStatus = 'loaded'; })
        .catch(() => { appStore.fetchStatus = 'error'; });
}

app.mount('#app');

