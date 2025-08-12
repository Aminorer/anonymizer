/**
 * Application JavaScript améliorée pour l'anonymiseur juridique
 * Utilise Vue 3 + Pinia pour la gestion d'état
 */

(function() {
    'use strict';

    const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;
    const { createPinia, defineStore } = Pinia;
    
    // Configuration
    const CONFIG = {
        MAX_HISTORY_SIZE: 50,
        TOAST_DURATION: 5000,
        SEARCH_DEBOUNCE: 300,
        AUTO_SAVE_INTERVAL: 30000,
        ZOOM_STEP: 0.1,
        MIN_ZOOM: 0.3,
        MAX_ZOOM: 3.0
    };

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
            }
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
            try {
                new RegExp(pattern);
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // Système de notifications
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
            if (!this.container) this.init();

            const toast = this.createToast(message, type);
            this.container.appendChild(toast);

            // Animation d'entrée
            requestAnimationFrame(() => {
                toast.classList.add('animate-slide-in');
            });

            // Auto suppression
            setTimeout(() => {
                this.remove(toast);
            }, duration);

            return toast;
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
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        },

        success(message) {
            return this.show(message, 'success');
        },

        error(message) {
            return this.show(message, 'error');
        },

        warning(message) {
            return this.show(message, 'warning');
        },

        info(message) {
            return this.show(message, 'info');
        }
    };

    // Store pour la gestion des entités
    const useEntityStore = defineStore('entities', {
        state: () => ({
            items: [],
            loading: false,
            error: null
        }),

        getters: {
            totalCount: (state) => state.items.length,
            selectedCount: (state) => state.items.filter(item => item.selected).length,
            byType: (state) => {
                return state.items.reduce((acc, item) => {
                    if (!acc[item.type]) acc[item.type] = [];
                    acc[item.type].push(item);
                    return acc;
                }, {});
            },
            highConfidenceItems: (state) => {
                return state.items.filter(item => 
                    item.confidence && item.confidence >= 0.8
                );
            }
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
                    
                    notificationSystem.success(`${this.items.length} entités chargées`);
                } catch (error) {
                    this.error = error.message;
                    notificationSystem.error('Erreur lors du chargement des entités');
                    throw error;
                } finally {
                    this.loading = false;
                }
            },

            async add(jobId, entity) {
                try {
                    const entityWithId = {
                        id: utils.generateId(),
                        selected: false,
                        ...entity
                    };

                    const response = await fetch(`/entities/${jobId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entityWithId)
                    });

                    if (!response.ok) throw new Error('Failed to add entity');
                    
                    const savedEntity = await response.json();
                    this.items.push(savedEntity);
                    notificationSystem.success('Entité ajoutée avec succès');
                    
                    return savedEntity;
                } catch (error) {
                    notificationSystem.error('Erreur lors de l\'ajout de l\'entité');
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

                    if (!response.ok) throw new Error('Failed to update entity');
                    
                    const index = this.items.findIndex(item => item.id === entity.id);
                    if (index !== -1) {
                        this.items[index] = { ...this.items[index], ...entity };
                    }
                    
                    return entity;
                } catch (error) {
                    notificationSystem.error('Erreur lors de la mise à jour');
                    throw error;
                }
            },

            async remove(jobId, entityId) {
                try {
                    const response = await fetch(`/entities/${jobId}/${entityId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) throw new Error('Failed to delete entity');
                    
                    this.items = this.items.filter(item => item.id !== entityId);
                    notificationSystem.success('Entité supprimée');
                } catch (error) {
                    notificationSystem.error('Erreur lors de la suppression');
                    throw error;
                }
            },

            async removeMultiple(jobId, entityIds) {
                const promises = entityIds.map(id => this.remove(jobId, id));
                await Promise.all(promises);
                notificationSystem.success(`${entityIds.length} entités supprimées`);
            },

            selectAll() {
                this.items.forEach(item => item.selected = true);
            },

            selectNone() {
                this.items.forEach(item => item.selected = false);
            },

            selectByType(type) {
                this.items.forEach(item => {
                    item.selected = item.type === type;
                });
            },

            reorder(fromIndex, toIndex) {
                const item = this.items.splice(fromIndex, 1)[0];
                this.items.splice(toIndex, 0, item);
            },

            getSelected() {
                return this.items.filter(item => item.selected);
            }
        }
    });

    // Store pour la gestion des groupes
    const useGroupStore = defineStore('groups', {
        state: () => ({
            items: [],
            loading: false,
            error: null
        }),

        getters: {
            totalCount: (state) => state.items.length,
            byName: (state) => {
                return state.items.reduce((acc, group) => {
                    acc[group.name] = group;
                    return acc;
                }, {});
            }
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
                    notificationSystem.error('Erreur lors du chargement des groupes');
                    throw error;
                } finally {
                    this.loading = false;
                }
            },

            async add(jobId, group) {
                try {
                    const groupWithId = {
                        id: utils.generateId(),
                        entities: [],
                        ...group
                    };

                    const response = await fetch(`/groups/${jobId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(groupWithId)
                    });

                    if (!response.ok) throw new Error('Failed to create group');
                    
                    const savedGroup = await response.json();
                    this.items.push(savedGroup);
                    notificationSystem.success('Groupe créé avec succès');
                    
                    return savedGroup;
                } catch (error) {
                    notificationSystem.error('Erreur lors de la création du groupe');
                    throw error;
                }
            },

            async remove(jobId, groupId) {
                try {
                    const response = await fetch(`/groups/${jobId}/${groupId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) throw new Error('Failed to delete group');
                    
                    this.items = this.items.filter(item => item.id !== groupId);
                    notificationSystem.success('Groupe supprimé');
                } catch (error) {
                    notificationSystem.error('Erreur lors de la suppression du groupe');
                    throw error;
                }
            },

            async assignEntity(jobId, entityId, groupId) {
                try {
                    const response = await fetch(`/groups/${jobId}/${groupId}/entities/${entityId}`, {
                        method: 'POST'
                    });

                    if (!response.ok) throw new Error('Failed to assign entity');
                    
                    const updatedGroup = await response.json();
                    const index = this.items.findIndex(item => item.id === groupId);
                    if (index !== -1) {
                        this.items[index] = updatedGroup;
                    }
                    
                    notificationSystem.success('Entité assignée au groupe');
                    return updatedGroup;
                } catch (error) {
                    notificationSystem.error('Erreur lors de l\'assignation');
                    throw error;
                }
            }
        }
    });

    // Store pour l'état global de l'application
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
                return state.currentView === 'original' ? 
                    state.status.original_url : 
                    state.status.anonymized_url;
            }
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

            saveState(entityStore, groupStore) {
                const state = {
                    entities: JSON.parse(JSON.stringify(entityStore.items)),
                    groups: JSON.parse(JSON.stringify(groupStore.items)),
                    timestamp: Date.now()
                };
                
                this.history.push(state);
                this.future = [];
                
                // Limiter la taille de l'historique
                if (this.history.length > CONFIG.MAX_HISTORY_SIZE) {
                    this.history.shift();
                }
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
                
                notificationSystem.info('Action annulée');
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
                
                notificationSystem.info('Action rétablie');
                return true;
            },

            changeView(view) {
                this.currentView = view;
            },

            setZoom(zoom) {
                this.zoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, zoom));
            },

            zoomIn() {
                this.setZoom(this.zoom + CONFIG.ZOOM_STEP);
            },

            zoomOut() {
                this.setZoom(this.zoom - CONFIG.ZOOM_STEP);
            },

            setPage(page) {
                this.currentPage = Math.max(1, Math.min(this.totalPages, page));
            },

            nextPage() {
                this.setPage(this.currentPage + 1);
            },

            prevPage() {
                this.setPage(this.currentPage - 1);
            },

            addToSearchHistory(term) {
                if (!this.searchHistory.includes(term)) {
                    this.searchHistory.unshift(term);
                    if (this.searchHistory.length > 10) {
                        this.searchHistory.pop();
                    }
                }
            }
        }
    });

    // Gestionnaire de rendu de documents
    const documentRenderer = {
        container: null,

        init(containerId) {
            this.container = document.getElementById(containerId);
        },

        clear() {
            if (this.container) {
                this.container.innerHTML = '';
            }
        },

        async renderPDF(url, zoom = 1) {
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
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
            } catch (error) {
                console.error('Error rendering PDF:', error);
                notificationSystem.error('Erreur lors du rendu du PDF');
                throw error;
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
                
                return 1; // DOCX est généralement rendu comme une seule page
            } catch (error) {
                console.error('Error rendering DOCX:', error);
                notificationSystem.error('Erreur lors du rendu du DOCX');
                throw error;
            }
        },

        highlightEntities(entities, view) {
            if (view !== 'anonymized') return;
            
            // Supprimer les highlights existants
            this.container.querySelectorAll('.entity-highlight, .pdf-highlight').forEach(el => {
                el.remove();
            });
            
            entities.forEach(entity => {
                if (entity.page !== undefined && entity.x !== undefined) {
                    // PDF avec coordonnées
                    this.highlightPDFEntity(entity);
                } else {
                    // DOCX ou recherche textuelle
                    this.highlightTextEntity(entity);
                }
            });
        },

        highlightPDFEntity(entity) {
            const pageEl = this.container.querySelector(`[data-page="${entity.page}"]`);
            if (!pageEl) return;
            
            const highlight = document.createElement('div');
            highlight.className = 'pdf-highlight absolute cursor-pointer';
            highlight.style.left = `${entity.x}px`;
            highlight.style.top = `${entity.y}px`;
            highlight.style.width = `${entity.width}px`;
            highlight.style.height = `${entity.height}px`;
            highlight.title = `${entity.type}: ${entity.value}`;
            highlight.dataset.entityId = entity.id;
            
            pageEl.appendChild(highlight);
        },

        highlightTextEntity(entity) {
            const walker = document.createTreeWalker(
                this.container,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            
            textNodes.forEach(textNode => {
                const text = textNode.textContent;
                const index = text.indexOf(entity.value);
                
                if (index !== -1) {
                    const range = document.createRange();
                    range.setStart(textNode, index);
                    range.setEnd(textNode, index + entity.value.length);
                    
                    const highlight = document.createElement('span');
                    highlight.className = 'entity-highlight cursor-pointer';
                    highlight.title = `${entity.type}: ${entity.value}`;
                    highlight.dataset.entityId = entity.id;
                    
                    try {
                        range.surroundContents(highlight);
                    } catch (e) {
                        // En cas d'erreur, on passe au noeud suivant
                        console.warn('Could not highlight text:', e);
                    }
                }
            });
        },

        addSearchHighlights(searchTerm, searchType = 'text') {
            this.removeSearchHighlights();
            
            if (!searchTerm) return;
            
            const walker = document.createTreeWalker(
                this.container,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            
            const regex = searchType === 'regex' ? 
                new RegExp(searchTerm, 'gi') :
                new RegExp(utils.sanitizeText(searchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\            setStatus(status) {
                this.'), 'gi');
            
            textNodes.forEach(textNode => {
                const text = textNode.textContent;
                const matches = [...text.matchAll(regex)];
                
                if (matches.length > 0) {
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;
                    
                    matches.forEach(match => {
                        // Ajouter le texte avant la correspondance
                        if (match.index > lastIndex) {
                            fragment.appendChild(
                                document.createTextNode(text.slice(lastIndex, match.index))
                            );
                        }
                        
                        // Ajouter la correspondance surlignée
                        const highlight = document.createElement('span');
                        highlight.className = 'search-highlight';
                        highlight.textContent = match[0];
                        fragment.appendChild(highlight);
                        
                        lastIndex = match.index + match[0].length;
                    });
                    
                    // Ajouter le texte restant
                    if (lastIndex < text.length) {
                        fragment.appendChild(
                            document.createTextNode(text.slice(lastIndex))
                        );
                    }
                    
                    textNode.parentNode.replaceChild(fragment, textNode);
                }
            });
        },

        removeSearchHighlights() {
            this.container.querySelectorAll('.search-highlight').forEach(highlight => {
                const parent = highlight.parentNode;
                parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                parent.normalize();
            });
        }
    };

    // Gestionnaire de sélection de texte
    const selectionHandler = {
        floatingMenu: null,
        currentSelection: null,

        init() {
            this.floatingMenu = document.getElementById('floating-selection');
            if (!this.floatingMenu) {
                this.createFloatingMenu();
            }
            
            document.addEventListener('mouseup', this.handleSelection.bind(this));
            document.addEventListener('click', this.hideMenu.bind(this));
        },

        createFloatingMenu() {
            this.floatingMenu = document.createElement('div');
            this.floatingMenu.id = 'floating-selection';
            this.floatingMenu.className = 'floating-selection';
            this.floatingMenu.innerHTML = `
                <div class="flex space-x-2 p-2">
                    <select id="entity-type-select" class="text-sm border border-gray-300 rounded px-2 py-1">
                        <option value="PERSON">Personne</option>
                        <option value="ORG">Organisation</option>
                        <option value="LOC">Localisation</option>
                        <option value="EMAIL">Email</option>
                        <option value="PHONE">Téléphone</option>
                        <option value="DATE">Date</option>
                        <option value="ADDRESS">Adresse</option>
                        <option value="IBAN">IBAN</option>
                        <option value="SIREN">SIREN</option>
                        <option value="SIRET">SIRET</option>
                    </select>
                    <button id="add-selection-btn" class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
                        <i class="fas fa-plus mr-1"></i>Ajouter
                    </button>
                </div>
            `;
            
            document.body.appendChild(this.floatingMenu);
            
            // Event listener pour le bouton
            this.floatingMenu.querySelector('#add-selection-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.addSelectionAsEntity();
            });
        },

        handleSelection(event) {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();
            
            if (selectedText && selectedText.length > 1) {
                this.currentSelection = {
                    text: selectedText,
                    range: selection.getRangeAt(0).cloneRange()
                };
                this.showMenu(selection);
            } else {
                this.hideMenu();
            }
        },

        showMenu(selection) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            this.floatingMenu.style.left = `${rect.left + window.scrollX}px`;
            this.floatingMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
            this.floatingMenu.classList.add('show');
        },

        hideMenu() {
            if (this.floatingMenu) {
                this.floatingMenu.classList.remove('show');
            }
        },

        addSelectionAsEntity() {
            if (!this.currentSelection) return;
            
            const entityType = document.getElementById('entity-type-select').value;
            const app = window.vueApp;
            
            if (app && entityType) {
                app.addEntityFromSelection(this.currentSelection.text, entityType);
                this.hideMenu();
                window.getSelection().removeAllRanges();
                this.currentSelection = null;
            }
        }
    };

    // Gestionnaire de drag & drop
    const dragDropHandler = {
        draggedElement: null,
        draggedData: null,

        init() {
            document.addEventListener('dragstart', this.handleDragStart.bind(this));
            document.addEventListener('dragend', this.handleDragEnd.bind(this));
            document.addEventListener('dragover', this.handleDragOver.bind(this));
            document.addEventListener('drop', this.handleDrop.bind(this));
        },

        handleDragStart(event) {
            if (!event.target.draggable) return;
            
            this.draggedElement = event.target;
            this.draggedData = {
                type: event.target.dataset.dragType,
                id: event.target.dataset.dragId,
                index: event.target.dataset.dragIndex
            };
            
            event.target.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
        },

        handleDragEnd(event) {
            if (this.draggedElement) {
                this.draggedElement.classList.remove('dragging');
                this.draggedElement = null;
                this.draggedData = null;
            }
            
            // Nettoyer les indicateurs de drop
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        },

        handleDragOver(event) {
            if (!this.draggedElement) return;
            
            const dropTarget = event.target.closest('[data-drop-target]');
            if (dropTarget) {
                event.preventDefault();
                dropTarget.classList.add('drag-over');
            }
        },

        handleDrop(event) {
            const dropTarget = event.target.closest('[data-drop-target]');
            if (!dropTarget || !this.draggedData) return;
            
            event.preventDefault();
            dropTarget.classList.remove('drag-over');
            
            const dropType = dropTarget.dataset.dropTarget;
            const dropId = dropTarget.dataset.dropId;
            
            // Émettre un événement personnalisé pour la logique métier
            const dropEvent = new CustomEvent('entityDrop', {
                detail: {
                    draggedData: this.draggedData,
                    dropTarget: { type: dropType, id: dropId }
                }
            });
            
            document.dispatchEvent(dropEvent);
        }
    };

    // Fonction principale pour initialiser l'application
    function initializeApp() {
        const jobId = new URLSearchParams(window.location.search).get('job_id');
        
        if (!jobId) {
            window.location.href = '/';
            return;
        }

        // Initialiser les systèmes
        notificationSystem.init();
        documentRenderer.init('viewer');
        selectionHandler.init();
        dragDropHandler.init();

        // Créer l'instance Pinia
        const pinia = createPinia();

        // Créer l'application Vue
        const app = createApp({
            setup() {
                // Stores
                const appStore = useAppStore();
                const entityStore = useEntityStore();
                const groupStore = useGroupStore();

                // État local
                const activeTab = ref('entities');
                const showDetectionModal = ref(false);
                const showGroupModal = ref(false);
                const showExportModal = ref(false);
                const searchTerm = ref('');
                const searchType = ref('text');
                const searchResults = ref([]);

                // Formulaires
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

                // Configuration des règles
                const rules = ref({
                    regex_rules: [],
                    ner: { confidence: 0.5 },
                    styles: {}
                });

                // Computed
                const entities = computed(() => entityStore.items);
                const groups = computed(() => groupStore.items);
                const selectedEntities = computed(() => entityStore.getSelected());

                // Watchers
                watch(() => appStore.currentView, async (newView) => {
                    await renderDocument();
                });

                watch(() => appStore.zoom, () => {
                    if (appStore.docType === 'pdf') {
                        renderDocument();
                    }
                });

                // Méthodes de rendu
                const renderDocument = async () => {
                    if (!appStore.status) return;
                    
                    try {
                        const url = appStore.documentUrl;
                        if (!url) return;
                        
                        if (appStore.docType === 'pdf') {
                            const totalPages = await documentRenderer.renderPDF(url, appStore.zoom);
                            appStore.totalPages = totalPages;
                        } else if (appStore.docType === 'docx') {
                            await documentRenderer.renderDOCX(url);
                            appStore.totalPages = 1;
                        }
                        
                        // Appliquer les highlights
                        documentRenderer.highlightEntities(entities.value, appStore.currentView);
                        
                    } catch (error) {
                        console.error('Error rendering document:', error);
                        notificationSystem.error('Erreur lors du rendu du document');
                    }
                };

                // Méthodes de gestion des entités
                const saveState = () => {
                    appStore.saveState(entityStore, groupStore);
                };

                const addEntityFromSelection = async (text, type) => {
                    saveState();
                    await entityStore.add(jobId, {
                        type,
                        value: text,
                        replacement: '',
                        page: appStore.currentPage,
                        start: 0,
                        end: 0
                    });
                    await renderDocument();
                };

                const updateEntity = async (entity) => {
                    await entityStore.update(jobId, entity);
                    await renderDocument();
                };

                const deleteSelectedEntities = async () => {
                    const selected = selectedEntities.value;
                    if (selected.length === 0) return;
                    
                    saveState();
                    await entityStore.removeMultiple(jobId, selected.map(e => e.id));
                    await renderDocument();
                };

                // Méthodes de recherche
                const performSearch = utils.debounce(async () => {
                    if (!searchTerm.value) {
                        documentRenderer.removeSearchHighlights();
                        searchResults.value = [];
                        return;
                    }
                    
                    try {
                        if (searchType.value === 'semantic') {
                            const response = await fetch(`/semantic-search/${jobId}?q=${encodeURIComponent(searchTerm.value)}`);
                            if (response.ok) {
                                const data = await response.json();
                                searchResults.value = data.matches.map(match => ({
                                    text: match,
                                    page: null
                                }));
                            }
                        } else {
                            documentRenderer.addSearchHighlights(searchTerm.value, searchType.value);
                            // Simuler des résultats pour l'affichage
                            searchResults.value = [{ text: searchTerm.value, page: appStore.currentPage }];
                        }
                        
                        appStore.addToSearchHistory(searchTerm.value);
                        notificationSystem.info(`${searchResults.value.length} résultat(s) trouvé(s)`);
                        
                    } catch (error) {
                        console.error('Search error:', error);
                        notificationSystem.error('Erreur lors de la recherche');
                    }
                }, CONFIG.SEARCH_DEBOUNCE);

                // Méthodes d'export
                const exportDocument = async (options = {}) => {
                    try {
                        const response = await fetch(`/export/${jobId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(options)
                        });
                        
                        if (!response.ok) throw new Error('Export failed');
                        
                        const data = await response.json();
                        
                        if (data.download_url) {
                            window.location.href = data.download_url;
                            notificationSystem.success('Document exporté avec succès');
                        }
                        
                        if (data.audit_url) {
                            window.open(data.audit_url, '_blank');
                        }
                        
                    } catch (error) {
                        console.error('Export error:', error);
                        notificationSystem.error('Erreur lors de l\'export');
                    }
                };

                // Chargement initial
                const loadData = async () => {
                    try {
                        appStore.loading = true;
                        appStore.setJobId(jobId);
                        
                        // Charger le statut du job
                        const statusResponse = await fetch(`/status/${jobId}`);
                        if (!statusResponse.ok) throw new Error('Job not found');
                        
                        const statusData = await statusResponse.json();
                        appStore.setStatus(statusData.result);
                        appStore.processingMode = statusData.mode || 'regex';
                        
                        // Charger les entités et groupes
                        await Promise.all([
                            entityStore.fetch(jobId),
                            groupStore.fetch(jobId)
                        ]);
                        
                        // Rendre le document
                        await renderDocument();
                        
                        notificationSystem.success('Document chargé avec succès');
                        
                    } catch (error) {
                        console.error('Error loading data:', error);
                        notificationSystem.error('Erreur lors du chargement');
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 3000);
                    } finally {
                        appStore.loading = false;
                    }
                };

                // Event listeners
                onMounted(() => {
                    loadData();
                    
                    // Écouter les événements de drop
                    document.addEventListener('entityDrop', async (event) => {
                        const { draggedData, dropTarget } = event.detail;
                        
                        if (dropTarget.type === 'group') {
                            saveState();
                            await groupStore.assignEntity(jobId, draggedData.id, dropTarget.id);
                        }
                    });
                    
                    // Auto-sauvegarde périodique
                    setInterval(() => {
                        if (entities.value.length > 0) {
                            console.log('Auto-save triggered');
                        }
                    }, CONFIG.AUTO_SAVE_INTERVAL);
                });

                // Exposer les méthodes globalement pour l'interaction avec d'autres systèmes
                window.vueApp = {
                    addEntityFromSelection,
                    renderDocument,
                    exportDocument
                };

                return {
                    // État
                    appStore,
                    entityStore,
                    groupStore,
                    activeTab,
                    showDetectionModal,
                    showGroupModal,
                    showExportModal,
                    searchTerm,
                    searchType,
                    searchResults,
                    newDetection,
                    newGroupName,
                    exportOptions,
                    rules,
                    
                    // Computed
                    entities,
                    groups,
                    selectedEntities,
                    
                    // Méthodes
                    addEntityFromSelection,
                    updateEntity,
                    deleteSelectedEntities,
                    performSearch,
                    exportDocument,
                    renderDocument,
                    saveState
                };
            }
        });

        app.use(pinia);
        app.mount('#app');

        return app;
    }

    // Initialiser l'application une fois le DOM chargé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

})();