import { defineStore } from 'pinia';

const CONFIG = {
    ZOOM_MIN: 0.3,
    ZOOM_MAX: 3.0,
    ZOOM_STEP: 0.1
};

// Store for global application state
export const useAppStore = defineStore('app', {
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

