import { defineStore } from 'pinia';
import { utils } from '../utils.js';

// Store managing entity groups
export const useGroupStore = defineStore('groups', {
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
                if (window.toastService) {
                    window.toastService.error('Erreur lors du chargement des groupes');
                }
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
                if (window.toastService) {
                    window.toastService.success('Groupe créé avec succès');
                }
                return savedGroup;
            } catch (error) {
                if (window.toastService) {
                    window.toastService.error('Erreur lors de la création du groupe');
                }
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
                if (window.toastService) {
                    window.toastService.success('Groupe supprimé');
                }
            } catch (error) {
                if (window.toastService) {
                    window.toastService.error('Erreur lors de la suppression du groupe');
                }
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

                if (window.toastService) {
                    window.toastService.success('Entité assignée au groupe');
                }
                return updatedGroup;
            } catch (error) {
                if (window.toastService) {
                    window.toastService.error("Erreur lors de l'assignation");
                }
                throw error;
            }
        }
    }
});

