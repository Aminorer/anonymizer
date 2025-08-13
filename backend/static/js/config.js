// NOUVEAU FICHIER : backend/static/js/config.js
const AppConfig = {
    // Contrôle global des notifications automatiques
    ENABLE_AUTO_NOTIFICATIONS: false,
    
    // Types de notifications autorisées automatiquement
    ALLOWED_AUTO_NOTIFICATIONS: [
        // Aucune par défaut - toutes doivent être déclenchées manuellement
    ],
    
    // Configuration des toasts
    TOAST_CONFIG: {
        DURATION: 5000,
        AUTO_HIDE: true,
        POSITION: 'top-right'
    }
};

// Exposer globalement
window.AppConfig = AppConfig;