import { defineStore } from 'pinia';
import { utils } from '../utils.js';

// Store managing detected entities
export const useEntityStore = defineStore('entities', {
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
            } catch (error) {
                this.error = error.message;
                if (window.toastService) {
                    window.toastService.error('Erreur lors du chargement des entités');
                }
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
                if (window.toastService) {
                    window.toastService.success('Entité ajoutée avec succès');
                }
                return savedEntity;
            } catch (error) {
                if (window.toastService) {
                    window.toastService.error("Erreur lors de l'ajout de l'entité");
                }
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
                if (window.toastService) {
                    window.toastService.error('Erreur lors de la mise à jour');
                }
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
            } catch (error) {
                if (window.toastService) {
                    window.toastService.error('Erreur lors de la suppression');
                }
                throw error;
            }
        },

        async removeMultiple(jobId, entityIds) {
            const promises = entityIds.map(id => this.remove(jobId, id));
            try {
                await Promise.all(promises);
            } catch (error) {
                // Errors are handled in remove()
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

