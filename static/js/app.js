// Global variables
let currentFileData = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const resultsSection = document.getElementById('resultsSection');
const fileInfo = document.getElementById('fileInfo');
const dataPreview = document.getElementById('dataPreview');
const messageSection = document.getElementById('messageSection');
const processBtn = document.getElementById('processBtn');
const newFileBtn = document.getElementById('newFileBtn');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // Button events
    processBtn.addEventListener('click', processData);
    newFileBtn.addEventListener('click', resetForm);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileSelect({ target: { files: files } });
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
        showMessage('Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv)', 'error');
        return;
    }
    
    uploadFile(file);
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    showMessage('Carregando arquivo...', 'info');
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao carregar arquivo');
        }
        
        currentFileData = data;
        displayFileInfo(data);
        displayDataPreview(data);
        
        resultsSection.style.display = 'block';
        showMessage('Arquivo carregado com sucesso!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
        console.error('Error uploading file:', error);
    }
}

function displayFileInfo(data) {
    fileInfo.innerHTML = `
        <div class="info-item">
            <span class="info-label">Nome do arquivo:</span>
            <span>${data.filename}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Número de linhas:</span>
            <span>${data.rows}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Número de colunas:</span>
            <span>${data.columns}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Colunas:</span>
            <span>${data.column_names.join(', ')}</span>
        </div>
    `;
}

function displayDataPreview(data) {
    if (!data.preview || data.preview.length === 0) {
        dataPreview.innerHTML = '<p>Nenhum dado para visualizar.</p>';
        return;
    }
    
    const columns = data.column_names;
    const rows = data.preview;
    
    let tableHTML = '<table><thead><tr>';
    
    // Table headers
    columns.forEach(col => {
        tableHTML += `<th>${col}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    // Table rows
    rows.forEach(row => {
        tableHTML += '<tr>';
        columns.forEach(col => {
            const value = row[col] !== null && row[col] !== undefined ? row[col] : '';
            tableHTML += `<td>${value}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    dataPreview.innerHTML = tableHTML;
}

async function processData() {
    if (!currentFileData) {
        showMessage('Nenhum arquivo carregado', 'error');
        return;
    }
    
    showMessage('Processando dados...', 'info');
    
    try {
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                operation: 'summary',
                data: currentFileData
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Erro ao processar dados');
        }
        
        showMessage(result.message || 'Dados processados com sucesso!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
        console.error('Error processing data:', error);
    }
}

function resetForm() {
    fileInput.value = '';
    currentFileData = null;
    resultsSection.style.display = 'none';
    fileInfo.innerHTML = '';
    dataPreview.innerHTML = '';
    messageSection.innerHTML = '';
}

function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    messageSection.innerHTML = '';
    messageSection.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds for success/info messages
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}
