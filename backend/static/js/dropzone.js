document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const form = document.getElementById('upload-form');
    const errorMessage = document.getElementById('error-message');
    const slider = document.getElementById('confidence');
    const output = document.getElementById('confidence-value');

    slider.addEventListener('input', () => {
        output.textContent = parseFloat(slider.value).toFixed(2);
    });

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropzone.classList.add('hover');
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('hover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('hover');
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            handleFile(file);
        }
    });

    function handleFile(file) {
        if (file.size > 25 * 1024 * 1024) {
            fileInput.value = '';
            errorMessage.textContent = 'Le fichier dépasse la taille maximale de 25 Mo.';
            return;
        }
        errorMessage.textContent = '';
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) {
            errorMessage.textContent = 'Veuillez sélectionner un fichier.';
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            errorMessage.textContent = 'Le fichier dépasse la taille maximale de 25 Mo.';
            return;
        }
        const formData = new FormData(form);
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.job_id) {
            window.location.href = `/progress?job_id=${data.job_id}`;
        }
    });
});
