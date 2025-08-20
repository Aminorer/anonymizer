/**
 * Interface d'anonymisation avancée - JavaScript
 * Gestion complète du viewer PDF, highlighting d'entités, et interactions
 */

(function() {
    'use strict';

    const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } = Vue;

    // Configuration globale
    const CONFIG = {
        MAX_ZOOM: 3.0,
        MIN_ZOOM: 0.3,
        ZOOM_STEP: 0.1,
        AUTO_SAVE_INTERVAL: 30000, // 30 secondes
        TOAST_DURATION: 5000,
        PDF_WORKER_URL: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    };

    // Configuration PDF.js
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.PDF_WORKER_URL;
    }

    // Utilitaires
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

        throttle(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        generateId() {
            return 'id_' + Math.random().toString(36).substr(2, 9);
        },

        formatTime(timestamp) {
            return new Date(timestamp).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        getEntityColor(type) {
            const colors = {
                EMAIL: '#3b82f6',
                PHONE: '#10b981',
                PERSON: '#8b5cf6',
                ORG: '#f59e0b',
                ADDRESS: '#ef4444',
                DATE: '#a855f7',
                LOC: '#22c55e',
                IBAN: '#9ca3af',
                SIREN: '#fbbf24',
                SIRET: '#0ea5e9'
            };
            return colors[type] || '#6b7280';
        }
    };

    // Gestionnaire PDF
    class PDFViewer {
        constructor() {
            this.pdf = null;
            this.pages = [];
            this.renderTasks = new Map();
        }

        async loadPDF(url) {
            try {
                const loadingTask = pdfjsLib.getDocument(url);
                this.pdf = await loadingTask.promise;
                
                this.pages = [];
                for (let i = 1; i <= this.pdf.numPages; i++) {
                    this.pages.push({
                        number: i,
                        rendered: false,
                        canvas: null,
                        page: null
                    });
                }
                
                return this.pdf.numPages;
            } catch (error) {
                console.error('Erreur lors du chargement du PDF:', error);
                throw error;
            }
        }

        async renderPage(pageNumber, canvas, zoom = 1.0) {
            if (!this.pdf || pageNumber < 1 || pageNumber > this.pdf.numPages) {
                return null;
            }

            // Annuler le rendu précédent s'il existe
            if (this.renderTasks.has(pageNumber)) {
                this.renderTasks.get(pageNumber).cancel();
            }

            try {
                const page = await this.pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale: zoom * 1.5 });
                
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                const renderTask = page.render(renderContext);
                this.renderTasks.set(pageNumber, renderTask);
                
                await renderTask.promise;
                this.renderTasks.delete(pageNumber);
                
                const pageInfo = this.pages.find(p => p.number === pageNumber);
                if (pageInfo) {
                    pageInfo.rendered = true;
                    pageInfo.canvas = canvas;
                    pageInfo.page = page;
                    pageInfo.viewport = viewport;
                }

                return { page, viewport };
            } catch (error) {
                if (error.name !== 'RenderingCancelledException') {
                    console.error(`Erreur lors du rendu de la page ${pageNumber}:`, error);
                }
                throw error;
            }
        }

        getPageInfo(pageNumber) {
            return this.pages.find(p => p.number === pageNumber);
        }

        cancelAllRendering() {
            this.renderTasks.forEach(task => task.cancel());
            this.renderTasks.clear();
        }

        destroy() {
            this.cancelAllRendering();
            this.pdf = null;
            this.pages = [];
        }
    }

    // Gestionnaire de notifications toast
    class ToastManager {
        constructor() {
            this.toasts = reactive([]);
            this.nextId = 1;
        }

        show(message, type = 'info', title = null, duration = CONFIG.TOAST_DURATION) {
            const toast = {
                id: this.nextId++,
                message,
                type,
                title,
                show: false
            };

            this.toasts.push(toast);

            // Animation d'entrée
            nextTick(() => {
                toast.show = true;
            });

            // Auto-dismiss
            if (duration > 0) {
                setTimeout(() => {
                    this.dismiss(toast.id);
                }, duration);
            }

            return toast.id;
        }

        dismiss(id) {
            const index = this.toasts.findIndex(t => t.id === id);
            if (index !== -1) {
                this.toasts[index].show = false;
                setTimeout(() => {
                    this.toasts.splice(index, 1);
                }, 300);
            }
        }

        clear() {
            this.toasts.forEach(toast => {
                toast.show = false;
            });
            setTimeout(() => {
                this.toasts.splice(0);
            }, 300);
        }

        success(message, title = 'Succès') {
            return this.show(message, 'success', title);
        }

        error(message, title = 'Erreur') {
            return this.show(message, 'error', title);
        }

        warning(message, title = 'Attention') {
            return this.show(message, 'warning', title);
        }

        info(message, title = null) {
            return this.show(message, 'info', title);
        }
    }

    // Application principale
    createApp({
        setup() {
            // ===== ÉTAT RÉACTIF =====
            
            // Navigation et UI
            const jobId = ref(new URLSearchParams(window.location.search).get('job_id'));
            const activeTab = ref('entities');
            const sidebarOpen = ref(false);
            const sidebarCollapsed = ref(false);
            const isMobile = ref(window.innerWidth < 768);

            // Document et viewer
            const isLoading = ref(true);
            const error = ref(null);
            const documentUrl = ref(null);
            const documentFilename = ref('');
            const currentView = ref('anonymized');
            const processingMode = ref('regex');
            
            // PDF et pages
            const pdfViewer = new PDFViewer();
            const pdfPages = ref([]);
            const currentPage = ref(1);
            const totalPages = ref(1);
            const zoom = ref(1.0);
            
            // Entités et groupes
            const entities = ref([]);
            const groups = ref([]);
            const selectedEntityId = ref(null);
            const highlightedEntityId = ref(null);
            const selectedEntities = ref([]);
            
            // Interface et modes
            const annotationMode = ref(false);
            const showEntities = ref(true);
            const searchTerm = ref('');
            const searchResults = ref([]);
            const activeFilters = ref([]);
            
            // Recherche avancée
            const advancedSearch = reactive({
                text: '',
                type: '',
                confidence: 0.5
            });
            
            // Modals
            const showAddEntityModal = ref(false);
            const showAddGroupModal = ref(false);
            const showExportModal = ref(false);
            const showRulesModal = ref(false);
            
            // Formulaires
            const newEntity = reactive({
                value: '',
                type: '',
                replacement: ''
            });
            
            const newGroup = reactive({
                name: '',
                description: ''
            });
            
            // Export et sauvegarde
            const exportOptions = reactive({
                watermark: false,
                audit: false
            });
            
            const exporting = ref(false);
            const autoSaving = ref(false);
            const lastSaved = ref(null);
            
            // Configuration
            const anonymizationMode = ref('replace');
            const presets = ref([
                {
                    id: 'low',
                    name: 'Anonymisation légère',
                    description: 'Supprime uniquement les emails et téléphones'
                },
                {
                    id: 'medium',
                    name: 'Anonymisation standard',
                    description: 'Supprime les données personnelles principales'
                },
                {
                    id: 'high',
                    name: 'Anonymisation complète',
                    description: 'Supprime toutes les données identifiantes'
                }
            ]);

            // Notifications
            const toastManager = new ToastManager();
            const toasts = toastManager.toasts;

            // ===== COMPUTED =====
            
            const tabs = computed(() => [
                { id: 'entities', label: 'Entités', icon: 'fas fa-tags' },
                { id: 'groups', label: 'Groupes', icon: 'fas fa-layer-group' },
                { id: 'search', label: 'Recherche', icon: 'fas fa-search' },
                { id: 'rules', label: 'Règles', icon: 'fas fa-cogs' }
            ]);

            const entityTypes = computed(() => [
                'EMAIL', 'PHONE', 'DATE', 'ADDRESS', 'PERSON', 'ORG', 'LOC', 
                'IBAN', 'SIREN', 'SIRET'
            ]);

            const uniqueEntityTypes = computed(() => {
                const types = new Set(entities.value.map(e => e.type));
                return Array.from(types).sort();
            });

            const filteredEntities = computed(() => {
                let filtered = entities.value;

                // Filtre par recherche textuelle
                if (searchTerm.value.trim()) {
                    const term = searchTerm.value.toLowerCase();
                    filtered = filtered.filter(e => 
                        e.value.toLowerCase().includes(term) ||
                        e.type.toLowerCase().includes(term)
                    );
                }

                // Filtre par types
                if (activeFilters.value.length > 0) {
                    filtered = filtered.filter(e => activeFilters.value.includes(e.type));
                }

                return filtered;
            });

            const canUndo = computed(() => {
                // TODO: Implémenter la logique d'historique
                return false;
            });

            const canRedo = computed(() => {
                // TODO: Implémenter la logique d'historique
                return false;
            });

            // ===== MÉTHODES =====

            // Gestion des toasts
            const showToast = (message, type = 'info', title = null) => {
                return toastManager.show(message, type, title);
            };

            const dismissToast = (id) => {
                toastManager.dismiss(id);
            };

            const getToastIcon = (type) => {
                const icons = {
                    success: 'fas fa-check-circle',
                    error: 'fas fa-exclamation-triangle',
                    warning: 'fas fa-exclamation-triangle',
                    info: 'fas fa-info-circle'
                };
                return icons[type] || 'fas fa-info-circle';
            };

            // Navigation et UI
            const toggleSidebar = () => {
                sidebarOpen.value = !sidebarOpen.value;
            };

            const closeSidebar = () => {
                sidebarOpen.value = false;
            };

            const collapseSidebar = () => {
                sidebarCollapsed.value = !sidebarCollapsed.value;
            };

            // Gestion des entités
            const selectEntity = (entity) => {
                selectedEntityId.value = entity.id;
                
                // Scroll vers l'entité dans le document
                if (entity.page && entity.page !== currentPage.value) {
                    currentPage.value = entity.page;
                }
                
                // Scroll vers l'entité dans la sidebar si nécessaire
                nextTick(() => {
                    const entityElement = document.querySelector(`[data-entity-id="${entity.id}"]`);
                    if (entityElement) {
                        entityElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            };

            const highlightEntity = (entity) => {
                if (highlightedEntityId.value !== entity.id) {
                    highlightedEntityId.value = entity.id;
                }
            };

            const unhighlightEntity = () => {
                highlightedEntityId.value = null;
            };

            const getEntityBadgeClass = (type) => {
                const baseClass = 'entity-badge';
                const colorMap = {
                    EMAIL: 'bg-blue-100 text-blue-800',
                    PHONE: 'bg-green-100 text-green-800',
                    PERSON: 'bg-purple-100 text-purple-800',
                    ORG: 'bg-yellow-100 text-yellow-800',
                    ADDRESS: 'bg-red-100 text-red-800',
                    DATE: 'bg-purple-100 text-purple-800',
                    LOC: 'bg-green-100 text-green-800',
                    IBAN: 'bg-gray-100 text-gray-800',
                    SIREN: 'bg-yellow-100 text-yellow-800',
                    SIRET: 'bg-blue-100 text-blue-800'
                };
                return `${baseClass} ${colorMap[type] || 'bg-gray-100 text-gray-800'}`;
            };

            const getEntityById = (id) => {
                return entities.value.find(e => e.id === id);
            };

            const getEntitiesForPage = (pageNumber) => {
                return entities.value.filter(e => e.page === pageNumber);
            };

            const getEntityStyle = (entity, currentZoom = 1.0) => {
                if (!entity.x || !entity.y || !entity.width || !entity.height) {
                    return { display: 'none' };
                }

                return {
                    left: `${entity.x * currentZoom}px`,
                    top: `${entity.y * currentZoom}px`,
                    width: `${entity.width * currentZoom}px`,
                    height: `${entity.height * currentZoom}px`,
                    zIndex: selectedEntityId.value === entity.id ? 1000 : 100
                };
            };

            // API calls
            const loadData = async () => {
                if (!jobId.value) {
                    error.value = 'Job ID manquant';
                    window.location.href = '/';
                    return;
                }

                try {
                    isLoading.value = true;
                    error.value = null;

                    // Charger le statut du job
                    const statusResponse = await fetch(`/status/${jobId.value}`);
                    if (!statusResponse.ok) throw new Error('Job introuvable');
                    
                    const statusData = await statusResponse.json();
                    
                    if (statusData.status !== 'completed') {
                        throw new Error('Job non terminé');
                    }

                    processingMode.value = statusData.mode || 'regex';
                    
                    if (statusData.result) {
                        documentFilename.value = statusData.result.filename || 'document.pdf';
                        await updateDocumentUrl();
                        
                        // Charger les entités depuis le résultat
                        if (statusData.result.entities) {
                            entities.value = statusData.result.entities.map(entity => ({
                                id: entity.id || utils.generateId(),
                                ...entity
                            }));
                        }
                    }

                    // Charger les entités depuis l'API
                    try {
                        const entitiesResponse = await fetch(`/entities/${jobId.value}`);
                        if (entitiesResponse.ok) {
                            const apiEntities = await entitiesResponse.json();
                            if (apiEntities.length > 0) {
                                entities.value = apiEntities;
                            }
                        }
                    } catch (entErr) {
                        console.warn('Impossible de charger les entités depuis l\'API:', entErr);
                    }

                    // Charger les groupes depuis l'API
                    try {
                        const groupsResponse = await fetch(`/groups/${jobId.value}`);
                        if (groupsResponse.ok) {
                            groups.value = await groupsResponse.json();
                        }
                    } catch (grpErr) {
                        console.warn('Impossible de charger les groupes depuis l\'API:', grpErr);
                    }

                    showToast('Document chargé avec succès', 'success');

                } catch (err) {
                    console.error('Erreur lors du chargement:', err);
                    error.value = err.message;
                    showToast('Erreur lors du chargement du document', 'error');
                } finally {
                    isLoading.value = false;
                }
            };

            const updateDocumentUrl = async () => {
                try {
                    const statusResponse = await fetch(`/status/${jobId.value}`);
                    const statusData = await statusResponse.json();
                    
                    if (statusData.result) {
                        const newUrl = currentView.value === 'original' 
                            ? statusData.result.original_url 
                            : statusData.result.anonymized_url;
                        
                        if (newUrl !== documentUrl.value) {
                            documentUrl.value = newUrl;
                            await loadDocument();
                        }
                    }
                } catch (err) {
                    console.error('Erreur lors de la mise à jour de l\'URL:', err);
                }
            };

            const loadDocument = async () => {
                if (!documentUrl.value) return;

                try {
                    // Déterminer le type de document
                    const isPDF = documentUrl.value.toLowerCase().includes('.pdf') || 
                                  documentFilename.value.toLowerCase().endsWith('.pdf');

                    if (isPDF) {
                        await loadPDFDocument();
                    } else {
                        // Pour les DOCX, on utilise une iframe améliorée
                        loadDOCXDocument();
                    }
                } catch (err) {
                    console.error('Erreur lors du chargement du document:', err);
                    error.value = 'Impossible de charger le document';
                }
            };

            const loadPDFDocument = async () => {
                try {
                    const numPages = await pdfViewer.loadPDF(documentUrl.value);
                    totalPages.value = numPages;
                    currentPage.value = 1;

                    // Initialiser les pages
                    pdfPages.value = Array.from({ length: numPages }, (_, i) => ({
                        number: i + 1,
                        rendered: false
                    }));

                    // Rendre la première page
                    await renderCurrentPage();
                    
                } catch (err) {
                    console.error('Erreur lors du chargement du PDF:', err);
                    throw err;
                }
            };

            const loadDOCXDocument = () => {
                // Pour les DOCX, on crée un iframe amélioré
                const container = document.getElementById('document-content');
                if (container) {
                    container.innerHTML = `
                        <div class="docx-container">
                            <iframe src="${documentUrl.value}" 
                                    style="width: 100%; height: 600px; border: none; border-radius: 8px;"
                                    onload="this.style.height = this.contentWindow.document.body.scrollHeight + 'px'">
                            </iframe>
                        </div>
                    `;
                }
                totalPages.value = 1;
                currentPage.value = 1;
            };

            const renderCurrentPage = async () => {
                await nextTick();
                
                const canvas = document.querySelector(`[ref="canvas-${currentPage.value}"]`);
                if (canvas && pdfViewer.pdf) {
                    try {
                        await pdfViewer.renderPage(currentPage.value, canvas, zoom.value);
                    } catch (err) {
                        console.error('Erreur lors du rendu de la page:', err);
                    }
                }
            };

            // Navigation de pages
            const nextPage = () => {
                if (currentPage.value < totalPages.value) {
                    currentPage.value++;
                }
            };

            const prevPage = () => {
                if (currentPage.value > 1) {
                    currentPage.value--;
                }
            };

            // Gestion du zoom
            const zoomIn = () => {
                if (zoom.value < CONFIG.MAX_ZOOM) {
                    zoom.value = Math.min(CONFIG.MAX_ZOOM, zoom.value + CONFIG.ZOOM_STEP);
                }
            };

            const zoomOut = () => {
                if (zoom.value > CONFIG.MIN_ZOOM) {
                    zoom.value = Math.max(CONFIG.MIN_ZOOM, zoom.value - CONFIG.ZOOM_STEP);
                }
            };

            const resetZoom = () => {
                zoom.value = 1.0;
            };

            // Modes et vues
            const changeView = async (view) => {
                if (view !== currentView.value) {
                    currentView.value = view;
                    await updateDocumentUrl();
                    showToast(`Affichage ${view === 'original' ? 'original' : 'anonymisé'}`, 'info');
                }
            };

            const toggleAnnotationMode = () => {
                annotationMode.value = !annotationMode.value;
                showToast(
                    `Mode annotation ${annotationMode.value ? 'activé' : 'désactivé'}`, 
                    'info'
                );
            };

            const toggleEntityVisibility = () => {
                showEntities.value = !showEntities.value;
                showToast(
                    `Entités ${showEntities.value ? 'affichées' : 'masquées'}`, 
                    'info'
                );
            };

            // Recherche et filtres
            const performSearch = utils.debounce(() => {
                // La recherche est déjà réactive via computed
            }, 300);

            const toggleFilter = (type) => {
                const index = activeFilters.value.indexOf(type);
                if (index > -1) {
                    activeFilters.value.splice(index, 1);
                } else {
                    activeFilters.value.push(type);
                }
            };

            const performAdvancedSearch = () => {
                let results = entities.value;

                if (advancedSearch.text.trim()) {
                    const term = advancedSearch.text.toLowerCase();
                    results = results.filter(e => 
                        e.value.toLowerCase().includes(term)
                    );
                }

                if (advancedSearch.type) {
                    results = results.filter(e => e.type === advancedSearch.type);
                }

                if (advancedSearch.confidence > 0) {
                    results = results.filter(e => 
                        e.confidence && e.confidence >= advancedSearch.confidence
                    );
                }

                searchResults.value = results;
                showToast(`${results.length} résultat(s) trouvé(s)`, 'info');
            };

            // Gestion des entités
            const addEntity = async () => {
                if (!newEntity.value || !newEntity.type) return;

                try {
                    const entityData = {
                        id: utils.generateId(),
                        value: newEntity.value,
                        type: newEntity.type,
                        start: 0,
                        end: newEntity.value.length,
                        replacement: newEntity.replacement || `[${newEntity.type}]`
                    };

                    const response = await fetch(`/entities/${jobId.value}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entityData)
                    });

                    if (response.ok) {
                        const savedEntity = await response.json();
                        entities.value.push(savedEntity);
                        
                        // Reset form
                        newEntity.value = '';
                        newEntity.type = '';
                        newEntity.replacement = '';
                        
                        showAddEntityModal.value = false;
                        showToast('Entité ajoutée avec succès', 'success');
                    } else {
                        throw new Error('Erreur lors de la sauvegarde');
                    }
                } catch (err) {
                    console.error('Erreur lors de l\'ajout de l\'entité:', err);
                    showToast('Erreur lors de l\'ajout de l\'entité', 'error');
                }
            };

            const editEntity = (entity) => {
                const newValue = prompt('Nouvelle valeur:', entity.value);
                if (newValue && newValue !== entity.value) {
                    updateEntity({ ...entity, value: newValue });
                }
            };

            const updateEntity = async (entity) => {
                try {
                    const response = await fetch(`/entities/${jobId.value}/${entity.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entity)
                    });

                    if (response.ok) {
                        const index = entities.value.findIndex(e => e.id === entity.id);
                        if (index !== -1) {
                            entities.value[index] = { ...entities.value[index], ...entity };
                        }
                        showToast('Entité mise à jour', 'success');
                    }
                } catch (err) {
                    console.error('Erreur lors de la mise à jour:', err);
                    showToast('Erreur lors de la mise à jour', 'error');
                }
            };

            const deleteEntity = async (entityId) => {
                if (!confirm('Supprimer cette entité ?')) return;

                try {
                    const response = await fetch(`/entities/${jobId.value}/${entityId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        entities.value = entities.value.filter(e => e.id !== entityId);
                        if (selectedEntityId.value === entityId) {
                            selectedEntityId.value = null;
                        }
                        showToast('Entité supprimée', 'success');
                    }
                } catch (err) {
                    console.error('Erreur lors de la suppression:', err);
                    showToast('Erreur lors de la suppression', 'error');
                }
            };

            const deleteSelectedEntities = async () => {
                if (!confirm(`Supprimer ${selectedEntities.value.length} entité(s) ?`)) return;

                try {
                    for (const entityId of selectedEntities.value) {
                        await deleteEntity(entityId);
                    }
                    selectedEntities.value = [];
                } catch (err) {
                    console.error('Erreur lors de la suppression multiple:', err);
                }
            };

            const groupSelectedEntities = () => {
                if (selectedEntities.value.length === 0) return;
                
                const groupName = prompt('Nom du groupe:');
                if (groupName) {
                    createGroupWithEntities(groupName, selectedEntities.value);
                }
            };

            const refreshEntities = () => {
                loadData();
                showToast('Entités actualisées', 'info');
            };

            // Gestion des groupes
            const addGroup = async () => {
                if (!newGroup.name) return;

                try {
                    const groupData = {
                        id: utils.generateId(),
                        name: newGroup.name,
                        description: newGroup.description,
                        entities: []
                    };

                    const response = await fetch(`/groups/${jobId.value}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(groupData)
                    });

                    if (response.ok) {
                        const savedGroup = await response.json();
                        groups.value.push(savedGroup);
                        
                        // Reset form
                        newGroup.name = '';
                        newGroup.description = '';
                        
                        showAddGroupModal.value = false;
                        showToast('Groupe créé avec succès', 'success');
                    }
                } catch (err) {
                    console.error('Erreur lors de la création du groupe:', err);
                    showToast('Erreur lors de la création du groupe', 'error');
                }
            };

            const editGroup = (group) => {
                const newName = prompt('Nouveau nom du groupe:', group.name);
                if (newName && newName !== group.name) {
                    updateGroup({ ...group, name: newName });
                }
            };

            const updateGroup = async (group) => {
                try {
                    const response = await fetch(`/groups/${jobId.value}/${group.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(group)
                    });

                    if (response.ok) {
                        const index = groups.value.findIndex(g => g.id === group.id);
                        if (index !== -1) {
                            groups.value[index] = { ...groups.value[index], ...group };
                        }
                        showToast('Groupe mis à jour', 'success');
                    }
                } catch (err) {
                    console.error('Erreur lors de la mise à jour du groupe:', err);
                    showToast('Erreur lors de la mise à jour du groupe', 'error');
                }
            };

            const deleteGroup = async (groupId) => {
                if (!confirm('Supprimer ce groupe ?')) return;

                try {
                    const response = await fetch(`/groups/${jobId.value}/${groupId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        groups.value = groups.value.filter(g => g.id !== groupId);
                        showToast('Groupe supprimé', 'success');
                    }
                } catch (err) {
                    console.error('Erreur lors de la suppression du groupe:', err);
                    showToast('Erreur lors de la suppression du groupe', 'error');
                }
            };

            const createGroupWithEntities = async (name, entityIds) => {
                try {
                    const groupData = {
                        id: utils.generateId(),
                        name: name,
                        entities: entityIds
                    };

                    const response = await fetch(`/groups/${jobId.value}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(groupData)
                    });

                    if (response.ok) {
                        const savedGroup = await response.json();
                        groups.value.push(savedGroup);
                        selectedEntities.value = [];
                        showToast(`Groupe "${name}" créé avec ${entityIds.length} entité(s)`, 'success');
                    }
                } catch (err) {
                    console.error('Erreur lors de la création du groupe:', err);
                    showToast('Erreur lors de la création du groupe', 'error');
                }
            };

            // Export et sauvegarde
            const exportDocument = async () => {
                if (exporting.value) return;

                try {
                    exporting.value = true;

                    const response = await fetch(`/export/${jobId.value}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            watermark: exportOptions.watermark ? 'DOCUMENT ANONYMISÉ' : null,
                            audit: exportOptions.audit
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.download_url) {
                            // Télécharger le fichier principal
                            const link = document.createElement('a');
                            link.href = result.download_url;
                            link.download = '';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            showToast('Document exporté avec succès', 'success');
                        }

                        if (result.audit_url && exportOptions.audit) {
                            // Télécharger le rapport d'audit
                            setTimeout(() => {
                                const auditLink = document.createElement('a');
                                auditLink.href = result.audit_url;
                                auditLink.download = '';
                                document.body.appendChild(auditLink);
                                auditLink.click();
                                document.body.removeChild(auditLink);
                                
                                showToast('Rapport d\'audit téléchargé', 'info');
                            }, 1000);
                        }

                        showExportModal.value = false;
                    } else {
                        throw new Error('Erreur lors de l\'export');
                    }
                } catch (err) {
                    console.error('Erreur lors de l\'export:', err);
                    showToast('Erreur lors de l\'export du document', 'error');
                } finally {
                    exporting.value = false;
                }
            };

            const saveProgress = async () => {
                if (autoSaving.value) return;

                try {
                    autoSaving.value = true;

                    // Sauvegarder les entités modifiées
                    // Note: La sauvegarde se fait déjà lors de chaque modification
                    // Cette fonction peut servir pour une sauvegarde explicite

                    lastSaved.value = Date.now();
                    showToast('Progression sauvegardée', 'success');

                } catch (err) {
                    console.error('Erreur lors de la sauvegarde:', err);
                    showToast('Erreur lors de la sauvegarde', 'error');
                } finally {
                    autoSaving.value = false;
                }
            };

            // Auto-sauvegarde
            let autoSaveInterval;
            const startAutoSave = () => {
                if (autoSaveInterval) {
                    clearInterval(autoSaveInterval);
                }

                autoSaveInterval = setInterval(() => {
                    if (!autoSaving.value) {
                        saveProgress();
                    }
                }, CONFIG.AUTO_SAVE_INTERVAL);
            };

            const stopAutoSave = () => {
                if (autoSaveInterval) {
                    clearInterval(autoSaveInterval);
                    autoSaveInterval = null;
                }
            };

            // Événements du document
            const onDocumentClick = (event) => {
                if (!annotationMode.value) return;

                // TODO: Implémenter l'annotation manuelle
                const rect = event.target.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                
                console.log('Click pour annotation:', { x, y });
            };

            const onDocumentMouseMove = utils.throttle((event) => {
                // TODO: Implémenter le survol pour l'annotation
            }, 50);

            const onDocumentScroll = utils.throttle(() => {
                // TODO: Implémenter la gestion du scroll pour les entités virtualisées
            }, 100);

            // Presets et configuration
            const applyPreset = (preset) => {
                // TODO: Implémenter l'application des préréglages
                showToast(`Préréglage "${preset.name}" appliqué`, 'info');
            };

            // Historique (Undo/Redo)
            const undo = () => {
                // TODO: Implémenter l'annulation
                showToast('Fonction d\'annulation en développement', 'info');
            };

            const redo = () => {
                // TODO: Implémenter le rétablissement
                showToast('Fonction de rétablissement en développement', 'info');
            };

            // Gestion des modals
            const closeModal = (event) => {
                if (event.target === event.currentTarget) {
                    showAddEntityModal.value = false;
                    showAddGroupModal.value = false;
                    showExportModal.value = false;
                    showRulesModal.value = false;
                }
            };

            // Gestion du redimensionnement
            const handleResize = () => {
                isMobile.value = window.innerWidth < 768;
                if (!isMobile.value) {
                    sidebarOpen.value = false;
                }
            };

            // Raccourcis clavier
            const handleKeyboard = (event) => {
                // Éviter les raccourcis dans les inputs
                if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                    return;
                }

                if (event.ctrlKey || event.metaKey) {
                    switch (event.key) {
                        case 'z':
                            event.preventDefault();
                            if (event.shiftKey) {
                                redo();
                            } else {
                                undo();
                            }
                            break;
                        case 'y':
                            event.preventDefault();
                            redo();
                            break;
                        case 's':
                            event.preventDefault();
                            saveProgress();
                            break;
                        case 'f':
                            event.preventDefault();
                            activeTab.value = 'search';
                            nextTick(() => {
                                const searchInput = document.querySelector('input[placeholder*="Rechercher"]');
                                if (searchInput) {
                                    searchInput.focus();
                                }
                            });
                            break;
                    }
                }

                // Raccourcis sans modificateurs
                switch (event.key) {
                    case 'Escape':
                        selectedEntityId.value = null;
                        highlightedEntityId.value = null;
                        sidebarOpen.value = false;
                        break;
                    case 'Delete':
                        if (selectedEntityId.value) {
                            deleteEntity(selectedEntityId.value);
                        }
                        break;
                    case 'ArrowLeft':
                        if (event.target === document.body) {
                            prevPage();
                        }
                        break;
                    case 'ArrowRight':
                        if (event.target === document.body) {
                            nextPage();
                        }
                        break;
                    case '+':
                    case '=':
                        if (event.target === document.body) {
                            zoomIn();
                        }
                        break;
                    case '-':
                        if (event.target === document.body) {
                            zoomOut();
                        }
                        break;
                    case '0':
                        if (event.target === document.body) {
                            resetZoom();
                        }
                        break;
                }
            };

            // Gestion des erreurs globales
            const reloadDocument = () => {
                error.value = null;
                loadData();
            };

            const formatTime = utils.formatTime;

            // ===== WATCHERS =====

            // Watcher pour le zoom - re-render les pages PDF
            watch(zoom, async (newZoom) => {
                if (pdfViewer.pdf && totalPages.value > 0) {
                    await renderCurrentPage();
                }
            });

            // Watcher pour la page courante
            watch(currentPage, async () => {
                if (pdfViewer.pdf) {
                    await renderCurrentPage();
                }
            });

            // Watcher pour la vue (original/anonymisé)
            watch(currentView, () => {
                updateDocumentUrl();
            });

            // ===== LIFECYCLE =====

            onMounted(async () => {
                // Vérifier la présence du job ID
                if (!jobId.value) {
                    window.location.href = '/';
                    return;
                }

                // Ajouter les event listeners
                window.addEventListener('resize', handleResize);
                document.addEventListener('keydown', handleKeyboard);

                // Démarrer l'auto-sauvegarde
                startAutoSave();

                // Charger les données
                await loadData();

                // Message de bienvenue
                showToast('Interface d\'anonymisation chargée', 'success');
            });

            onUnmounted(() => {
                // Nettoyer les resources
                window.removeEventListener('resize', handleResize);
                document.removeEventListener('keydown', handleKeyboard);
                
                stopAutoSave();
                pdfViewer.destroy();
            });

            // ===== RETOUR DE L'OBJET SETUP =====
            
            return {
                // État réactif
                jobId,
                activeTab,
                sidebarOpen,
                sidebarCollapsed,
                isMobile,
                isLoading,
                error,
                documentUrl,
                documentFilename,
                currentView,
                processingMode,
                pdfPages,
                currentPage,
                totalPages,
                zoom,
                entities,
                groups,
                selectedEntityId,
                highlightedEntityId,
                selectedEntities,
                annotationMode,
                showEntities,
                searchTerm,
                searchResults,
                activeFilters,
                advancedSearch,
                showAddEntityModal,
                showAddGroupModal,
                showExportModal,
                showRulesModal,
                newEntity,
                newGroup,
                exportOptions,
                exporting,
                autoSaving,
                lastSaved,
                anonymizationMode,
                presets,
                toasts,
                
                // Computed
                tabs,
                entityTypes,
                uniqueEntityTypes,
                filteredEntities,
                canUndo,
                canRedo,
                
                // Méthodes
                showToast,
                dismissToast,
                getToastIcon,
                toggleSidebar,
                closeSidebar,
                collapseSidebar,
                selectEntity,
                highlightEntity,
                unhighlightEntity,
                getEntityBadgeClass,
                getEntityById,
                getEntitiesForPage,
                getEntityStyle,
                changeView,
                nextPage,
                prevPage,
                zoomIn,
                zoomOut,
                resetZoom,
                toggleAnnotationMode,
                toggleEntityVisibility,
                performSearch,
                toggleFilter,
                performAdvancedSearch,
                addEntity,
                editEntity,
                deleteEntity,
                deleteSelectedEntities,
                groupSelectedEntities,
                refreshEntities,
                addGroup,
                editGroup,
                deleteGroup,
                exportDocument,
                saveProgress,
                onDocumentClick,
                onDocumentMouseMove,
                onDocumentScroll,
                applyPreset,
                undo,
                redo,
                closeModal,
                reloadDocument,
                formatTime
            };
        }
    }).mount('#app');

})();