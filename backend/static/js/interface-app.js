/**
 * Interface d'anonymisation - Application Vue.js optimisée
 * Version Expert sans popups automatiques
 */

(function() {
    'use strict';

    const { createApp, ref, computed, onMounted, watch } = Vue;
    const { createPinia, defineStore } = Pinia;

    // ============================================================================
    // CONFIGURATION
    // ============================================================================
    
    const CONFIG = {
        ZOOM_MIN: 0.3,
        ZOOM_MAX: 3.0,
        ZOOM_STEP: 0.1,
        TOAST_DURATION: 5000,
        SEARCH_DEBOUNCE: 300,
        MAX_SEARCH_RESULTS: 50
    };

    const ENTITY_TYPES = [
        { value: 'PERSON', label: 'Personne' },
        { value: 'ORG', label: 'Organisation' },
        { value: 'LOC', label: 'Localisation' },
        { value: 'EMAIL', label: 'Email' },
        { value: 'PHONE', label: 'Téléphone' },
        { value: 'DATE', label: 'Date' },
        { value: 'ADDRESS', label: 'Adresse' },
        { value: 'IBAN', label: 'IBAN' },
        { value: 'SIREN', label: 'SIREN' },
        { value: 'SIRET', label: 'SIRET' }
    ];

    const ENTITY_TYPE_CLASSES = {
        EMAIL: 'bg-blue-100 text-blue-800',
        PHONE: 'bg-green-100 text-green-800',
        DATE: 'bg-purple-100 text-purple-800',
        ADDRESS: 'bg-red-100 text-red-800',
        PERSON: 'bg-indigo-100 text-indigo-800',
        ORG: 'bg-yellow-100 text-yellow-800',
        LOC: 'bg-pink-100 text-pink-800',
        IBAN: 'bg-gray-100 text-gray-800',
        SIREN: 'bg-orange-100 text-orange-800',
        SIRET: 'bg-teal-100 text-teal-800'
    };

    // ============================================================================
    // UTILITAIRES
    // ============================================================================
    
    const utils = {
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        generateId() {
            return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        },

        sanitizeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },

        formatPercent(value) {
            return (value * 100).toFixed(2) + '%';
        }
    };

    // ============================================================================
    // SYSTÈME DE NOTIFICATIONS
    // ============================================================================
    
    const toastService = {
        show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = this.createToast(message, type);
            container.appendChild(toast);

            requestAnimationFrame(() => {
                toast.classList.add('animate-slide-in');
            });

            setTimeout(() => {
                this.remove(toast);
            }, duration);
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
                    <span class="text-gray-800">${utils.sanitizeHtml(message)}</span>
                    <button onclick="toastService.remove(this.closest('.toast'))" class="ml-3 text-gray-500 hover:text-gray-700 focus:outline-none">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            return toast;
        },

        remove(toast) {
            if (!toast || !toast.parentNode) return;
            
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        },

        success(message) { this.show(message, 'success'); },
        error(message) { this.show(message, 'error'); },
        warning(message) { this.show(message, 'warning'); },
        info(message) { this.show(message, 'info'); }
    };

    // Exposer globalement pour les boutons HTML
    window.toastService = toastService;

    // ============================================================================
    // STORES PINIA
    // ============================================================================

    const useEntityStore = defineStore('entities', {
        state: () => ({
            items: [],
            loading: false,
            error: null
        }),

        getters: {
            totalCount: (state) => state.items.length,
            byType: (state) => {
                return state.items.reduce((acc, item) => {
                    if (!acc[item.type]) acc[item.type] = [];
                    acc[item.type].push(item);
                    return acc;
                }, {});
            }
        },

        actions: {
            async fetch(jobId) {
                this.loading = true;
                this.error = null;
                try {
                    const response = await fetch(`/entities/${jobId}`);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    const data = await response.json();
                    this.items = data.map(entity => ({
                        replacement: '',
                        page: null,
                        confidence: null,
                        selected: false,
                        ...entity
                    }));
                    toastService.success(`${this.items.length} entités chargées`);
                } catch (error) {
                    this.error = error.message;
                    toastService.error('Erreur lors du chargement des entités');
                    console.error('Entity fetch error:', error);
                } finally {
                    this.loading = false;
                }
            },

            async add(jobId, entity) {
                try {
                    const response = await fetch(`/entities/${jobId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: entity.id || utils.generateId(),
                            ...entity
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const savedEntity = await response.json();
                    this.items.push({ selected: false, ...savedEntity });
                    toastService.success('Entité ajoutée avec succès');
                    return savedEntity;
                } catch (error) {
                    toastService.error('Erreur lors de l\'ajout de l\'entité');
                    console.error('Entity add error:', error);
                    throw error;
                }
            },

            async update(jobId, entity) {
                try {
                    const response = await fetch(`/entities/${jobId}/${entity.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entity)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const index = this.items.findIndex(item => item.id === entity.id);
                    if (index !== -1) {
                        this.items[index] = { ...this.items[index], ...entity };
                    }

                    return entity;
                } catch (error) {
                    toastService.error('Erreur lors de la mise à jour');
                    console.error('Entity update error:', error);
                    throw error;
                }
            },

            async remove(jobId, entityId) {
                try {
                    const response = await fetch(`/entities/${jobId}/${entityId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    this.items = this.items.filter(item => item.id !== entityId);
                    toastService.success('Entité supprimée');
                } catch (error) {
                    toastService.error('Erreur lors de la suppression');
                    console.error('Entity remove error:', error);
                    throw error;
                }
            },

            async removeMultiple(jobId, entityIds) {
                const promises = entityIds.map(id => this.remove(jobId, id));
                try {
                    await Promise.all(promises);
                    toastService.success(`${entityIds.length} entités supprimées`);
                } catch (error) {
                    console.error('Multiple entity remove error:', error);
                }
            },

            selectAll() {
                this.items.forEach(item => item.selected = true);
            },

            selectNone() {
                this.items.forEach(item => item.selected = false);
            },

            toggleSelection(entityId) {
                const entity = this.items.find(item => item.id === entityId);
                if (entity) {
                    entity.selected = !entity.selected;
                }
            },

            getSelected() {
                return this.items.filter(item => item.selected);
            }
        }
    });

    const useGroupStore = defineStore('groups', {
        state: () => ({
            items: [],
            loading: false,
            error: null
        }),

        getters: {
            totalCount: (state) => state.items.length
        },

        actions: {
            async fetch(jobId) {
                this.loading = true;
                this.error = null;
                try {
                    const response = await fetch(`/groups/${jobId}`);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    this.items = await response.json();
                } catch (error) {
                    this.error = error.message;
                    toastService.error('Erreur lors du chargement des groupes');
                    console.error('Groups fetch error:', error);
                } finally {
                    this.loading = false;
                }
            },

            async add(jobId, group) {
                try {
                    const response = await fetch(`/groups/${jobId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: group.id || utils.generateId(),
                            entities: [],
                            ...group
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const savedGroup = await response.json();
                    this.items.push(savedGroup);
                    toastService.success('Groupe créé avec succès');
                    return savedGroup;
                } catch (error) {
                    toastService.error('Erreur lors de la création du groupe');
                    console.error('Group add error:', error);
                    throw error;
                }
            },

            async remove(jobId, groupId) {
                try {
                    const response = await fetch(`/groups/${jobId}/${groupId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    this.items = this.items.filter(item => item.id !== groupId);
                    toastService.success('Groupe supprimé');
                } catch (error) {
                    toastService.error('Erreur lors de la suppression du groupe');
                    console.error('Group remove error:', error);
                    throw error;
                }
            },

            async assignEntity(jobId, entityId, groupId) {
                try {
                    const response = await fetch(`/groups/${jobId}/${groupId}/entities/${entityId}`, {
                        method: 'POST'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const updatedGroup = await response.json();
                    const index = this.items.findIndex(item => item.id === groupId);
                    if (index !== -1) {
                        this.items[index] = updatedGroup;
                    }

                    toastService.success('Entité assignée au groupe');
                    return updatedGroup;
                } catch (error) {
                    toastService.error('Erreur lors de l\'assignation');
                    console.error('Group assign error:', error);
                    throw error;
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
            searchTerm: '',
            searchResults: [],
            searchType: 'text'
        }),

        getters: {
            documentUrl: (state) => {
                if (!state.status) return null;
                return state.currentView === 'original' 
                    ? state.status.original_url 
                    : (state.status.anonymized_url || state.status.original_url);
            },
            
            canZoomIn: (state) => state.zoom < CONFIG.ZOOM_MAX,
            canZoomOut: (state) => state.zoom > CONFIG.ZOOM_MIN
        },

        actions: {
            setJobId(jobId) {
                this.jobId = jobId;
            },

            setStatus(status) {
                this.status = status;
                if (status && status.filename) {
                    this.docType = status.filename.split('.').pop().toLowerCase();
                }
            },

            setZoom(zoom) {
                this.zoom = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, zoom));
            },

            zoomIn() {
                if (this.canZoomIn) {
                    this.setZoom(this.zoom + CONFIG.ZOOM_STEP);
                }
            },

            zoomOut() {
                if (this.canZoomOut) {
                    this.setZoom(this.zoom - CONFIG.ZOOM_STEP);
                }
            },

            setPage(page) {
                this.currentPage = Math.max(1, Math.min(this.totalPages, page));
            },

            nextPage() {
                if (this.currentPage < this.totalPages) {
                    this.setPage(this.currentPage + 1);
                }
            },

            prevPage() {
                if (this.currentPage > 1) {
                    this.setPage(this.currentPage - 1);
                }
            },

            changeView(view) {
                this.currentView = view;
            }
        }
    });

    // ============================================================================
    // SERVICES
    // ============================================================================

    const documentService = {
        async renderPDF(url, zoom, container) {
            try {
                if (!window.pdfjsLib) {
                    throw new Error('PDF.js not loaded');
                }

                pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;

                container.innerHTML = '';

                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: zoom * 1.5 });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.className = 'block mx-auto shadow-lg rounded';

                container.appendChild(canvas);
                await page.render({ canvasContext: ctx, viewport }).promise;

                return pdf.numPages;
            } catch (error) {
                console.error('PDF render error:', error);
                toastService.error('Erreur lors du rendu du PDF');
                throw error;
            }
        },

        async renderDOCX(url, container) {
            try {
                if (!window.docx) {
                    throw new Error('docx-preview not loaded');
                }

                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();

                container.innerHTML = '';

                await docx.renderAsync(arrayBuffer, container, null, {
                    className: 'docx-wrapper',
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    experimental: true,
                    trimXmlDeclaration: true
                });

                return 1;
            } catch (error) {
                console.error('DOCX render error:', error);
                toastService.error('Erreur lors du rendu du DOCX');
                throw error;
            }
        }
    };

    const searchService = {
        async performSemanticSearch(jobId, term) {
            try {
                const response = await fetch(`/semantic-search/${jobId}?q=${encodeURIComponent(term)}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return data.matches.map(match => ({ text: match, page: null }));
            } catch (error) {
                console.error('Semantic search error:', error);
                throw error;
            }
        },

        performTextSearch(term, container, isRegex = false) {
            const text = container.textContent || '';
            const regex = isRegex 
                ? new RegExp(term, 'gi')
                : new RegExp(utils.escapeRegex(term), 'gi');

            const matches = [];
            let match;

            while ((match = regex.exec(text)) !== null && matches.length < CONFIG.MAX_SEARCH_RESULTS) {
                matches.push({
                    text: match[0],
                    page: null,
                    start: match.index,
                    end: match.index + match[0].length
                });
                
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }
            }

            return matches;
        }
    };

    const exportService = {
        async exportDocument(jobId, options = {}) {
            try {
                const response = await fetch(`/export/${jobId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        watermark: options.watermark || '',
                        audit: options.audit || false
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.download_url) {
                    window.location.href = data.download_url;
                    toastService.success('Document exporté avec succès');
                }

                if (data.audit_url) {
                    window.open(data.audit_url, '_blank');
                }

                return data;
            } catch (error) {
                console.error('Export error:', error);
                toastService.error('Erreur lors de l\'export');
                throw error;
            }
        }
    };

    // ============================================================================
    // APPLICATION VUE.JS PRINCIPALE
    // ============================================================================

    function createApplication() {
        const jobId = new URLSearchParams(window.location.search).get('job_id');
        if (!jobId) {
            toastService.error('Job ID manquant');
            setTimeout(() => { window.location.href = '/'; }, 2000);
            return;
        }

        const pinia = createPinia();

        const app = createApp({
            setup() {
                // ================================================================
                // STORES
                // ================================================================
                const appStore = useAppStore();
                const entityStore = useEntityStore();
                const groupStore = useGroupStore();

                // ================================================================
                // REACTIVE STATE - AUCUN POPUP OUVERT PAR DÉFAUT
                // ================================================================
                const activeTab = ref('entities');
                const selectedEntities = ref([]);
                const draggedIndex = ref(null);
                const bulkGroupId = ref('');

                // Modals - TOUS À FALSE PAR DÉFAUT
                const showDetectionModal = ref(false);
                const showGroupModal = ref(false);
                const showExportModal = ref(false);

                // Forms
                const newDetection = ref({
                    type: '',
                    value: '',
                    replacement: '',
                    page: null
                });

                const newGroupName = ref('');

                const exportOptions = ref({
                    watermark: '',
                    audit: false
                });

                // ================================================================
                // COMPUTED PROPERTIES
                // ================================================================
                const entities = computed(() => entityStore.items);
                const groups = computed(() => groupStore.items);
                const status = computed(() => appStore.status);
                const processingMode = computed(() => appStore.processingMode);
                const view = computed(() => appStore.currentView);
                const zoom = computed(() => appStore.zoom);
                const currentPage = computed(() => appStore.currentPage);
                const totalPages = computed(() => appStore.totalPages);
                const searchTerm = computed({
                    get: () => appStore.searchTerm,
                    set: (value) => appStore.searchTerm = value
                });
                const searchType = computed({
                    get: () => appStore.searchType,
                    set: (value) => appStore.searchType = value
                });
                const searchResults = computed(() => appStore.searchResults);

                // UI Computed
                const canUndo = computed(() => false); // TODO: Implement history
                const canRedo = computed(() => false); // TODO: Implement history

                const allEntitiesSelected = computed(() => {
                    return entities.value.length > 0 && 
                           selectedEntities.value.length === entities.value.length;
                });

                const entitiesCount = computed(() => entities.value.length);

                const zoomPercentage = computed(() => `${Math.round(zoom.value * 100)}%`);

                const pageInfo = computed(() => `Page ${currentPage.value} / ${totalPages.value}`);

                const selectionInfo = computed(() => {
                    return selectedEntities.value.length > 0 
                        ? `${selectedEntities.value.length} sélectionnée(s)`
                        : `${entitiesCount.value} entité(s)`;
                });

                const viewerStyle = computed(() => ({
                    transform: `scale(${zoom.value})`,
                    transformOrigin: 'top center'
                }));

                const canConfirmDetection = computed(() => {
                    return newDetection.value.type && newDetection.value.value;
                });

                // Compter les entités par type pour l'aperçu
                const entityTypeCounts = computed(() => {
                    return entities.value.reduce((acc, entity) => {
                        acc[entity.type] = (acc[entity.type] || 0) + 1;
                        return acc;
                    }, {});
                });

                // ================================================================
                // TABS CONFIGURATION
                // ================================================================
                const tabs = computed(() => [
                    { id: 'entities', label: 'Entités', icon: 'fas fa-tags' },
                    { id: 'groups', label: 'Groupes', icon: 'fas fa-layer-group' },
                    { id: 'search', label: 'Recherche', icon: 'fas fa-search' },
                    { id: 'rules', label: 'Règles', icon: 'fas fa-cog' }
                ]);

                const entityTypes = computed(() => ENTITY_TYPES);

                // ================================================================
                // METHODS - CSS Classes
                // ================================================================
                const viewButtonClass = (viewName) => {
                    return [
                        'px-4 py-2 rounded-md transition-all',
                        view.value === viewName 
                            ? 'bg-white shadow-sm text-gray-900' 
                            : 'text-gray-600 hover:text-gray-900'
                    ];
                };

                const tabButtonClass = (tabName) => {
                    return [
                        'tab-button flex-1 py-3 px-4 text-sm font-medium',
                        activeTab.value === tabName 
                            ? 'active' 
                            : 'text-gray-600 hover:text-gray-900'
                    ];
                };

                const entityRowClass = (entity) => {
                    return [
                        'entity-row p-3 border border-gray-200 rounded-lg cursor-pointer',
                        isEntitySelected(entity.id) ? 'selected' : ''
                    ];
                };

                const entityTypeClass = (type) => {
                    return [
                        'px-2 py-1 text-xs rounded-full font-medium',
                        ENTITY_TYPE_CLASSES[type] || 'bg-gray-100 text-gray-800'
                    ];
                };

                const confidenceClass = (confidence) => {
                    if (confidence >= 0.8) return 'text-green-600';
                    if (confidence >= 0.5) return 'text-yellow-600';
                    return 'text-red-600';
                };

                // ================================================================
                // METHODS - Entity Management
                // ================================================================
                const isEntitySelected = (entityId) => {
                    return selectedEntities.value.includes(entityId);
                };

                const toggleEntitySelection = (entityId) => {
                    const index = selectedEntities.value.indexOf(entityId);
                    if (index > -1) {
                        selectedEntities.value.splice(index, 1);
                    } else {
                        selectedEntities.value.push(entityId);
                    }
                };

                const toggleAllEntities = () => {
                    if (allEntitiesSelected.value) {
                        selectedEntities.value = [];
                    } else {
                        selectedEntities.value = entities.value.map(e => e.id);
                    }
                };

                const updateEntity = async (entity) => {
                    try {
                        await entityStore.update(jobId, entity);
                    } catch (error) {
                        console.error('Update entity error:', error);
                    }
                };

                const deleteSelected = async () => {
                    if (selectedEntities.value.length === 0) return;

                    try {
                        await entityStore.removeMultiple(jobId, selectedEntities.value);
                        selectedEntities.value = [];
                    } catch (error) {
                        console.error('Delete selected error:', error);
                    }
                };

                const assignSelectedToGroup = async () => {
                    if (!bulkGroupId.value || selectedEntities.value.length === 0) return;

                    try {
                        for (const entityId of selectedEntities.value) {
                            await groupStore.assignEntity(jobId, entityId, bulkGroupId.value);
                        }
                        selectedEntities.value = [];
                        bulkGroupId.value = '';
                    } catch (error) {
                        console.error('Assign selected error:', error);
                    }
                };

                // ================================================================
                // METHODS - Group Management
                // ================================================================
                const deleteGroup = async (groupId) => {
                    try {
                        await groupStore.remove(jobId, groupId);
                    } catch (error) {
                        console.error('Delete group error:', error);
                    }
                };

                const groupEntityCount = (group) => {
                    return group.entities ? group.entities.length : 0;
                };

                const groupHasEntities = (group) => {
                    return group.entities && group.entities.length > 0;
                };

                const getEntityById = (entityId) => {
                    return entities.value.find(e => e.id === entityId);
                };

                // ================================================================
                // METHODS - Document Rendering
                // ================================================================
                const renderDocument = async () => {
                    if (!status.value) return;

                    const container = document.getElementById('viewer');
                    if (!container) return;

                    try {
                        const url = appStore.documentUrl;
                        if (!url) return;

                        if (appStore.docType === 'pdf') {
                            const totalPages = await documentService.renderPDF(url, zoom.value, container);
                            appStore.totalPages = totalPages;
                        } else if (appStore.docType === 'docx') {
                            await documentService.renderDOCX(url, container);
                            appStore.totalPages = 1;
                        }
                    } catch (error) {
                        console.error('Render document error:', error);
                    }
                };

                // ================================================================
                // METHODS - View Actions
                // ================================================================
                const changeView = async (newView) => {
                    appStore.changeView(newView);
                    await renderDocument();
                };

                const zoomIn = () => {
                    appStore.zoomIn();
                    if (appStore.docType === 'pdf') {
                        renderDocument();
                    }
                };

                const zoomOut = () => {
                    appStore.zoomOut();
                    if (appStore.docType === 'pdf') {
                        renderDocument();
                    }
                };

                const nextPage = () => {
                    appStore.nextPage();
                    if (appStore.docType === 'pdf') {
                        renderDocument();
                    }
                };

                const prevPage = () => {
                    appStore.prevPage();
                    if (appStore.docType === 'pdf') {
                        renderDocument();
                    }
                };

                // ================================================================
                // METHODS - Search
                // ================================================================
                const performSearch = utils.debounce(async () => {
                    if (!appStore.searchTerm) {
                        appStore.searchResults = [];
                        return;
                    }

                    try {
                        let results = [];

                        if (appStore.searchType === 'semantic') {
                            results = await searchService.performSemanticSearch(jobId, appStore.searchTerm);
                        } else {
                            const container = document.getElementById('viewer');
                            if (container) {
                                results = searchService.performTextSearch(
                                    appStore.searchTerm, 
                                    container, 
                                    appStore.searchType === 'regex'
                                );
                            }
                        }

                        appStore.searchResults = results;
                        toastService.info(`${results.length} résultat(s) trouvé(s)`);
                    } catch (error) {
                        console.error('Search error:', error);
                        toastService.error('Erreur lors de la recherche');
                    }
                }, CONFIG.SEARCH_DEBOUNCE);

                const addSearchResultAsEntity = async (result) => {
                    try {
                        await entityStore.add(jobId, {
                            type: 'UNKNOWN',
                            value: result.text,
                            replacement: '',
                            page: result.page || currentPage.value,
                            start: result.start || 0,
                            end: result.end || 0
                        });
                    } catch (error) {
                        console.error('Add search result error:', error);
                    }
                };

                // ================================================================
                // METHODS - Modals (DÉCLENCHÉS UNIQUEMENT PAR BOUTONS)
                // ================================================================
                const confirmDetection = async () => {
                    if (!canConfirmDetection.value) return;

                    try {
                        await entityStore.add(jobId, {
                            type: newDetection.value.type,
                            value: newDetection.value.value,
                            replacement: newDetection.value.replacement || '',
                            page: newDetection.value.page || currentPage.value,
                            start: 0,
                            end: 0
                        });

                        closeDetectionModal();
                    } catch (error) {
                        console.error('Confirm detection error:', error);
                    }
                };

                const closeDetectionModal = () => {
                    showDetectionModal.value = false;
                    newDetection.value = { type: '', value: '', replacement: '', page: null };
                };

                const confirmGroup = async () => {
                    if (!newGroupName.value) return;

                    try {
                        await groupStore.add(jobId, {
                            name: newGroupName.value
                        });

                        closeGroupModal();
                    } catch (error) {
                        console.error('Confirm group error:', error);
                    }
                };

                const closeGroupModal = () => {
                    showGroupModal.value = false;
                    newGroupName.value = '';
                };

                // Export simple (bouton principal)
                const exportDocument = async () => {
                    try {
                        await exportService.exportDocument(jobId, {
                            watermark: '', // Pas de filigrane par défaut
                            audit: false   // Pas de rapport par défaut
                        });
                    } catch (error) {
                        console.error('Export document error:', error);
                    }
                };

                // Export avec options (via popup)
                const performExport = async () => {
                    try {
                        await exportService.exportDocument(jobId, exportOptions.value);
                        closeExportModal();
                    } catch (error) {
                        console.error('Perform export error:', error);
                    }
                };

                const closeExportModal = () => {
                    showExportModal.value = false;
                    // Réinitialiser les options à leurs valeurs par défaut
                    exportOptions.value = { 
                        watermark: '', 
                        audit: false 
                    };
                };

                // ================================================================
                // METHODS - Drag & Drop
                // ================================================================
                const onDragStart = (index, event) => {
                    draggedIndex.value = index;
                    event.dataTransfer.setData('text/plain', entities.value[index].id);
                    event.dataTransfer.effectAllowed = 'move';
                };

                const onDrop = (index, event) => {
                    event.preventDefault();
                    
                    if (draggedIndex.value === null || draggedIndex.value === index) {
                        return;
                    }

                    // Reorder entities
                    const draggedItem = entities.value[draggedIndex.value];
                    entities.value.splice(draggedIndex.value, 1);
                    entities.value.splice(index, 0, draggedItem);

                    draggedIndex.value = null;
                };

                const onDropToGroup = async (groupId, event) => {
                    event.preventDefault();
                    
                    const entityId = event.dataTransfer.getData('text/plain');
                    if (entityId) {
                        try {
                            await groupStore.assignEntity(jobId, entityId, groupId);
                        } catch (error) {
                            console.error('Drop to group error:', error);
                        }
                    }
                };

                // ================================================================
                // METHODS - Utilities
                // ================================================================
                const entityPlaceholder = (type) => {
                    return type ? `[${type}]` : '[TYPE]';
                };

                const pageLabel = (page) => {
                    return page ? `Page ${page}` : 'Page ?';
                };

                const confidenceText = (confidence) => {
                    return confidence !== null && confidence !== undefined 
                        ? utils.formatPercent(confidence) 
                        : '';
                };

                const showConfidence = (entity) => {
                    return processingMode.value === 'ai' && 
                           entity.confidence !== null && 
                           entity.confidence !== undefined;
                };

                // ================================================================
                // METHODS - History (TODO)
                // ================================================================
                const undo = () => {
                    toastService.info('Fonction d\'annulation en cours de développement');
                };

                const redo = () => {
                    toastService.info('Fonction de rétablissement en cours de développement');
                };

                // ================================================================
                // METHODS - Text Selection (TODO)
                // ================================================================
                const onTextSelection = () => {
                    // TODO: Implement text selection handling for manual entity creation
                };

                // ================================================================
                // INITIALIZATION
                // ================================================================
                const loadJobStatus = async () => {
                    try {
                        appStore.loading = true;
                        appStore.setJobId(jobId);

                        const response = await fetch(`/status/${jobId}`);
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: Job not found`);
                        }

                        const data = await response.json();
                        
                        if (!data.result) {
                            throw new Error('Aucun résultat disponible');
                        }

                        appStore.setStatus(data.result);
                        appStore.processingMode = data.mode || 'regex';

                        // Load entities from result if available and store is empty
                        if (data.result.entities && entityStore.items.length === 0) {
                            entityStore.items = data.result.entities.map(e => ({
                                replacement: '',
                                page: null,
                                confidence: null,
                                selected: false,
                                ...e
                            }));
                        }

                        await renderDocument();
                        toastService.success('Document chargé avec succès');

                    } catch (error) {
                        console.error('Load job status error:', error);
                        toastService.error('Erreur lors du chargement du document');
                        
                        // Redirect to home after error
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 3000);
                    } finally {
                        appStore.loading = false;
                    }
                };

                // ================================================================
                // WATCHERS
                // ================================================================
                watch(() => appStore.currentView, async () => {
                    await renderDocument();
                });

                watch(() => appStore.searchTerm, () => {
                    if (appStore.searchTerm) {
                        performSearch();
                    } else {
                        appStore.searchResults = [];
                    }
                });

                // ================================================================
                // LIFECYCLE
                // ================================================================
                onMounted(async () => {
                    try {
                        await Promise.all([
                            loadJobStatus(),
                            entityStore.fetch(jobId),
                            groupStore.fetch(jobId)
                        ]);
                    } catch (error) {
                        console.error('App initialization error:', error);
                        toastService.error('Erreur lors de l\'initialisation');
                    }
                });

                // ================================================================
                // TEMPLATE DATA
                // ================================================================
                return {
                    // Stores
                    appStore,
                    entityStore,
                    groupStore,

                    // State
                    activeTab,
                    selectedEntities,
                    bulkGroupId,
                    draggedIndex,

                    // Modals - CONTRÔLÉS PAR BOUTONS UNIQUEMENT
                    showDetectionModal,
                    showGroupModal,
                    showExportModal,

                    // Forms
                    newDetection,
                    newGroupName,
                    exportOptions,

                    // Computed
                    entities,
                    groups,
                    status,
                    processingMode,
                    view,
                    zoom,
                    currentPage,
                    totalPages,
                    searchTerm,
                    searchType,
                    searchResults,
                    canUndo,
                    canRedo,
                    allEntitiesSelected,
                    entitiesCount,
                    zoomPercentage,
                    pageInfo,
                    selectionInfo,
                    viewerStyle,
                    canConfirmDetection,
                    tabs,
                    entityTypes,
                    entityTypeCounts,

                    // CSS Methods
                    viewButtonClass,
                    tabButtonClass,
                    entityRowClass,
                    entityTypeClass,
                    confidenceClass,

                    // Entity Methods
                    isEntitySelected,
                    toggleEntitySelection,
                    toggleAllEntities,
                    updateEntity,
                    deleteSelected,
                    assignSelectedToGroup,

                    // Group Methods
                    deleteGroup,
                    groupEntityCount,
                    groupHasEntities,
                    getEntityById,

                    // View Methods
                    changeView,
                    zoomIn,
                    zoomOut,
                    nextPage,
                    prevPage,

                    // Search Methods
                    performSearch,
                    addSearchResultAsEntity,

                    // Modal Methods - DÉCLENCHÉS PAR BOUTONS UNIQUEMENT
                    confirmDetection,
                    closeDetectionModal,
                    confirmGroup,
                    closeGroupModal,
                    exportDocument,      // Export simple
                    performExport,       // Export avec options
                    closeExportModal,

                    // Drag & Drop Methods
                    onDragStart,
                    onDrop,
                    onDropToGroup,

                    // Utility Methods
                    entityPlaceholder,
                    pageLabel,
                    confidenceText,
                    showConfidence,

                    // History Methods
                    undo,
                    redo,

                    // Selection Methods
                    onTextSelection
                };
            }
        });

        // Configuration Vue pour utiliser [[ ]] au lieu de {{ }}
        app.config.compilerOptions.delimiters = ['[[', ']]'];

        app.use(pinia);
        app.mount('#app');

        return app;
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createApplication);
    } else {
        createApplication();
    }

    // Exposer pour le debug (uniquement en développement)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.anonymizerApp = {
            toastService,
            utils,
            documentService,
            searchService,
            exportService
        };
    }

})();