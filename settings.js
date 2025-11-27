// Settings page functionality

const RARITIES = ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'];

let currentCases = {};
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
            currentCases = data || {};
        } else {
            console.error('Failed to load cases from Firebase:', response.status);
            // Fallback to localStorage
            const saved = localStorage.getItem('customCases');
            if (saved) {
                currentCases = JSON.parse(saved);
            }
        }
    } catch (error) {
        console.error('Error loading cases:', error);
        // Fallback to localStorage
        const saved = localStorage.getItem('customCases');
        if (saved) {
            currentCases = JSON.parse(saved);
        }
    }
}

async function saveCasesToStorage() {
    const credentials = getFirebaseCredentials();
    if (!credentials) {
        console.error('No Firebase credentials found');
        // Fallback to localStorage
        localStorage.setItem('customCases', JSON.stringify(currentCases));
        return;
    }

    const projectId = credentials.project_id;
    const databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/cases.json`;

    try {
        const response = await fetch(databaseURL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentCases)
        });

        if (response.ok) {
            console.log('Cases saved to Firebase successfully');
            // Also save to localStorage as backup
            localStorage.setItem('customCases', JSON.stringify(currentCases));
        } else {
            console.error('Failed to save cases to Firebase:', response.status);
            // Fallback to localStorage
            localStorage.setItem('customCases', JSON.stringify(currentCases));
        }
    } catch (error) {
        console.error('Error saving cases:', error);
        // Fallback to localStorage
        localStorage.setItem('customCases', JSON.stringify(currentCases));
    }
}

// --- Render Cases List ---

function renderCases() {
    const container = document.getElementById('cases-container');
    container.innerHTML = '';

    if (Object.keys(currentCases).length === 0) {
        container.innerHTML = '<p class="text-gray-400 italic">No cases created yet. Click "Add New Case" to get started!</p>';
        return;
    }

    Object.entries(currentCases).forEach(([caseId, caseData]) => {
        const caseDiv = document.createElement('div');
        caseDiv.className = 'bg-gray-700 rounded-lg p-4 flex items-center gap-4';
        caseDiv.innerHTML = `
            <img src="${caseData.image || 'https://placehold.co/80x80/525252/ffffff?text=NO+IMG'}" 
                 alt="${caseData.name}" 
                 class="w-20 h-20 rounded-lg object-cover">
            <div class="flex-1">
                <h3 class="text-lg font-semibold text-white">${caseData.name}</h3>
                <p class="text-sm text-gray-400">Items: ${caseData.items.length}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="editCase('${caseId}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition">
                    Edit
                </button>
                <button onclick="deleteCase('${caseId}')" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded transition">
                    Delete
                </button>
            </div>
        `;
        container.appendChild(caseDiv);
    });
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

function editCase(caseId) {
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

async function deleteCase(caseId) {
    if (confirm(`Are you sure you want to delete "${currentCases[caseId].name}"?`)) {
        delete currentCases[caseId];
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
    }

    // Save case
    currentCases[caseId] = {
        name: caseName,
        image: caseImage,
        description: caseDescription,
        items: currentItems
    };

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
        container.innerHTML = '<p class="text-gray-400 italic text-sm">No items added yet. Click "Add Item" to add items to this case.</p>';
        return;
    }

    currentItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bg-gray-900 rounded-lg p-3 border-2 border-gray-600';
        itemDiv.innerHTML = `
            <div class="flex items-start gap-3">
                <img src="${item.image || 'https://placehold.co/60x60/525252/ffffff?text=?'}" 
                     alt="${item.name}" 
                     class="w-16 h-16 rounded object-cover flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h5 class="text-white font-semibold">${item.name}</h5>
                            <span class="text-xs px-2 py-0.5 rounded ${getRarityColor(item.rarity)}">${item.rarity}</span>
                        </div>
                        <div class="flex gap-1">
                            <button onclick="editItem(${index})" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">Edit</button>
                            <button onclick="deleteItem(${index})" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Delete</button>
                        </div>
                    </div>
                    <p class="text-gray-400 text-sm">${item.description || 'No description'}</p>
                </div>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

function getRarityColor(rarity) {
    const colors = {
        'COMMON': 'bg-gray-600 text-gray-200',
        'UNCOMMON': 'bg-blue-600 text-blue-200',
        'RARE': 'bg-purple-600 text-purple-200',
        'LEGENDARY': 'bg-yellow-600 text-yellow-200'
    };
    return colors[rarity] || 'bg-gray-600 text-gray-200';
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

function editItem(index) {
    currentEditingItemIndex = index;
    const item = currentItems[index];
    
    document.getElementById('item-modal-title').textContent = 'Edit Item';
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-description').value = item.description;
    document.getElementById('item-image').value = item.image;
    document.getElementById('item-rarity').value = item.rarity;
    
    showItemModal();
}

function deleteItem(index) {
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
