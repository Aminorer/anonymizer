import { defineStore } from 'pinia';
import { utils } from '../utils.js';
import { apiClient } from '../services/apiClient.js';

// Store managing detected entities
export const useEntityStore = defineStore('entities', {
    state: () => ({
        items: [],
        status: 'idle',
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
            this.status = 'loading';
            this.error = null;
            try {
                const data = await apiClient.request(`/entities/${jobId}`);
                this.items = data.map(entity => ({
                    replacement: '',
                    page: null,
                    confidence: null,
                    selected: false,
                    ...entity
                }));
                this.status = 'loaded';
            } catch (error) {
                this.error = error.message;
                this.status = 'error';
            }
        },

        async add(jobId, entity) {
            const temp = { selected: false, id: entity.id || utils.generateId(), ...entity };
            this.items.push(temp);
            try {
                const savedEntity = await apiClient.request(
                    `/entities/${jobId}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(temp)
                    },
                    () => {
                        this.items = this.items.filter(item => item.id !== temp.id);
                    }
                );
                Object.assign(temp, savedEntity);
                if (window.toastService) {
                    window.toastService.success('Entité ajoutée avec succès');
                }
                return savedEntity;
            } catch (error) {
                throw error;
            }
        },

        async update(jobId, entity) {
            const index = this.items.findIndex(item => item.id === entity.id);
            if (index === -1) return;
            const previous = { ...this.items[index] };
            this.items[index] = { ...this.items[index], ...entity };
            try {
                await apiClient.request(
                    `/entities/${jobId}/${entity.id}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(entity)
                    },
                    () => {
                        this.items[index] = previous;
                    }
                );
                return entity;
            } catch (error) {
                throw error;
            }
        },

        async remove(jobId, entityId) {
            const index = this.items.findIndex(item => item.id === entityId);
            if (index === -1) return;
            const removed = this.items.splice(index, 1)[0];
            try {
                await apiClient.request(
                    `/entities/${jobId}/${entityId}`,
                    { method: 'DELETE' },
                    () => {
                        this.items.splice(index, 0, removed);
                    }
                );
            } catch (error) {
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

