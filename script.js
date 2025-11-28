// --- Win95 Popup Window Logic ---
let currentPopupCaseId = null;

function openCaseWindow(caseId) {
    currentPopupCaseId = caseId;
    const caseData = CASES[caseId];
    if (!caseData) return;

    // Set title
    document.getElementById('case-popup-title').textContent = caseData.name;
    // Set description (preserve newlines)
    const descElement = document.getElementById('popup-case-description');
    descElement.textContent = caseData.description || '';
    descElement.style.whiteSpace = 'pre-wrap';

    // Enable open button
    const openBtn = document.getElementById('popup-open-case-btn');
    openBtn.disabled = false;
    openBtn.textContent = 'Open Case';

    // Clear previous result
    document.getElementById('popup-rolled-result').textContent = '';

    // Generate roller
    const rollerContainer = document.getElementById('popup-raffle-roller-container');
    rollerContainer.innerHTML = '';
    const caseItems = caseData.items || caseData.games || [];
    const winningGame = selectWinningItem(caseItems);
    generateRoller(caseItems,winningGame);
    // Restore available items listing in popup
    updateAvailableItemsList(caseItems);

    // Mark selected icon visually
    document.querySelectorAll('.win95-desktop-icon').forEach(icon => icon.classList.remove('selected'));
    const selectedIcon = document.getElementById(`case-icon-${caseId}`);
    if (selectedIcon) selectedIcon.classList.add('selected');
    // Show popup with fade-in transition
    const caseWindow = document.getElementById('case-popup-window');
    caseWindow.style.display = 'flex';
    setTimeout(() => {
        caseWindow.classList.remove('opacity-0');
    }, 10);
}

function closeCasePopupWindow() {
    const caseWindow = document.getElementById('case-popup-window');
    caseWindow.classList.add('opacity-0');
    setTimeout(() => {
        caseWindow.style.display = 'none';
        currentPopupCaseId = null;
        document.querySelectorAll('.win95-desktop-icon').forEach(icon => icon.classList.remove('selected'));
    }, 300);
}



// Popup roll logic
function startRoll() {
    if (!currentPopupCaseId) return;
    const openBtn = document.getElementById('popup-open-case-btn');
    openBtn.disabled = true;
    openBtn.textContent = 'Rolling...';
    document.getElementById('popup-rolled-result').textContent = 'Rolling...';
    const caseData = CASES[currentPopupCaseId];
    const caseItems = caseData.items || caseData.games || [];
    const winningGame = selectWinningItem(caseItems);
    generateRoller(caseItems, winningGame);
    const rollerContainer = document.getElementById('popup-raffle-roller-container');
    const containerWidth = rollerContainer.parentElement.clientWidth;
    const targetCenterOffset = (WIN_SLOT_INDEX * ITEM_FULL_WIDTH) + (ITEM_FULL_WIDTH / 2);
    const RANDOM_WIGGLE = randomInt(-ITEM_FULL_WIDTH/4, ITEM_FULL_WIDTH/4) ;
    const FINAL_TRANSLATION_PX = targetCenterOffset - (containerWidth / 2) + RANDOM_WIGGLE;
    void rollerContainer.offsetHeight;
    setTimeout(() => {
        rollerContainer.style.transition = 'transform 6300ms cubic-bezier(0.23, 1, 0.32, 1)';
        rollerContainer.style.transform = `translateX(-${FINAL_TRANSLATION_PX}px)`;
        playRollSound();
    }, 50);
    setTimeout(() => {
        document.getElementById('popup-rolled-result').textContent = `You unboxed: ${winningGame.name}!`;
        const winCard = document.getElementById('CardNumber'+WIN_SLOT_INDEX);
        if(winCard) {
            winCard.classList.add('winning-item');
        }

        openBtn.disabled = false;
        openBtn.textContent = 'Open Again';
        inventory.push(winningGame);
        renderInventory();
        saveInventoryToFirebase();
        showPlayModal(winningGame);

    }, 6300);
}

window.openCaseWindow = openCaseWindow;
window.closeCasePopupWindow = closeCasePopupWindow;
window.popupStartRoll = startRoll;
// --- Game Data and Logic ---

// Game Rarity Structure
const RARITIES = {
    COMMON: { name: "Common", weight: 450, color: "rarity-common" }, // 45%
    UNCOMMON: { name: "Uncommon", weight: 350, color: "rarity-uncommon" }, // 35%
    RARE: { name: "Rare", weight: 150, color: "rarity-rare" }, // 15%
    LEGENDARY: { name: "Legendary", weight: 50, color: "rarity-legendary" } // 5%
};
const TOTAL_WEIGHT = Object.values(RARITIES).reduce((sum, r) => sum + r.weight, 0);
const WIN_SLOT_INDEX = 167;
const ITEM_FULL_WIDTH = 200;

// Case Definitions (will be populated from Firebase)
const CASES = {};
let caseOrder = []; // Track the order of case IDs from Firebase

// DOM Elements
const inventoryContainer = document.getElementById('inventory');
const emptyInventoryMsg = document.getElementById('empty-inventory-msg');

// State
let inventory = []; // Stores unboxed game objects
let rollSound = null; // Audio object for roll sound

// --- Utility Functions ---

/**
 * Generates a random integer between min (inclusive) and max (exclusive).
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Selects a random item from a pool based on rarity weights.
 * @param {Array<Object>} pool - Array of game objects with rarity property
 * @returns {Object} The selected game object.
 */
function selectItemByRarity(pool) {
    // Calculate total weight
    const totalWeight = pool.reduce((sum, item) => sum + item.rarity.weight, 0);
    
    // Pick a random number between 0 and totalWeight
    let random = Math.random() * totalWeight;
    
    // Find the item that corresponds to this weight
    for (const item of pool) {
        random -= item.rarity.weight;
        if (random <= 0) {
            return item;
        }
    }
    
    // Fallback (should never reach here)
    return pool[0];
}

/**
 * Selects a random game from a given pool based on rarity weights.
 * This is the crucial function for determining the winning game based on odds.
 * @param {Array<number>|Array<Object>} itemsIds - Array of item objects for custom cases
 * @returns {Object} The winning game object.
 */
function selectWinningItem(itemsIds) {
    // Check if this is a custom case with item objects
    if (itemsIds.length > 0 && typeof itemsIds[0] === 'object' && itemsIds[0].name) {
        // Custom case: items are objects with name, rarity, etc.
        // Convert rarity strings to RARITIES objects
        const pool = itemsIds.map(item => ({
            ...item,
            rarity: RARITIES[item.rarity] || RARITIES.COMMON
        }));
        return selectItemByRarity(pool);
    }
}

// --- UI / Game Flow Functions ---



/**
 * Updates the available items list panel
 * @param {Array<number>|Array<Object>} items - Array of game IDs or item objects
 */
function updateAvailableItemsList(items) {
    const listContainer = document.getElementById('available-items-list');
    listContainer.innerHTML = '';
    
    let availableGames = [];
    
    // Check if custom case (objects) or default case (IDs)
    if (items.length > 0 && typeof items[0] === 'object' && items[0].name) {
        // Custom case: convert and get unique items
        const uniqueItems = [];
        const seenNames = new Set();
        items.forEach(item => {
            if (!seenNames.has(item.name)) {
                seenNames.add(item.name);
                uniqueItems.push({
                    ...item,
                    rarity: RARITIES[item.rarity] || RARITIES.COMMON
                });
            }
        });
        availableGames = uniqueItems;
    }
    
    // Sort by rarity weight (legendary first)
    availableGames.sort((a, b) => a.rarity.weight - b.rarity.weight);
    
    // Count items by rarity to calculate individual odds
    const rarityItemCounts = {};
    availableGames.forEach(game => {
        const rarityKey = game.rarity.name;
        rarityItemCounts[rarityKey] = (rarityItemCounts[rarityKey] || 0) + 1;
    });
    
    // Calculate total pool weight (sum of all item weights)
    let totalPoolWeight = 0;
    availableGames.forEach(game => {
        const itemsWithRarity = rarityItemCounts[game.rarity.name];
        const weightPerItem = game.rarity.weight / itemsWithRarity;
        totalPoolWeight += weightPerItem;
    });
    
    availableGames.forEach(game => {
        const itemCard = document.createElement('div');
        itemCard.className = `available-item-card ${game.rarity.color}`;
        itemCard.onclick = () => showPlayModal(game);
        itemCard.style.cursor = 'pointer';
        
        // Calculate the actual odds for this specific item
        const itemsWithRarity = rarityItemCounts[game.rarity.name];
        const weightPerItem = game.rarity.weight / itemsWithRarity;
        const itemPercentage = (weightPerItem / totalPoolWeight) * 100;
        // Calculate 1 in x based on weight: if item has weight 225 out of 1000, then 1000/225 = 1 in 4.44
        const oddsFraction = totalPoolWeight / weightPerItem;
        const oddsRounded = Math.ceil(oddsFraction * 2) / 2; // Round up to nearest 0.5
        const rarityText = `${game.rarity.name}: 1 in ${oddsRounded} (${itemPercentage.toFixed(1)}%)`;
        
        itemCard.innerHTML = `
            <img src="${game.image}" alt="${game.name}">
            <div class="available-item-info">
                <div class="name">${game.name}</div>
                <div class="rarity">${rarityText}</div>
            </div>
        `;
        listContainer.appendChild(itemCard);
    });
}

/**
 * Generates and populates the roller items.
 * @param {Array<number>|Array<Object>} items - The pool of available game IDs or item objects
 * @param {Object} [winningGame=null] - The game that will be placed at the winning slot
 */
function generateRoller(items, winningGame) {
    const rollerContainer = document.getElementById('popup-raffle-roller-container');
    
    if (!rollerContainer) {
        console.error('Popup roller container not found!');
        return;
    }
    
    rollerContainer.innerHTML = '';
    
    // Convert items to game objects
    let gamePool = [];
    if (items.length > 0 && typeof items[0] === 'object' && items[0].name) {
        // Custom case: items are already objects
        gamePool = items.map(item => ({
            ...item,
            rarity: RARITIES[item.rarity] || RARITIES.COMMON
        }));
    }
    
    const ITEMS_TO_GENERATE = WIN_SLOT_INDEX + 20;

    // Clear winning highlight
    document.querySelectorAll('.winning-item').forEach(el => el.classList.remove('winning-item'));

    for (let i = 0; i < ITEMS_TO_GENERATE; i++) {
        let item;
        
        // Place the winning item at the predetermined slot
        if (i === WIN_SLOT_INDEX && winningGame) {
            item = winningGame;
            console.log("Placing winner at index:", WIN_SLOT_INDEX);
            console.log("Winner item:", winningGame);
        } else {
            // Pick a random filler item based on rarity weights
            item = selectItemByRarity(gamePool);
        }
        
        const itemDiv = document.createElement('div');
        itemDiv.id = `CardNumber${i}`;
        itemDiv.className = `item shadow-lg ${item.rarity.color}`;
        
        // Add the image and name (rarity color applied to name via CSS class)
        itemDiv.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="item-image">
            <span class="item-name text-xs font-semibold mt-1 leading-none">${item.name}</span>
        `;

        rollerContainer.appendChild(itemDiv);
    }

    // Reset position to start (left edge visible)
    rollerContainer.style.transition = 'none';
    rollerContainer.style.transform = 'translateX(0px)'; 
}



/**
 * Renders the current user inventory.
 */
function deleteInventoryItem(index) {
    if (index >= 0 && index < inventory.length) {
        inventory.splice(index, 1);
        renderInventory();
        saveInventoryToFirebase();
    }
}

function renderInventory() {
    inventoryContainer.innerHTML = '';
    if (inventory.length === 0) {
        emptyInventoryMsg.style.display = 'block';
        return;
    }
    emptyInventoryMsg.style.display = 'none';

    inventory.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `inventory-item ${item.rarity.color}`;
        itemDiv.title = item.name;
        itemDiv.style.position = 'relative';
        itemDiv.onclick = () => showPlayModal(item);
        
        itemDiv.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="inventory-item-info">
                <div class="name">${item.name}</div>
                <div class="rarity">${item.rarity.name}</div>
            </div>
            <button class="delete-inventory-btn" onclick="event.stopPropagation(); deleteInventoryItem(${index});" title="Remove item">
                ×
            </button>
        `;
        inventoryContainer.appendChild(itemDiv);
    });
}

// --- Sound Functions ---

/**
 * Plays the roll sound when case opening starts
 */
function playRollSound() {
    // Create audio object if it doesn't exist
    if (!rollSound) {
        rollSound = new Audio('sound.mp3');
        rollSound.volume = 0.5; // Set volume to 50%
    }
    
    // Reset and play the sound
    rollSound.currentTime = 0;
    rollSound.play().catch(e => console.log('Audio play failed:', e));
}

// --- Modal Functions ---

function showPlayModal(game) {
    
    const modal = document.getElementById('play-modal');
    const modalTitle = document.getElementById('play-modal-title');
    const details = document.getElementById('play-game-details');
    
    // Update the title bar with the game name
    modalTitle.textContent = game.name;
    
    // Trim description to remove leading/trailing whitespace but preserve internal newlines
    const description = (game.description || 'No description available').trim();
    
    details.innerHTML = `
        <div class="flex flex-col items-center">
            <img src="${game.image}" alt="${game.name}" class="w-24 h-24 mb-4 border-2 ${game.rarity.color}">
            <div id="description-box" class="w-full min-h-24 flex items-center justify-center text-sm p-4" style="background-color: var(--win95-white); border: 2px inset var(--win95-dark-gray); white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word;">
            </div>
        </div>
    `;
    
    // Set description using textContent to preserve newlines without HTML interpretation
    document.getElementById('description-box').textContent = description;
    
    // Show with transition
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

function closePlayModal() {
    const modal = document.getElementById('play-modal');
    // Hide with transition
    modal.classList.add('opacity-0');
    modal.querySelector('.modal-content').classList.remove('scale-100');
    modal.querySelector('.modal-content').classList.add('scale-95');
    setTimeout(() => modal.style.display = 'none', 300);
}

// --- Cookie Management ---

/**
 * Set a value in localStorage
 */
function setCookie(name, value, days) {
    // Using localStorage instead of cookies (works with file:// protocol)
    localStorage.setItem(name, value);
}

/**
 * Get a value from localStorage
 */
function getCookie(name) {
    // Using localStorage instead of cookies (works with file:// protocol)
    return localStorage.getItem(name);
}

/**
 * Delete a value from localStorage
 */
function deleteCookie(name) {
    localStorage.removeItem(name);
}

// --- Login Modal Functions ---

function showLoginModal() {
    const modal = document.getElementById('login-modal');
    const token = getCookie('firebaseToken');
    const projectId = getCookie('firebaseProjectId');
    const loginContent = document.getElementById('login-content');
    const loggedInContent = document.getElementById('logged-in-content');
    const modalTitle = document.getElementById('login-modal-title');
    
    if (token && projectId) {
        // User is logged in
        loginContent.classList.add('hidden');
        loggedInContent.classList.remove('hidden');
        modalTitle.textContent = 'Settings';
        document.getElementById('project-id-display').textContent = projectId;
    } else {
        // User is not logged in
        loginContent.classList.remove('hidden');
        loggedInContent.classList.add('hidden');
        modalTitle.textContent = 'Login';
        const input = document.getElementById('firebase-token-input');
        const statusDiv = document.getElementById('login-status');
        input.value = '';
        statusDiv.classList.add('hidden');
        // Focus input after showing
        setTimeout(() => input.focus(), 100);
    }
    
    // Show with transition
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    // Hide with transition
    modal.classList.add('opacity-0');
    modal.querySelector('.modal-content').classList.remove('scale-100');
    modal.querySelector('.modal-content').classList.add('scale-95');
    setTimeout(() => modal.style.display = 'none', 300);
}

function handleLogout() {
    // Clear cookies
    setCookie('firebaseToken', '', -1);
    setCookie('firebaseProjectId', '', -1);
    
    // Clear cases
    Object.keys(CASES).forEach(key => delete CASES[key]);
    
    // Re-render
    renderCaseCards();
    closeLoginModal();
}

async function handleLogin() {
    const input = document.getElementById('firebase-token-input');
    const base64Token = input.value.trim();
    const statusDiv = document.getElementById('login-status');
    
    if (!base64Token) {
        showLoginStatus('Please enter a Base64 encoded private key', false);
        return;
    }
    
    try {
        // Show loading status
        showLoginStatus('Validating credentials...', null);
        
        // Decode base64 to get JSON private key
        const decodedJson = atob(base64Token);
        const privateKey = JSON.parse(decodedJson);
        
        // Validate that it's a Firebase private key
        if (!privateKey.project_id || !privateKey.private_key || !privateKey.client_email) {
            showLoginStatus('Invalid Firebase private key format', false);
            return;
        }
        
        // Validate project ID format
        const projectId = privateKey.project_id;
        
        // Simple validation: just check if the credentials look valid and save them
        // Actual Firebase authentication will happen when you use the credentials
        if (projectId && projectId.length > 0) {
            // Save the base64 token in cookie (expires in 30 days)
            setCookie('firebaseToken', base64Token, 30);
            setCookie('firebaseProjectId', projectId, 30);
            
            showLoginStatus('✓ Credentials saved successfully!', true);
            
            // Load cases from Firebase
            await loadCustomCasesFromFirebase();
            
            // Load inventory from Firebase
            await loadInventoryFromFirebase();
            
            // Render inventory and cases
            renderInventory();
            renderCaseCards();
            
            // Update the modal to show logged in state
            const loginContent = document.getElementById('login-content');
            const loggedInContent = document.getElementById('logged-in-content');
            const modalTitle = document.getElementById('login-modal-title');
            loginContent.classList.add('hidden');
            loggedInContent.classList.remove('hidden');
            modalTitle.textContent = 'Settings';
            document.getElementById('project-id-display').textContent = projectId;

        } else {
            showLoginStatus('Invalid project ID in credentials.', false);
        }
    } catch (error) {
        console.error('Login error:', error);
        if (error.name === 'InvalidCharacterError') {
            showLoginStatus('Invalid Base64 encoding. Please check your input.', false);
        } else if (error instanceof SyntaxError) {
            showLoginStatus('Invalid JSON format in decoded key.', false);
        } else {
            showLoginStatus('Connection error. Please try again.', false);
        }
    }
}
/**
 * Shows login status message
 * @param {string} message - Status message to display
 * @param {boolean|null} isSuccess - true for success, false for error, null for loading
 */
function showLoginStatus(message, isSuccess) {
    const statusDiv = document.getElementById('login-status');
    statusDiv.textContent = message;
    statusDiv.classList.remove('hidden', 'bg-green-900', 'text-green-300', 'bg-red-900', 'text-red-300', 'bg-blue-900', 'text-blue-300');
    
    if (isSuccess === true) {
        statusDiv.classList.add('bg-green-900', 'text-green-300');
    } else if (isSuccess === false) {
        statusDiv.classList.add('bg-red-900', 'text-red-300');
    } else {
        statusDiv.classList.add('bg-blue-900', 'text-blue-300');
    }
}

function checkLoginStatus() {
    const token = getCookie('firebaseToken');
    const projectId = getCookie('firebaseProjectId');
    // Debug: Print localStorage values to console
    console.log('Firebase Token (localStorage):', token);
    console.log('Firebase Project ID (localStorage):', projectId);
    console.log('All localStorage:', { ...localStorage });
}

/**
 * Gets the decoded Firebase credentials from cookies
 * @returns {Object|null} Firebase credentials object or null if not logged in
 */
function getFirebaseCredentials() {
    const token = getCookie('firebaseToken');
    if (!token) return null;
    
    try {
        const decodedJson = atob(token);
        return JSON.parse(decodedJson);
    } catch (error) {
        console.error('Error decoding Firebase credentials:', error);
        return null;
    }
}

/**
 * Navigate to settings page
 */
function goToSettings() {
    window.location.href = 'settings.html';
}

// Make functions globally accessible
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.goToSettings = goToSettings;

// --- Load Custom Cases from Firebase ---

async function loadCustomCasesFromFirebase() {
    const credentials = getFirebaseCredentials();
    if (!credentials) {
        console.log('No Firebase credentials found. Please login to load cases.');
        renderCaseCards(); // Still render to show "no cases" message
        return;
    }

    const projectId = credentials.project_id;
    const databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/cases.json`;
    console.log('Loading cases from:', databaseURL);

    try {
        const response = await fetch(databaseURL);
        console.log('Firebase response status:', response.status);
        
        if (response.ok) {
            const customCases = await response.json();
            console.log('Raw response from Firebase:', customCases);
            
            if (customCases) {
                // Handle both array format (new) and object format (old)
                if (Array.isArray(customCases)) {
                    // New array format with order preservation
                    const orderedCases = {};
                    caseOrder = []; // Reset and rebuild order
                    customCases.forEach(caseItem => {
                        if (caseItem.id && caseItem.data) {
                            orderedCases[caseItem.id] = caseItem.data;
                            caseOrder.push(caseItem.id); // Track order
                        }
                    });
                    Object.assign(CASES, orderedCases);
                } else if (typeof customCases === 'object' && Object.keys(customCases).length > 0) {
                    // Old object format
                    Object.assign(CASES, customCases);
                    caseOrder = Object.keys(customCases); // Use object keys as initial order
                }
                console.log('Successfully loaded cases:', Object.keys(CASES));
                console.log('Case order:', caseOrder);
            } else {
                console.log('No cases found in Firebase database');
                caseOrder = [];
            }
        } else {
            console.error('Failed to fetch cases from Firebase. Status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
        }
    } catch (error) {
        console.error('Error loading custom cases from Firebase:', error);
    }
    
    console.log('Final CASES object:', CASES);
    // Always render after attempting to load
    renderCaseCards();
}

async function saveInventoryToFirebase() {
    const credentials = getFirebaseCredentials();
    if (!credentials) {
        console.log('No Firebase credentials. Inventory not synced.');
        return;
    }

    const projectId = credentials.project_id;
    const databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/inventory.json`;

    try {
        const response = await fetch(databaseURL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inventory)
        });

        if (response.ok) {
            console.log('Inventory saved to Firebase');
        } else {
            console.error('Failed to save inventory to Firebase:', response.status);
        }
    } catch (error) {
        console.error('Error saving inventory to Firebase:', error);
    }
}

async function loadInventoryFromFirebase() {
    const credentials = getFirebaseCredentials();
    if (!credentials) {
        console.log('No Firebase credentials. No inventory to load.');
        return;
    }

    const projectId = credentials.project_id;
    const databaseURL = `https://${projectId}-default-rtdb.firebaseio.com/inventory.json`;
    console.log('Loading inventory from:', databaseURL);

    try {
        const response = await fetch(databaseURL);
        console.log('Inventory response status:', response.status);
        
        if (response.ok) {
            const firebaseInventory = await response.json();
            console.log('Raw inventory from Firebase:', firebaseInventory);
            
            if (firebaseInventory && Array.isArray(firebaseInventory) && firebaseInventory.length > 0) {
                inventory = firebaseInventory;
                console.log('Loaded inventory from Firebase:', inventory.length, 'items');
                renderInventory();
            } else {
                console.log('No inventory found in Firebase');
            }
        } else if (response.status === 401) {
            console.warn('Firebase 401 error. Cannot load inventory. Update Firebase rules.');
        } else {
            console.error('Failed to load inventory from Firebase:', response.status);
        }
    } catch (error) {
        console.error('Error loading inventory from Firebase:', error);
    }
}

function renderCaseCards() {
    const desktopIconsArea = document.getElementById('desktop-icons-area');
    if (!desktopIconsArea) return;

    desktopIconsArea.innerHTML = '';

    // Add Login icon first
    const loginIconDiv = document.createElement('div');
    loginIconDiv.id = 'login-icon';
    loginIconDiv.className = 'win95-desktop-icon cursor-pointer select-none';
    loginIconDiv.onclick = () => showLoginModal();
    loginIconDiv.innerHTML = `
        <div class="win95-icon-bg" style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;">
            <img src="https://femboy.beauty/FCGiKh" alt="Login" style="width:48px;height:48px;object-fit:cover;">
        </div>
        <span class="win95-icon-label">Settings</span>
    `;
    desktopIconsArea.appendChild(loginIconDiv);

    // Check if there are any cases
    if (caseOrder.length === 0) {
        return;
    }

    // Render cases in the order specified by caseOrder
    caseOrder.forEach(caseId => {
        const caseData = CASES[caseId];
        if (!caseData) return; // Skip if case data not found
        
        const iconDiv = document.createElement('div');
        iconDiv.id = `case-icon-${caseId}`;
        iconDiv.className = 'win95-desktop-icon cursor-pointer select-none';
        iconDiv.setAttribute('data-case-id', caseId);
        iconDiv.onclick = () => openCaseWindow(caseId);

        iconDiv.innerHTML = `
            <div class="win95-icon-bg" style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;">
                <img src="${caseData.image || 'https://placehold.co/64x64/525252/ffffff?text=CASE'}" alt="${caseData.name}" style="width:48px;height:48px;object-fit:cover;">
            </div>
            <span class="win95-icon-label">${caseData.name}</span>
        `;

        desktopIconsArea.appendChild(iconDiv);
    });
}

// --- Initialization ---

window.onload = async () => {
    // Check login status on page load
    checkLoginStatus();
    
    // Load custom cases from Firebase
    await loadCustomCasesFromFirebase();
    
    // Load inventory from Firebase
    await loadInventoryFromFirebase();
    
    renderInventory();
    
    // Add event listeners to close modals when clicking the backdrop
    document.getElementById('play-modal').addEventListener('click', (e) => {
        if (e.target.id === 'play-modal') {
            closePlayModal();
        }
    });
    
    document.getElementById('login-modal').addEventListener('click', (e) => {
        if (e.target.id === 'login-modal') {
            closeLoginModal();
        }
    });
    
    // Allow Enter key to submit login
    document.getElementById('firebase-token-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
};