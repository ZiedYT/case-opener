// Settings page functionality

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'];

let currentCases = {};
let caseOrder = []; // Track the order of case IDs
let currentEditingCaseId = null;
let currentItems = [];

// --- Initialization ---

window.onload = async () => {
    // Check if user is logged in
    const token = localStorage.getItem('firebaseToken');
    if (!token) {
        alert('Please login first');
        window.location.href = 'index.html';
        return;
    }

    await loadCases();
    renderCases();
};

// --- Navigation ---

function goBack() {
    window.location.href = 'index.html';
}

window.goBack = goBack;

// --- Firebase Helper Functions ---

function getFirebaseCredentials() {
    const token = localStorage.getItem('firebaseToken');
    if (!token) return null;
    
    try {
        const decodedJson = atob(token);
        return JSON.parse(decodedJson);
    } catch (error) {
        console.error('Error decoding Firebase credentials:', error);
        return null;
    }
}

async function getFirebaseAccessToken() {
    const credentials = getFirebaseCredentials();
    if (!credentials) return null;

    // Create JWT for Firebase
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: credentials.client_email,
        sub: credentials.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
    };

    // Note: Full JWT signing requires crypto library
    // For now, we'll use a simpler approach with the private key directly
    return credentials.private_key;
}

// --- Load/Save Cases ---

async function loadCases() {
    const credentials = getFirebaseCredentials();
    if (!credentials) {
        console.error('No Firebase credentials found');
        return;
    }

    const projectId = credentials.project_id;
    const databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/cases.json`;

    try {
        const response = await fetch(databaseURL);
        if (response.ok) {
            const data = await response.json();
            if (data) {
                // Support both array format (new) and object format (old)
                if (Array.isArray(data)) {
                    currentCases = {};
                    caseOrder = []; // Reset and rebuild order
                    const seenIds = new Set(); // Track IDs we've already added
                    data.forEach(caseItem => {
                        if (caseItem.id && !seenIds.has(caseItem.id)) {
                            currentCases[caseItem.id] = caseItem.data;
                            caseOrder.push(caseItem.id); // Track order (only once per ID)
                            seenIds.add(caseItem.id);
                        }
                    });
                } else {
                    currentCases = data;
                    caseOrder = Object.keys(data); // Use object keys as initial order
                }
            }
        } else {
            console.error('Failed to load cases from Firebase:', response.status);
        }
    } catch (error) {
        console.error('Error loading cases:', error);
    }
}

async function saveCasesToStorage() {
    const credentials = getFirebaseCredentials();
    if (!credentials) {
        console.error('No Firebase credentials found. Cannot save cases.');
        return;
    }

    const projectId = credentials.project_id;
    const databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/cases.json`;

    // Build the cases array from caseOrder and currentCases
    const casesArray = [];
    for (const caseId of caseOrder) {
        const caseData = currentCases[caseId];
        if (caseData) {
            casesArray.push({
                id: caseId,
                data: caseData
            });
        }
    }
    
    console.log('=== SAVING TO FIREBASE ===');
    console.log('caseOrder:', caseOrder);
    console.log('Cases to save:', casesArray.length);
    console.log('Full payload:', JSON.stringify(casesArray, null, 2));

    try {
        const response = await fetch(databaseURL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(casesArray)
        });

        if (response.ok) {
            console.log('✓ Cases saved to Firebase successfully');
        } else {
            console.error('✗ Failed to save cases to Firebase:', response.status);
        }
    } catch (error) {
        console.error('✗ Error saving cases:', error);
    }
}

// --- Render Cases List ---

function renderCases() {
    const container = document.getElementById('cases-container');
    console.log('renderCases() called. Current caseOrder:', caseOrder);
    container.innerHTML = '';

    if (caseOrder.length === 0) {
        container.innerHTML = '<p class="settings-empty-msg">No cases created yet. Click "Add New Case" to get started!</p>';
        return;
    }

    caseOrder.forEach((caseId, index) => {
        const caseData = currentCases[caseId];
        if (!caseData) return; // Skip if case data not found
        
        const caseDiv = document.createElement('div');
        caseDiv.className = 'case-entry';
        caseDiv.draggable = true;
        caseDiv.dataset.caseId = caseId;
        caseDiv.id = `case-${caseId}`;
        
        // Add drag event listeners
        caseDiv.addEventListener('dragstart', handleDragStart);
        caseDiv.addEventListener('dragover', handleDragOver);
        caseDiv.addEventListener('drop', handleDrop);
        caseDiv.addEventListener('dragend', handleDragEnd);
        caseDiv.addEventListener('dragleave', handleDragLeave);
        
        caseDiv.innerHTML = `
            <img src="${caseData.image || 'https://placehold.co/80x80/525252/ffffff?text=NO+IMG'}" 
                 alt="${caseData.name}" 
                 class="case-entry-image">
            <div class="case-entry-info">
                <h3 class="case-entry-title">${caseData.name}</h3>
                <p class="case-entry-item-count">Items: ${caseData.items.length}</p>
            </div>
            <div class="button-group-bottom-right">
                ${index > 0 ? `<button class="win95-small-btn" onclick="moveCaseUp(event)" data-case-id="${caseId}" title="Move up">▲</button>` : ''}
                ${index < caseOrder.length - 1 ? `<button class="win95-small-btn" onclick="moveCaseDown(event)" data-case-id="${caseId}" title="Move down">▼</button>` : ''}
            </div>
            <div class="button-group-top-right">
                <button class="win95-small-btn" onclick="editCase(event)" data-case-id="${caseId}" title="Edit">
                    <img src="https://femboy.beauty/11Kwk0" alt="Edit" class="edit-btn-icon">
                </button>
                <button class="delete-inventory-btn" onclick="deleteCase(event)" data-case-id="${caseId}" title="Delete">
                    ✕
                </button>
            </div>
        `;
        container.appendChild(caseDiv);
    });
}

// --- Drag and Drop Functions ---
let draggedElement = null;
let dragStarted = false;

function handleDragStart(e) {
    draggedElement = this;
    dragStarted = true;
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (this !== draggedElement && dragStarted) {
        const allCases = document.querySelectorAll('[data-case-id]');
        const draggedIndex = Array.from(allCases).indexOf(draggedElement);
        const targetIndex = Array.from(allCases).indexOf(this);
        
        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedElement, this);
        }
    }
}

function handleDragLeave(e) {
    if (e.target === this) {
        this.style.backgroundColor = '';
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragStarted = false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    dragStarted = false;
    
    if (draggedElement) {
        // Get the new order from the DOM
        const container = document.getElementById('cases-container');
        const caseDivs = container.querySelectorAll('[data-case-id]');
        const newOrder = Array.from(caseDivs).map(div => div.dataset.caseId);
        
        // Deduplicate in case DOM has duplicates
        const deduplicatedOrder = [...new Set(newOrder)];
        
        // Only update caseOrder if it changed
        if (JSON.stringify(deduplicatedOrder) !== JSON.stringify(caseOrder)) {
            caseOrder = deduplicatedOrder;
            console.log('New order detected and SAVING:', caseOrder);
            saveCasesOrder().then(() => {
                renderCases(); // Re-render to update button visibility
            });
        }
        draggedElement = null;
    }
}

// --- Case Reordering Functions ---
function moveCaseUp(event) {
    const caseId = event.target.closest('button').dataset.caseId;
    const index = caseOrder.indexOf(caseId);
    
    if (index > 0) {
        // Swap in caseOrder array
        [caseOrder[index], caseOrder[index - 1]] = [caseOrder[index - 1], caseOrder[index]];
        renderCases();
        saveCasesOrder();
    }
}

function moveCaseDown(event) {
    const caseId = event.target.closest('button').dataset.caseId;
    const index = caseOrder.indexOf(caseId);
    
    if (index < caseOrder.length - 1) {
        // Swap in caseOrder array
        [caseOrder[index], caseOrder[index + 1]] = [caseOrder[index + 1], caseOrder[index]];
        renderCases();
        saveCasesOrder();
    }
}

function reorderCases(newOrder) {
    const newCases = {};
    newOrder.forEach(caseId => {
        newCases[caseId] = currentCases[caseId];
    });
    currentCases = newCases;
    renderCases();
}

function saveCasesOrder() {
    // Save the current caseOrder
    const casesArray = caseOrder.map(caseId => ({
        id: caseId,
        data: currentCases[caseId]
    }));
    
    console.log('saveCasesOrder() called with:', casesArray.length, 'cases');
    
    // Call async function and return the promise
    return saveCasesToStorage().then(() => {
        console.log('Cases order saved to Firebase');
    }).catch(error => {
        console.error('Error saving cases order:', error);
    });
}

function manualSaveOrder() {
    console.log('Manual save triggered. Current caseOrder:', caseOrder);
    saveCasesOrder();
}

// --- Case Modal Functions ---

function addNewCase() {
    currentEditingCaseId = null;
    currentItems = [];
    
    document.getElementById('case-modal-title').textContent = 'Add New Case';
    document.getElementById('case-name').value = '';
    document.getElementById('case-image').value = '';
    document.getElementById('case-description').value = '';
    
    renderItems();
    showCaseModal();
}

function editCase(event) {
    const caseId = event.target.closest('button').dataset.caseId;
    currentEditingCaseId = caseId;
    const caseData = currentCases[caseId];
    
    document.getElementById('case-modal-title').textContent = 'Edit Case';
    document.getElementById('case-name').value = caseData.name;
    document.getElementById('case-image').value = caseData.image;
    document.getElementById('case-description').value = caseData.description || '';
    
    currentItems = [...caseData.items];
    renderItems();
    showCaseModal();
}

async function deleteCase(event) {
    const caseId = event.target.closest('button').dataset.caseId;
    if (confirm(`Are you sure you want to delete "${currentCases[caseId].name}"?`)) {
        delete currentCases[caseId];
        // Remove from caseOrder
        const index = caseOrder.indexOf(caseId);
        if (index > -1) {
            caseOrder.splice(index, 1);
        }
        await saveCasesToStorage();
        renderCases();
    }
}

function showCaseModal() {
    const modal = document.getElementById('case-modal');
    modal.style.display = 'flex';
}

function closeCaseModal() {
    const modal = document.getElementById('case-modal');
    modal.style.display = 'none';
}

async function saveCase() {
    const caseName = document.getElementById('case-name').value.trim();
    const caseImage = document.getElementById('case-image').value.trim();
    const caseDescription = document.getElementById('case-description').value.trim();
    
    // Generate ID from name
    const caseId = caseName.toLowerCase().replace(/\s+/g, '-');

    // Validation
    if (!caseName) {
        alert('Please fill in Case Name');
        return;
    }

    // Check if this is a new case with duplicate name
    if (!currentEditingCaseId && currentCases[caseId]) {
        alert('A case with this name already exists. Please use a different name.');
        return;
    }

    // Check if editing and new name conflicts with another case
    if (currentEditingCaseId && currentEditingCaseId !== caseId && currentCases[caseId]) {
        alert('A case with this name already exists. Please use a different name.');
        return;
    }

    if (currentItems.length === 0) {
        alert('Please add at least one item to the case');
        return;
    }

    // If editing and name changed, delete the old case entry
    if (currentEditingCaseId && currentEditingCaseId !== caseId) {
        delete currentCases[currentEditingCaseId];
        // Remove from caseOrder
        const oldIndex = caseOrder.indexOf(currentEditingCaseId);
        if (oldIndex > -1) {
            caseOrder.splice(oldIndex, 1);
        }
    }

    // Save case
    const isNewCase = !currentCases[caseId];
    currentCases[caseId] = {
        name: caseName,
        image: caseImage,
        description: caseDescription,
        items: currentItems
    };
    
    // Add to caseOrder if new
    if (isNewCase && !caseOrder.includes(caseId)) {
        caseOrder.push(caseId);
    }

    // Show saving indicator
    const saveBtn = event.target;
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    await saveCasesToStorage();
    
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
    
    closeCaseModal();
    renderCases();
}

// --- Items Management ---

function renderItems() {
    const container = document.getElementById('items-container');
    container.innerHTML = '';

    if (currentItems.length === 0) {
        container.innerHTML = '<p class="settings-empty-msg-small">No items added yet. Click "Add Item" to add items to this case.</p>';
        return;
    }

    currentItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item-entry';
        itemDiv.innerHTML = `
            <div class="item-entry-content">
                <img src="${item.image || 'https://placehold.co/60x60/525252/ffffff?text=?'}" 
                     alt="${item.name}" 
                     class="item-entry-image">
                <div class="item-entry-info">
                    <div style="margin-bottom: 4px;">
                        <h5 class="item-entry-title">${item.name}</h5>
                        <span style="font-size: 10px; padding: 2px 4px; ${getRarityStyle(item.rarity)}">${item.rarity}</span>
                    </div>
                    <p class="item-entry-description">${item.description || 'No description'}</p>
                </div>
                <div class="button-group-top-right">
                    <button onclick="editItem(event)" class="win95-small-btn" data-item-index="${index}" title="Edit"><img src="https://femboy.beauty/11Kwk0" alt="Edit" class="edit-btn-icon"></button>
                    <button class="delete-inventory-btn" onclick="deleteItem(event)" data-item-index="${index}" title="Delete">✕</button>
                </div>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

function getRarityStyle(rarity) {
    const styles = {
        'COMMON': 'background-color: #808080; color: white; border: 1px solid #404040;',
        'UNCOMMON': 'background-color: #0000ff; color: white; border: 1px solid #000080;',
        'RARE': 'background-color: #800080; color: white; border: 1px solid #400040;',
        'LEGENDARY': 'background-color: #ffaa00; color: black; border: 1px solid #cc8800;'
    };
    return styles[rarity] || styles['COMMON'];
}

let currentEditingItemIndex = null;

function addNewItem() {
    currentEditingItemIndex = null;
    
    document.getElementById('item-modal-title').textContent = 'Add New Item';
    document.getElementById('item-name').value = '';
    document.getElementById('item-description').value = '';
    document.getElementById('item-image').value = '';
    document.getElementById('item-rarity').value = 'COMMON';
    
    showItemModal();
}

function editItem(event) {
    const index = parseInt(event.target.closest('button').dataset.itemIndex);
    currentEditingItemIndex = index;
    const item = currentItems[index];
    
    document.getElementById('item-modal-title').textContent = 'Edit Item';
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-description').value = item.description;
    document.getElementById('item-image').value = item.image;
    document.getElementById('item-rarity').value = item.rarity;
    
    showItemModal();
}

function deleteItem(event) {
    const index = parseInt(event.target.closest('button').dataset.itemIndex);
    if (confirm('Delete this item?')) {
        currentItems.splice(index, 1);
        renderItems();
    }
}

function showItemModal() {
    const modal = document.getElementById('item-modal');
    modal.style.display = 'flex';
}

function closeItemModal() {
    const modal = document.getElementById('item-modal');
    modal.style.display = 'none';
}

function saveItem() {
    const name = document.getElementById('item-name').value.trim();
    const description = document.getElementById('item-description').value.trim();
    const image = document.getElementById('item-image').value.trim();
    const rarity = document.getElementById('item-rarity').value;

    // Validation
    if (!name) {
        alert('Please enter an item name');
        return;
    }

    const itemData = {
        name: name,
        description: description || '',
        image: image || '',
        rarity: rarity
    };

    if (currentEditingItemIndex !== null) {
        // Edit existing item
        currentItems[currentEditingItemIndex] = itemData;
    } else {
        // Add new item
        currentItems.push(itemData);
    }

    renderItems();
    closeItemModal();
}

// Make functions globally accessible
window.addNewCase = addNewCase;
window.editCase = editCase;
window.deleteCase = deleteCase;
window.closeCaseModal = closeCaseModal;
window.saveCase = saveCase;
window.addNewItem = addNewItem;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.showItemModal = showItemModal;
window.closeItemModal = closeItemModal;
window.saveItem = saveItem;
