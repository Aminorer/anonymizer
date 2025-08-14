(function() {
    'use strict';

    const { createApp, ref, onMounted, computed, watch } = Vue;
    const { createPinia, defineStore } = Pinia;

    const AppConfig = {
        ENABLE_AUTO_NOTIFICATIONS: false,
        ALLOWED_AUTO_NOTIFICATIONS: [],
        TOAST_CONFIG: {
            DURATION: 5000,
            AUTO_HIDE: true,
            POSITION: 'top-right'
        }
    };
    window.AppConfig = AppConfig;

    const CONFIG = {
        MAX_HISTORY_SIZE: 50,
        TOAST_DURATION: 5000,
        SEARCH_DEBOUNCE: 300,
        AUTO_SAVE_INTERVAL: 30000,
        ZOOM_STEP: 0.1,
        MIN_ZOOM: 0.3,
        MAX_ZOOM: 3.0
    };

    const utils = {
        debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        },
        throttle(func, limit) {
            let inThrottle = false;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => { inThrottle = false; }, limit);
                }
            };
        },
        generateId() {
            return 'id_' + Math.random().toString(36).substr(2, 9);
        },
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        sanitizeText(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        isValidRegex(pattern) {
            try { new RegExp(pattern); return true; } catch { return false; }
        },
        escapeForRegex(text) {
            return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    };

    const notificationSystem = {
        container: null,
        init() {
            this.container = document.getElementById('toast-container');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.className = 'fixed top-4 right-4 space-y-2 z-50';
                document.body.appendChild(this.container);
            }
        },
        show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
            console.log(`[${type.toUpperCase()}] ${message}`);
        },
        createToast(message, type) {
            const iconMap = {
                success: 'fa-check-circle text-green-600',
                error: 'fa-exclamation-triangle text-red-600',
                warning: 'fa-exclamation-triangle text-yellow-600',
                info: 'fa-info-circle text-blue-600'
            };
            const bgMap = {
                success: 'bg-green-50 border-green-200',
                error: 'bg-red-50 border-red-200',
                warning: 'bg-yellow-50 border-yellow-200',
                info: 'bg-blue-50 border-blue-200'
            };
            const toast = document.createElement('div');
            toast.className = `toast p-4 rounded-lg border ${bgMap[type]} shadow-lg max-w-sm transform translate-x-full opacity-0 transition-all duration-300`;
            toast.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${iconMap[type]} mr-3"></i>
                    <span class="text-gray-800 flex-1">${utils.sanitizeText(message)}</span>
                    <button class="ml-3 text-gray-500 hover:text-gray-700 focus:outline-none" onclick="notificationSystem.remove(this.closest('.toast'))">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            return toast;
        },
        remove(toast) {
            if (!toast || !toast.parentNode) return;
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        },
        success(message) { 
            console.log(`[SUCCESS] ${message}`); 
        },
        error(message) { 
            console.log(`[ERROR] ${message}`); 
        },
        warning(message) { 
            console.log(`[WARNING] ${message}`); 
        },
        info(message) { 
            console.log(`[INFO] ${message}`); 
        }
    };

    const useEntityStore = defineStore('entities', {
        state: () => ({
            items: [],
            loading: false,
            error: null
        }),
        getters: {
            totalCount: (state) => state.items.length,
            selectedCount: (state) => state.items.filter(item => item.selected).length,
            byType: (state) => state.items.reduce((acc, item) => {
                if (!acc[item.type]) acc[item.type] = [];
                acc[item.type].push(item);
                return acc;
            }, {}),
            highConfidenceItems: (state) => state.items.filter(item => item.confidence && item.confidence >= 0.8)
        },
        actions: {
            async fetch(jobId) {
                this.loading = true;
                this.error = null;
                try {
                    const response = await fetch(`/entities/${jobId}`);
                    if (!response.ok) throw new Error('Failed to fetch entities');
                    const data = await response.json();
                    this.items = data.map(entity => ({
                        id: entity.id || utils.generateId(),
                        replacement: '',
                        page: null,
                        confidence: null,
                        selected: false,
                        ...entity
                    }));
                    console.log(`${this.items.length} entités chargées`);
                } catch (error) {
                    this.error = error.message;
                    console.log('Erreur lors du chargement des entités');
                    throw error;
                } finally {
                    this.loading = false;
                }
            },
            async add(jobId, entity) {
                try {
                    const response = await fetch(`/entities/${jobId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entity)
                    });
                    if (!response.ok) throw new Error('Failed to add entity');
                    const savedEntity = await response.json();
                    this.items.push({ selected: false, ...savedEntity });
                    console.log('Entité ajoutée avec succès');
                    return savedEntity;
                } catch {
                    console.log('Erreur lors de l\'ajout de l\'entité');
                    throw new Error('add failed');
                }
            },
            async update(jobId, entity) {
                try {
                    const response = await fetch(`/entities/${jobId}/${entity.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entity)
                    });
                    if (!response.ok) throw new Error('Failed to update entity');
                    const index = this.items.findIndex(item => item.id === entity.id);
                    if (index !== -1) this.items[index] = { ...this.items[index], ...entity };
                    return entity;
                } catch {
                    console.log('Erreur lors de la mise à jour');
                    throw new Error('update failed');
                }
            },
            async remove(jobId, entityId) {
                try {
                    const response = await fetch(`/entities/${jobId}/${entityId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Failed to delete entity');
                    this.items = this.items.filter(item => item.id !== entityId);
                    console.log('Entité supprimée');
                } catch {
                    console.log('Erreur lors de la suppression');
                    throw new Error('remove failed');
                }
            },
            async removeMultiple(jobId, entityIds) {
                await Promise.all(entityIds.map(id => this.remove(jobId, id)));
                console.log(`${entityIds.length} entités supprimées`);
            },
            selectAll() { this.items.forEach(item => item.selected = true); },
            selectNone() { this.items.forEach(item => item.selected = false); },
            selectByType(type) { this.items.forEach(item => { item.selected = item.type === type; }); },
            reorder(fromIndex, toIndex) {
                const item = this.items.splice(fromIndex, 1)[0];
                this.items.splice(toIndex, 0, item);
            },
            getSelected() { return this.items.filter(item => item.selected); }
        }
    });

    const useGroupStore = defineStore('groups', {
        state: () => ({
            items: [],
            loading: false,
            error: null
        }),
        getters: {
            totalCount: (state) => state.items.length,
            byName: (state) => state.items.reduce((acc, group) => { acc[group.name] = group; return acc; }, {})
        },
        actions: {
            async fetch(jobId) {
                this.loading = true;
                try {
                    const response = await fetch(`/groups/${jobId}`);
                    if (!response.ok) throw new Error('Failed to fetch groups');
                    this.items = await response.json();
                } catch (error) {
                    this.error = error.message;
                    console.log('Erreur lors du chargement des groupes');
                    throw error;
                } finally {
                    this.loading = false;
                }
            },
            async add(jobId, group) {
                try {
                    const response = await fetch(`/groups/${jobId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(group)
                    });
                    if (!response.ok) throw new Error('Failed to create group');
                    const savedGroup = await response.json();
                    this.items.push(savedGroup);
                    console.log('Groupe créé avec succès');
                    return savedGroup;
                } catch {
                    console.log('Erreur lors de la création du groupe');
                    throw new Error('group add failed');
                }
            },
            async remove(jobId, groupId) {
                try {
                    const response = await fetch(`/groups/${jobId}/${groupId}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Failed to delete group');
                    this.items = this.items.filter(item => item.id !== groupId);
                    console.log('Groupe supprimé');
                } catch {
                    console.log('Erreur lors de la suppression du groupe');
                    throw new Error('group remove failed');
                }
            },
            async assignEntity(jobId, entityId, groupId) {
                try {
                    const response = await fetch(`/groups/${jobId}/${groupId}/entities/${entityId}`, { method: 'POST' });
                    if (!response.ok) throw new Error('Failed to assign entity');
                    const updatedGroup = await response.json();
                    const index = this.items.findIndex(item => item.id === groupId);
                    if (index !== -1) this.items[index] = updatedGroup;
                    console.log('Entité assignée au groupe');
                    return updatedGroup;
                } catch {
                    console.log('Erreur lors de l\'assignation');
                    throw new Error('assign failed');
                }
            }
        }
    });

    const useAppStore = defineStore('app', {
        state: () => ({
            jobId: null,
            status: null,
            processingMode: 'regex',
            currentView: 'anonymized',
            zoom: 1.0,
            currentPage: 1,
            totalPages: 1,
            docType: '',
            loading: false,
            history: [],
            future: [],
            searchTerm: '',
            searchResults: [],
            searchHistory: []
        }),
        getters: {
            canUndo: (state) => state.history.length > 0,
            canRedo: (state) => state.future.length > 0,
            isProcessing: (state) => state.loading,
            documentUrl: (state) => {
                if (!state.status) return null;
                if (state.currentView === 'original') return state.status.original_url;
                return state.status.anonymized_url || state.status.original_url;
            }
        },
        actions: {
            setJobId(jobId) { this.jobId = jobId; },
            setStatus(status) {
                this.status = status;
                if (status && status.filename) this.docType = status.filename.split('.').pop().toLowerCase();
            },
            saveState(entityStore, groupStore) {
                const state = {
                    entities: JSON.parse(JSON.stringify(entityStore.items)),
                    groups: JSON.parse(JSON.stringify(groupStore.items)),
                    timestamp: Date.now()
                };
                this.history.push(state);
                this.future = [];
                if (this.history.length > CONFIG.MAX_HISTORY_SIZE) this.history.shift();
            },
            undo(entityStore, groupStore) {
                if (this.history.length === 0) return false;
                const currentState = {
                    entities: JSON.parse(JSON.stringify(entityStore.items)),
                    groups: JSON.parse(JSON.stringify(groupStore.items)),
                    timestamp: Date.now()
                };
                this.future.push(currentState);
                const previousState = this.history.pop();
                entityStore.items = previousState.entities;
                groupStore.items = previousState.groups;
                console.log('Action annulée');
                return true;
            },
            redo(entityStore, groupStore) {
                if (this.future.length === 0) return false;
                const currentState = {
                    entities: JSON.parse(JSON.stringify(entityStore.items)),
                    groups: JSON.parse(JSON.stringify(groupStore.items)),
                    timestamp: Date.now()
                };
                this.history.push(currentState);
                const nextState = this.future.pop();
                entityStore.items = nextState.entities;
                groupStore.items = nextState.groups;
                console.log('Action rétablie');
                return true;
            },
            changeView(view) { this.currentView = view; },
            setZoom(zoom) { this.zoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, zoom)); },
            zoomIn() { this.setZoom(this.zoom + CONFIG.ZOOM_STEP); },
            zoomOut() { this.setZoom(this.zoom - CONFIG.ZOOM_STEP); },
            setPage(page) { this.currentPage = Math.max(1, Math.min(this.totalPages, page)); },
            nextPage() { this.setPage(this.currentPage + 1); },
            prevPage() { this.setPage(this.currentPage - 1); },
            addToSearchHistory(term) {
                if (!this.searchHistory.includes(term)) {
                    this.searchHistory.unshift(term);
                    if (this.searchHistory.length > 10) this.searchHistory.pop();
                }
            }
        }
    });

    const documentRenderer = {
        container: null,
        init(containerId) { this.container = document.getElementById(containerId); },
        clear() { if (this.container) this.container.innerHTML = ''; },
        async renderPDF(url, zoom = 1) {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                this.clear();
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: zoom * 1.5 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.className = 'block mx-auto mb-4 shadow-lg rounded';
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'pdf-page relative';
                    pageDiv.dataset.page = i;
                    pageDiv.appendChild(canvas);
                    this.container.appendChild(pageDiv);
                    await page.render({ canvasContext: ctx, viewport }).promise;
                }
                return pdf.numPages;
            } catch {
                console.log('Erreur lors du rendu du PDF');
                throw new Error('pdf render failed');
            }
        },
        async renderDOCX(url) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                this.clear();
                await docx.renderAsync(arrayBuffer, this.container, null, {
                    className: 'docx-wrapper',
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    experimental: true,
                    trimXmlDeclaration: true,
                    useBase64URL: false,
                    useMathMLPolyfill: true,
                    showChanges: false,
                    debug: false
                });
                return 1;
            } catch {
                console.log('Erreur lors du rendu du DOCX');
                throw new Error('docx render failed');
            }
        }
    };

    function initializeApp() {
        const jobId = new URLSearchParams(window.location.search).get('job_id');
        if (!jobId) { window.location.href = '/'; return; }
        notificationSystem.init();
        documentRenderer.init('viewer');
        
        const pinia = createPinia();
        const app = createApp({
            setup() {
                const appStore = useAppStore();
                const entityStore = useEntityStore();
                const groupStore = useGroupStore();
                const showModal = ref(false);
                
                const loadData = async () => {
                    try {
                        appStore.loading = true;
                        appStore.setJobId(jobId);
                        const statusResponse = await fetch(`/status/${jobId}`);
                        if (!statusResponse.ok) throw new Error('Job not found');
                        const statusData = await statusResponse.json();
                        appStore.setStatus(statusData.result);
                        appStore.processingMode = statusData.mode || 'regex';
                        await Promise.all([entityStore.fetch(jobId), groupStore.fetch(jobId)]);
                        console.log('Document chargé avec succès');
                    } catch {
                        console.log('Erreur lors du chargement');
                        setTimeout(() => { window.location.href = '/'; }, 3000);
                    } finally {
                        appStore.loading = false;
                    }
                };

                onMounted(() => {
                    loadData();
                });

                return {
                    appStore,
                    entityStore,
                    groupStore,
                    showModal
                };
            }
        });

        app.use(pinia);
        app.mount('#app');
        return app;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }
})();
