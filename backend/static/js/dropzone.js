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
                this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
            }  
            // Dropzone
            if (this.elements.dropzone) {
                this.elements.dropzone.addEventListener('dragover', this.handleDragOver.bind(this));
                this.elements.dropzone.addEventListener('drop', this.handleDrop.bind(this));
            }
            // Remove button
            if (this.elements.removeBtn) {
                this.elements.removeBtn.addEventListener('click', this.handleRemoveFile.bind(this));
            }
            // Form submission
            if (this.elements.form) {
                this.elements.form.addEventListener('submit', this.handleSubmit.bind(this));
            }   
            // Debounced resize handler
            window.addEventListener('resize', utils.debounce(this.updateUI.bind(this), 100));
            // Initial UI update
            this.updateUI();
        }
        handleModeChange(event) {
            const mode = event.target.value;
            if (mode === 'anonymize') {
                this.elements.confidenceSection.style.display = 'block';
            } else {
                this.elements.confidenceSection.style.display = 'none';
            }
        }
        handleConfidenceChange(event) {
            const value = event.target.value;
            this.elements.confidenceValue.textContent = value;
        }
        handleFileSelect(event) {
            const file = event.target.files[0];
            this.setCurrentFile(file);
        }
        handleDragOver(event) {
            event.preventDefault();
            this.elements.dropzone.classList.add('dragover');
        }
        handleDrop(event) {
            event.preventDefault();
            this.elements.dropzone.classList.remove('dragover');
            const file = event.dataTransfer.files[0];
            this.setCurrentFile(file);
        }
        handleRemoveFile() {
            this.setCurrentFile(null);
        }
        setCurrentFile(file) {
            this.currentFile = file;
            this.updateUI();
        }
        updateUI() {
            if (this.currentFile) {
                const errors = utils.validateFile(this.currentFile);
                if (errors.length > 0) {
                    this.showError(errors.join('<br>'));
                    this.elements.fileInfo.style.display = 'none';
                } else {
                    this.showFileInfo();
                }
            } else {
                this.clearFileInfo();
            }
        }
        showFileInfo() {
            this.elements.fileName.textContent = this.currentFile.name;
            this.elements.fileSize.textContent = utils.formatFileSize(this.currentFile.size);
            this.elements.fileInfo.style.display = 'block';
            this.elements.errorMessage.style.display = 'none';
        }           
        clearFileInfo() {
            this.elements.fileName.textContent = '';
            this.elements.fileSize.textContent = '';
            this.elements.fileInfo.style.display = 'none';
            this.elements.errorMessage.style.display = 'none';
        }       

        showError(message) {
            this.elements.errorText.innerHTML = message;
            this.elements.errorMessage.style.display = 'block';
            this.elements.fileInfo.style.display = 'none';
        }