import { defineStore } from 'pinia';
import { utils } from '../utils.js';
import { apiClient } from '../services/apiClient.js';

// Store managing entity groups
export const useGroupStore = defineStore('groups', {
    state: () => ({
        items: [],
        status: 'idle',
        error: null
    }),

    getters: {
        totalCount: (state) => state.items.length
    },

    actions: {
        async fetch(jobId) {
            this.status = 'loading';
            this.error = null;
            try {
                this.items = await apiClient.request(`/groups/${jobId}`);
                this.status = 'loaded';
            } catch (error) {
                this.error = error.message;
                this.status = 'error';
            }
        },

        async add(jobId, group) {
            const temp = { id: group.id || utils.generateId(), entities: [], ...group };
            this.items.push(temp);
            try {
                const savedGroup = await apiClient.request(
                    `/groups/${jobId}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(temp)
                    },
                    () => {
                        this.items = this.items.filter(item => item.id !== temp.id);
                    }
                );
                Object.assign(temp, savedGroup);
                if (window.toastService) {
                    window.toastService.success('Groupe créé avec succès');
                }
                return savedGroup;
            } catch (error) {
                throw error;
            }
        },

        async remove(jobId, groupId) {
            const index = this.items.findIndex(item => item.id === groupId);
            if (index === -1) return;
            const removed = this.items.splice(index, 1)[0];
            try {
                await apiClient.request(
                    `/groups/${jobId}/${groupId}`,
                    { method: 'DELETE' },
                    () => {
                        this.items.splice(index, 0, removed);
                    }
                );
                if (window.toastService) {
                    window.toastService.success('Groupe supprimé');
                }
            } catch (error) {
                throw error;
            }
        },

        async assignEntity(jobId, entityId, groupId) {
            const index = this.items.findIndex(item => item.id === groupId);
            if (index === -1) return;
            const previous = { ...this.items[index] };
            try {
                const updatedGroup = await apiClient.request(
                    `/groups/${jobId}/${groupId}/entities/${entityId}`,
                    { method: 'POST' },
                    () => {
                        this.items[index] = previous;
                    }
                );
                this.items[index] = updatedGroup;
                if (window.toastService) {
                    window.toastService.success('Entité assignée au groupe');
                }
                return updatedGroup;
            } catch (error) {
                throw error;
            }
        }
    }
});

