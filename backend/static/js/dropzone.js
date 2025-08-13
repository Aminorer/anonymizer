/**
 * Script amélioré pour la gestion de l'upload de fichiers
 * Gère le drag & drop, la validation et les retours utilisateur
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        MAX_FILE_SIZE: 25 * 1024 * 1024, // 25 MB
        ALLOWED_EXTENSIONS: ['pdf', 'docx'],
        UPLOAD_ENDPOINT: '/upload',
        PROGRESS_PAGE: '/progress'
    };

    // Utilitaires
    const utils = {
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        getFileExtension(filename) {
            return filename.split('.').pop().toLowerCase();
        },

        validateFile(file) {
            const errors = [];

            if (!file) {
                errors.push('Aucun fichier sélectionné');
                return errors;
            }

            if (file.size === 0) {
                errors.push('Le fichier est vide');
            }

            if (file.size > CONFIG.MAX_FILE_SIZE) {
                errors.push(`Le fichier dépasse la taille maximale de ${utils.formatFileSize(CONFIG.MAX_FILE_SIZE)}`);
            }

            const extension = utils.getFileExtension(file.name);
            if (!CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
                errors.push(`Format non supporté. Utilisez : ${CONFIG.ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`);
            }

            return errors;
        },

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
        }
    };

    // Gestionnaire d'upload
    class FileUploadManager {
        constructor() {
            this.currentFile = null;
            this.isUploading = false;
            this.elements = {};
            
            this.init();
        }

        init() {
            this.bindElements();
            this.attachEventListeners();
            this.updateUI();
        }

        bindElements() {
            this.elements = {
                form: document.getElementById('upload-form'),
                fileInput: document.getElementById('file-input'),
                dropzone: document.getElementById('dropzone'),
                fileInfo: document.getElementById('file-info'),
                fileName: document.getElementById('file-name'),
                fileSize: document.getElementById('file-size'),
                removeBtn: document.getElementById('remove-file'),
                errorMessage: document.getElementById('error-message'),
                errorText: document.getElementById('error-text'),
                submitBtn: document.getElementById('submit-btn'),
                modeInputs: document.querySelectorAll('input[name="mode"]'),
                confidenceSlider: document.getElementById('confidence'),
                confidenceValue: document.getElementById('confidence-value'),
                confidenceSection: document.getElementById('confidence-section')
            };

            // Vérifier que tous les éléments sont présents
            Object.entries(this.elements).forEach(([key, element]) => {
                if (!element && !['fileInfo', 'fileName', 'fileSize', 'removeBtn', 'errorMessage', 'errorText'].includes(key)) {
                    console.warn(`Element ${key} not found`);
                }
            });
        }

        attachEventListeners() {
            // Mode selection
            this.elements.modeInputs.forEach(input => {
                input.addEventListener('change', this.handleModeChange.bind(this));
            });

            // Confidence slider
            if (this.elements.confidenceSlider) {
                this.elements.confidenceSlider.addEventListener('input', this.handleConfidenceChange.bind(this));
            }

            // File input
            if (this.elements.fileInput) {
                this.elements.fileInput.addEventListener('change', this.handleFileInputChange.bind(this));
            }

            // Dropzone events
            if (this.elements.dropzone) {
                this.elements.dropzone.addEventListener('click', this.handleDropzoneClick.bind(this));
                this.elements.dropzone.addEventListener('dragenter', this.handleDragEnter.bind(this));
                this.elements.dropzone.addEventListener('dragover', this.handleDragOver.bind(this));
                this.elements.dropzone.addEventListener('dragleave', this.handleDragLeave.bind(this));
                this.elements.dropzone.addEventListener('drop', this.handleDrop.bind(this));
            }

            // Remove file button
            if (this.elements.removeBtn) {
                this.elements.removeBtn.addEventListener('click', this.handleRemoveFile.bind(this));
            }

            // Form submission
            if (this.elements.form) {
                this.elements.form.addEventListener('submit', this.handleFormSubmit.bind(this));
            }

            // Prevent default drag behaviors on document
            document.addEventListener('dragenter', this.preventDefaults);
            document.addEventListener('dragover', this.preventDefaults);
            document.addEventListener('dragleave', this.preventDefaults);
            document.addEventListener('drop', this.preventDefaults);
        }

        preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        handleModeChange(event) {
            const selectedMode = event.target.value;
            const isAIMode = selectedMode === 'ai';
            
            if (this.elements.confidenceSection) {
                if (isAIMode) {
                    this.elements.confidenceSection.classList.remove('hidden');
                    this.animateSlideDown(this.elements.confidenceSection);
                } else {
                    this.animateSlideUp(this.elements.confidenceSection, () => {
                        this.elements.confidenceSection.classList.add('hidden');
                    });
                }
            }

            // Mettre à jour les cartes de mode
            document.querySelectorAll('.mode-card').forEach(card => {
                card.classList.remove('selected');
            });
            event.target.closest('.mode-card').classList.add('selected');

            console.log(`Mode ${isAIMode ? 'IA' : 'Regex'} sélectionné`);
        }

        handleConfidenceChange(event) {
            const value = parseFloat(event.target.value).toFixed(2);
            if (this.elements.confidenceValue) {
                this.elements.confidenceValue.textContent = value;
            }
        }

        handleDropzoneClick(event) {
            event.preventDefault();
            if (this.elements.fileInput && !this.isUploading) {
                this.elements.fileInput.click();
            }
        }

        handleFileInputChange(event) {
            const file = event.target.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        }

        handleDragEnter(event) {
            this.preventDefaults(event);
            this.elements.dropzone.classList.add('hover');
        }

        handleDragOver(event) {
            this.preventDefaults(event);
        }

        handleDragLeave(event) {
            this.preventDefaults(event);
            // Vérifier si on quitte vraiment la dropzone
            if (!this.elements.dropzone.contains(event.relatedTarget)) {
                this.elements.dropzone.classList.remove('hover');
            }
        }

        handleDrop(event) {
            this.preventDefaults(event);
            this.elements.dropzone.classList.remove('hover');
            
            const files = event.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files[0]);
            }
        }

        handleFileSelection(file) {
            // Valider le fichier
            const errors = utils.validateFile(file);
            if (errors.length > 0) {
                this.showError(errors[0]);
                this.resetFileInput();
                return;
            }

            // Stocker le fichier et mettre à jour l'UI
            this.currentFile = file;
            this.updateFileInput(file);
            this.updateUI();
            this.hideError();

            // Animation de succès
            this.animateFileAccepted();
        }

        handleRemoveFile(event) {
            event.preventDefault();
            this.resetFileInput();
            this.updateUI();
        }

        async handleFormSubmit(event) {
            event.preventDefault();

            if (!this.currentFile) {
                this.showError('Veuillez sélectionner un fichier');
                return;
            }

            if (this.isUploading) {
                return;
            }

            // Validation finale
            const errors = utils.validateFile(this.currentFile);
            if (errors.length > 0) {
                this.showError(errors[0]);
                return;
            }

            try {
                this.isUploading = true;
                this.updateUI();

                const formData = new FormData(this.elements.form);
                
                const response = await fetch(CONFIG.UPLOAD_ENDPOINT, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.job_id) {
                    console.log('Fichier envoyé avec succès');
                    
                    // Redirection avec un petit délai pour l'animation
                    setTimeout(() => {
                        window.location.href = `${CONFIG.PROGRESS_PAGE}?job_id=${data.job_id}`;
                    }, 500);
                } else {
                    throw new Error('Réponse serveur invalide');
                }

            } catch (error) {
                console.error('Upload error:', error);
                this.showError(error.message || 'Erreur lors du téléchargement');
                this.isUploading = false;
                this.updateUI();
            }
        }

        updateFileInput(file) {
            if (this.elements.fileInput) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                this.elements.fileInput.files = dataTransfer.files;
            }
        }

        resetFileInput() {
            this.currentFile = null;
            if (this.elements.fileInput) {
                this.elements.fileInput.value = '';
            }
        }

        updateUI() {
            this.updateDropzone();
            this.updateFileInfo();
            this.updateSubmitButton();
        }

        updateDropzone() {
            if (!this.elements.dropzone) return;

            if (this.isUploading) {
                this.elements.dropzone.innerHTML = `
                    <div class="flex items-center justify-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mr-4"></div>
                        <span class="text-xl font-semibold">Téléchargement en cours...</span>
                    </div>
                `;
                this.elements.dropzone.classList.add('opacity-75', 'cursor-not-allowed');
            } else if (this.currentFile) {
                this.elements.dropzone.innerHTML = `
                    <div class="flex items-center justify-center">
                        <i class="fas fa-check-circle text-4xl mr-4 opacity-80"></i>
                        <div class="text-left">
                            <div class="text-xl font-semibold">Fichier sélectionné</div>
                            <div class="text-sm opacity-90">${this.currentFile.name}</div>
                        </div>
                    </div>
                `;
                this.elements.dropzone.classList.remove('opacity-75', 'cursor-not-allowed');
            } else {
                this.elements.dropzone.innerHTML = `
                    <div class="max-w-md mx-auto">
                        <div class="mb-6">
                            <i class="fas fa-cloud-upload-alt text-6xl mb-4 opacity-80"></i>
                            <h3 class="text-2xl font-semibold mb-2">Déposez votre document ici</h3>
                            <p class="text-lg opacity-90">ou cliquez pour sélectionner un fichier</p>
                        </div>
                        <div class="text-sm opacity-75">
                            <p>Formats acceptés : PDF, DOCX</p>
                            <p>Taille maximale : 25 Mo</p>
                        </div>
                    </div>
                `;
                this.elements.dropzone.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }

        updateFileInfo() {
            if (!this.elements.fileInfo) return;

            if (this.currentFile) {
                if (this.elements.fileName) {
                    this.elements.fileName.textContent = this.currentFile.name;
                }
                if (this.elements.fileSize) {
                    this.elements.fileSize.textContent = utils.formatFileSize(this.currentFile.size);
                }
                this.elements.fileInfo.classList.remove('hidden');
            } else {
                this.elements.fileInfo.classList.add('hidden');
            }
        }

        updateSubmitButton() {
            if (!this.elements.submitBtn) return;

            if (this.isUploading) {
                this.elements.submitBtn.disabled = true;
                this.elements.submitBtn.innerHTML = `
                    <div class="flex items-center justify-center">
                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Traitement en cours...
                    </div>
                `;
            } else if (this.currentFile) {
                this.elements.submitBtn.disabled = false;
                this.elements.submitBtn.innerHTML = `
                    <i class="fas fa-magic mr-2"></i>
                    Anonymiser le document
                `;
            } else {
                this.elements.submitBtn.disabled = true;
                this.elements.submitBtn.innerHTML = `
                    <i class="fas fa-magic mr-2"></i>
                    Anonymiser le document
                `;
            }
        }

        showError(message) {
            if (this.elements.errorMessage && this.elements.errorText) {
                this.elements.errorText.textContent = message;
                this.elements.errorMessage.classList.remove('hidden');
                
                // Animation
                this.animateSlideDown(this.elements.errorMessage);
                
                // Auto-hide après 5 secondes
                setTimeout(() => {
                    this.hideError();
                }, 5000);
            }
            
            this.showNotification(message, 'error');
        }

        hideError() {
            if (this.elements.errorMessage) {
                this.animateSlideUp(this.elements.errorMessage, () => {
                    this.elements.errorMessage.classList.add('hidden');
                });
            }
        }

        showNotification(message, type = 'info') {
            // Créer une notification toast
            const notification = document.createElement('div');
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

            notification.className = `fixed top-4 right-4 p-4 rounded-lg border ${bgMap[type]} shadow-lg max-w-sm z-50 transform translate-x-full opacity-0 transition-all duration-300`;
            notification.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${iconMap[type]} mr-3"></i>
                    <span class="text-gray-800">${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            document.body.appendChild(notification);

            // Animation d'entrée
            requestAnimationFrame(() => {
                notification.classList.remove('translate-x-full', 'opacity-0');
            });

            // Auto-suppression
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.classList.add('translate-x-full', 'opacity-0');
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, 3000);
        }

        // Animations
        animateSlideDown(element) {
            element.style.maxHeight = '0';
            element.style.overflow = 'hidden';
            element.style.transition = 'max-height 0.3s ease-out';
            
            requestAnimationFrame(() => {
                element.style.maxHeight = element.scrollHeight + 'px';
            });
            
            setTimeout(() => {
                element.style.maxHeight = '';
                element.style.overflow = '';
                element.style.transition = '';
            }, 300);
        }

        animateSlideUp(element, callback) {
            element.style.maxHeight = element.scrollHeight + 'px';
            element.style.overflow = 'hidden';
            element.style.transition = 'max-height 0.3s ease-out';
            
            requestAnimationFrame(() => {
                element.style.maxHeight = '0';
            });
            
            setTimeout(() => {
                element.style.maxHeight = '';
                element.style.overflow = '';
                element.style.transition = '';
                if (callback) callback();
            }, 300);
        }

        animateFileAccepted() {
            if (!this.elements.dropzone) return;
            
            // Effet de "pulse" vert pour indiquer l'acceptation
            this.elements.dropzone.classList.add('bg-green-500');
            
            setTimeout(() => {
                this.elements.dropzone.classList.remove('bg-green-500');
            }, 200);
        }
    }

    // Gestionnaire de progression pour les indicateurs visuels
    class ProgressIndicator {
        constructor() {
            this.indicators = [];
            this.init();
        }

        init() {
            // Créer des indicateurs de progression si nécessaire
            this.createProgressRing();
        }

        createProgressRing() {
            const existingRing = document.querySelector('.progress-ring');
            if (existingRing) return;

            // Implementation de l'indicateur de progression circulaire
            // (sera utilisé plus tard si nécessaire)
        }

        show(progress = 0) {
            // Afficher la progression
            this.updateProgress(progress);
        }

        hide() {
            // Masquer l'indicateur
        }

        updateProgress(percent) {
            // Mettre à jour la valeur de progression
            this.indicators.forEach(indicator => {
                if (indicator.update) {
                    indicator.update(percent);
                }
            });
        }
    }

    // Gestionnaire de validation en temps réel
    class ValidationManager {
        constructor(uploadManager) {
            this.uploadManager = uploadManager;
            this.rules = [];
            this.init();
        }

        init() {
            // Règles de validation
            this.rules = [
                {
                    name: 'fileSize',
                    validate: (file) => file.size <= CONFIG.MAX_FILE_SIZE,
                    message: `Taille maximale autorisée: ${utils.formatFileSize(CONFIG.MAX_FILE_SIZE)}`
                },
                {
                    name: 'fileType',
                    validate: (file) => {
                        const ext = utils.getFileExtension(file.name);
                        return CONFIG.ALLOWED_EXTENSIONS.includes(ext);
                    },
                    message: `Formats autorisés: ${CONFIG.ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`
                },
                {
                    name: 'notEmpty',
                    validate: (file) => file.size > 0,
                    message: 'Le fichier ne peut pas être vide'
                }
            ];
        }

        validateFile(file) {
            const results = {
                valid: true,
                errors: [],
                warnings: []
            };

            if (!file) {
                results.valid = false;
                results.errors.push('Aucun fichier sélectionné');
                return results;
            }

            this.rules.forEach(rule => {
                if (!rule.validate(file)) {
                    results.valid = false;
                    results.errors.push(rule.message);
                }
            });

            return results;
        }

        showValidationFeedback(results) {
            // Afficher les résultats de validation à l'utilisateur
            if (!results.valid) {
                results.errors.forEach(error => {
                    this.uploadManager.showError(error);
                });
            }
        }
    }

    // Initialisation principale
    function initializeUploadInterface() {
        // Créer les gestionnaires
        const uploadManager = new FileUploadManager();
        const progressIndicator = new ProgressIndicator();
        const validationManager = new ValidationManager(uploadManager);

        // Gestionnaire d'erreurs globales
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            uploadManager.showNotification('Une erreur inattendue s\'est produite', 'error');
        });

        // Gestionnaire pour les requêtes réseau échouées
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            uploadManager.showNotification('Erreur de connexion réseau', 'error');
        });

        // Prévenir la navigation accidentelle pendant l'upload
        window.addEventListener('beforeunload', (event) => {
            if (uploadManager.isUploading) {
                const message = 'Un téléchargement est en cours. Êtes-vous sûr de vouloir quitter ?';
                event.preventDefault();
                event.returnValue = message;
                return message;
            }
        });

        // Exposer l'interface globalement pour les tests/debug
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.uploadDebug = {
                uploadManager,
                progressIndicator,
                validationManager,
                utils,
                CONFIG
            };
        }

        console.log('Upload interface initialized successfully');
        return uploadManager;
    }

    // Initialiser l'interface une fois le DOM chargé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUploadInterface);
    } else {
        initializeUploadInterface();
    }

})();