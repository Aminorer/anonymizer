// NOUVEAU FICHIER : backend/static/js/notification-service.js
class ControlledNotificationService {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed top-4 right-4 space-y-2 z-50';
            document.body.appendChild(this.container);
        }
    }

    // Méthode explicite pour les notifications manuelles uniquement
    showManual(message, type = 'info', duration = 5000) {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);
        
        requestAnimationFrame(() => {
            toast.classList.add('animate-slide-in');
        });
        
        setTimeout(() => {
            this.remove(toast);
        }, duration);
    }

    // Les anciennes méthodes logguent seulement
    show(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    success(message) { 
        console.log(`[SUCCESS] ${message}`); 
    }
    
    error(message) { 
        console.log(`[ERROR] ${message}`); 
    }
    
    warning(message) { 
        console.log(`[WARNING] ${message}`); 
    }
    
    info(message) { 
        console.log(`[INFO] ${message}`); 
    }

    createToast(message, type) {
        // ... code existant du toast ...
        const toast = document.createElement('div');
        // ... implémentation complète ...
        return toast;
    }

    remove(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Remplacer le service global
window.toastService = new ControlledNotificationService();