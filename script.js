// --- Game Data and Logic ---

// Game Rarity Structure
const RARITIES = {
    COMMON: { name: "Common", weight: 450, color: "rarity-common" }, // 45%
    UNCOMMON: { name: "Uncommon", weight: 350, color: "rarity-uncommon" }, // 35%
    RARE: { name: "Rare", weight: 150, color: "rarity-rare" }, // 15%
    LEGENDARY: { name: "Legendary", weight: 50, color: "rarity-legendary" } // 5%
};
const TOTAL_WEIGHT = Object.values(RARITIES).reduce((sum, r) => sum + r.weight, 0);
const WIN_SLOT_INDEX = 155;
const ITEM_FULL_WIDTH = 200;

// Video Game Database (using placeholder images and names)
const ALL_GAMES = [
    // Commons (45% total chance)
    { id: 1, name: "Stardew Farm", rarity: RARITIES.COMMON, image: "https://placehold.co/80x80/4b5563/ffffff?text=C1", description: "A simple, relaxing farming simulator." },
    { id: 2, name: "Pixel Runner", rarity: RARITIES.COMMON, image: "https://placehold.co/80x80/4b5563/ffffff?text=C2", description: "An endless runner game with retro graphics." },
    { id: 3, name: "Block Tower Defense", rarity: RARITIES.COMMON, image: "https://placehold.co/80x80/4b5563/ffffff?text=C3", description: "Protect your base from blocky invaders." },
    // Uncommons (35% total chance)
    { id: 4, name: "Galactic Drifter", rarity: RARITIES.UNCOMMON, image: "https://placehold.co/80x80/3b82f6/ffffff?text=U1", description: "Space exploration with trading and combat." },
    { id: 5, name: "Medieval Craft", rarity: RARITIES.UNCOMMON, image: "https://placehold.co/80x80/3b82f6/ffffff?text=U2", description: "Build and manage a medieval settlement." },
    // Rares (15% total chance)
    { id: 6, name: "Cyberpunk Shadow", rarity: RARITIES.RARE, image: "https://placehold.co/80x80/8b5cf6/ffffff?text=R1", description: "An action RPG set in a neon-drenched future." },
    { id: 7, name: "Zombie Survival 4", rarity: RARITIES.RARE, image: "https://placehold.co/80x80/8b5cf6/ffffff?text=R2", description: "Third-person shooter in a post-apocalyptic world." },
    // Legendaries (5% total chance)
    { id: 8, name: "Elden Scroll VI", rarity: RARITIES.LEGENDARY, image: "https://placehold.co/80x80/f59e0b/ffffff?text=L1", description: "The highly anticipated open-world fantasy RPG." },
];

// Case Definitions (will be populated from Firebase)
const CASES = {};

// DOM Elements
const rollerContainer = document.getElementById('raffle-roller-container');
const openCaseBtn = document.getElementById('open-case-btn');
const rolledResultDisplay = document.getElementById('rolled-result');
const inventoryContainer = document.getElementById('inventory');
const emptyInventoryMsg = document.getElementById('empty-inventory-msg');

// State
let currentCaseId = null;
let isRolling = false;
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
 * @param {Array<number>|Array<Object>} gameIds - Array of ALL_GAMES IDs or item objects for custom cases
 * @returns {Object} The winning game object.
 */
function selectWinningGame(gameIds) {
    // Check if this is a custom case with item objects
    if (gameIds.length > 0 && typeof gameIds[0] === 'object' && gameIds[0].name) {
        // Custom case: items are objects with name, rarity, etc.
        // Convert rarity strings to RARITIES objects
        const pool = gameIds.map(item => ({
            ...item,
            rarity: RARITIES[item.rarity] || RARITIES.COMMON
        }));
        return selectItemByRarity(pool);
    } else {
        // Default case: gameIds are numbers referencing ALL_GAMES
        const pool = gameIds.map(id => ALL_GAMES.find(g => g.id === id)).filter(g => g);
        return selectItemByRarity(pool);
    }
}

// --- UI / Game Flow Functions ---

/**
 * Updates the UI to show which case is selected.
 */
window.selectCase = function(caseId) {
    if (isRolling) return;
    currentCaseId = caseId;
    const selectedCase = CASES[caseId];
    
    if (!selectedCase) {
        console.error('Case not found:', caseId);
        return;
    }

    // Get items - could be 'games' array (default) or 'items' array (custom)
    const caseItems = selectedCase.items || selectedCase.games || [];

    // Update UI text
    openCaseBtn.textContent = 'Open Case';
    openCaseBtn.disabled = false;
    
    // Update case description with name and description
    const descriptionDisplay = document.getElementById('case-description');
    if (descriptionDisplay) {
        const caseName = `<div style="font-size: 15px; font-weight: bold; margin-bottom: 8px;">${selectedCase.name}</div>`;
        const caseDesc = selectedCase.description ? `<div style="text-align: left;">${selectedCase.description}</div>` : '';
        descriptionDisplay.innerHTML = caseName + caseDesc;
    }

    // Update card highlighting
    document.querySelectorAll('.case-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.caseId === caseId) {
            card.classList.add('selected');
        }
    });

    // Clear roller and generate initial filler
    rollerContainer.innerHTML = '';
    rolledResultDisplay.textContent = '';
    generateRoller(caseItems);
    
    // Update available items list
    updateAvailableItemsList(caseItems);
}

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
    } else {
        // Default case: get from ALL_GAMES
        const uniqueGameIds = [...new Set(items)];
        availableGames = uniqueGameIds
            .map(id => ALL_GAMES.find(g => g.id === id))
            .filter(g => g);
    }
    
    // Sort by rarity weight (legendary first)
    availableGames.sort((a, b) => a.rarity.weight - b.rarity.weight);
    
    availableGames.forEach(game => {
        const itemCard = document.createElement('div');
        itemCard.className = `available-item-card ${game.rarity.color}`;
        itemCard.innerHTML = `
            <img src="${game.image}" alt="${game.name}">
            <div class="available-item-info">
                <div class="name">${game.name}</div>
                <div class="rarity">${game.rarity.name}</div>
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
function generateRoller(items, winningGame = null) {
    rollerContainer.innerHTML = '';
    
    // Convert items to game objects
    let gamePool = [];
    if (items.length > 0 && typeof items[0] === 'object' && items[0].name) {
        // Custom case: items are already objects
        gamePool = items.map(item => ({
            ...item,
            rarity: RARITIES[item.rarity] || RARITIES.COMMON
        }));
    } else {
        // Default case: items are IDs
        gamePool = items.map(id => ALL_GAMES.find(g => g.id === id)).filter(g => g);
    }
    
    const ITEMS_TO_GENERATE = WIN_SLOT_INDEX + 20;

    // Clear winning highlight
    document.querySelectorAll('.winning-item').forEach(el => el.classList.remove('winning-item'));

    for (let i = 0; i < ITEMS_TO_GENERATE; i++) {
        let item;
        
        // Place the winning item at the predetermined slot
        if (i === WIN_SLOT_INDEX && winningGame) {
            item = winningGame;
        } else {
            // Pick a random filler item based on rarity weights
            item = selectItemByRarity(gamePool);
        }
        
        const itemDiv = document.createElement('div');
        itemDiv.id = `CardNumber${i}`;
        itemDiv.className = `item shadow-lg ${item.rarity.color}`;
        
        // Add the image and name
        itemDiv.innerHTML = `
            <img src="${item.image}" alt="${item.name}" class="item-image">
            <span class="text-xs font-semibold mt-1 leading-none text-white">${item.name}</span>
            <span class="text-xs font-light opacity-75 leading-none">${item.rarity.name}</span>
        `;

        rollerContainer.appendChild(itemDiv);
    }

    // Reset position to start (left edge visible)
    rollerContainer.style.transition = 'none';
    rollerContainer.style.transform = 'translateX(0px)'; 
}

/**
 * Initiates the case opening roll animation.
 */
window.startRoll = function() {
    if (isRolling || !currentCaseId) return;

    isRolling = true;
    openCaseBtn.disabled = true;
    rolledResultDisplay.textContent = 'Rolling...';

    const caseData = CASES[currentCaseId];
    const caseItems = caseData.items || caseData.games || [];
    const winningGame = selectWinningGame(caseItems);

    // Generate the roller content with the winning item
    generateRoller(caseItems, winningGame);

    // Calculate the final translation
    const containerWidth = rollerContainer.parentElement.clientWidth;
    
    // Calculate how far to move to center the winning item (index 77)
    const targetCenterOffset = (WIN_SLOT_INDEX * ITEM_FULL_WIDTH) + (ITEM_FULL_WIDTH / 2);
    
    // Add a random wiggle (50px range) so it doesn't land exactly the same spot every time
    const RANDOM_WIGGLE = randomInt(-25, 25); 
    
    // Calculate the full translation required (negative because we're moving left)
    const FINAL_TRANSLATION_PX = targetCenterOffset - (containerWidth / 2) + RANDOM_WIGGLE;

    // Force a reflow to ensure the reset position is applied
    void rollerContainer.offsetHeight;
    
    // Use setTimeout to give browser time to render initial position
    setTimeout(() => {
        // Apply the transition and start the animation
        rollerContainer.style.transition = "transform 6.3s cubic-bezier(.08,.6,0,1)"; 
        rollerContainer.style.transform = `translateX(-${FINAL_TRANSLATION_PX}px)`;
        
        // Play roll sound
        playRollSound();
    }, 50);


    // 4. Handle result after animation finishes
    // The duration is now exactly the CSS transition duration (6300ms)
    setTimeout(() => {
        isRolling = false;
        openCaseBtn.disabled = false;
        
        // Remove transition style after animation to prevent issues on selection/reset
        rollerContainer.style.transition = 'none';

        // Highlight the winning item
        const winCard = document.getElementById('CardNumber77');
        if(winCard) {
            winCard.classList.add('winning-item');
        }

        // Update results
        rolledResultDisplay.textContent = `Unboxed: ${winningGame.name}`;
        
        // Add to Inventory and update UI
        inventory.push(winningGame);
        renderInventory();
        
        // Save inventory to Firebase
        saveInventoryToFirebase();
        
        // Show the play modal directly
        showPlayModal(winningGame);

    }, 6300); // Set timeout exactly to transition duration (6300ms)
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
    
    details.innerHTML = `
        <div class="flex flex-col items-center">
            <img src="${game.image}" alt="${game.name}" class="w-24 h-24 mb-4 border-2 ${game.rarity.color}">
            <div class="w-full min-h-24 flex items-center justify-center text-sm p-4" style="background-color: var(--win95-white); border: 2px inset var(--win95-dark-gray);">
                ${game.description || 'No description available'}
            </div>
        </div>
    `;
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
    const input = document.getElementById('firebase-token-input');
    const statusDiv = document.getElementById('login-status');
    
    // Clear previous input and status
    input.value = '';
    statusDiv.classList.add('hidden');
    
    // Show with transition
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('.modal-content').classList.remove('scale-95');
        modal.querySelector('.modal-content').classList.add('scale-100');
    }, 10);
    
    // Focus input
    setTimeout(() => input.focus(), 100);
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    // Hide with transition
    modal.classList.add('opacity-0');
    modal.querySelector('.modal-content').classList.remove('scale-100');
    modal.querySelector('.modal-content').classList.add('scale-95');
    setTimeout(() => modal.style.display = 'none', 300);
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
            
            // Update login button to show logged in state
            const loginBtn = document.getElementById('login-btn');
            loginBtn.textContent = 'Logged In';
            loginBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            loginBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            
            showLoginStatus('✓ Credentials saved successfully!', true);
            
            // Close modal after 1.5 seconds
            setTimeout(() => {
                closeLoginModal();
            }, 1500);
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
    const loginBtn = document.getElementById('login-btn');
    
    // Debug: Print localStorage values to console
    console.log('Firebase Token (localStorage):', token);
    console.log('Firebase Project ID (localStorage):', projectId);
    console.log('All localStorage:', { ...localStorage });
    
    const settingsBtn = document.getElementById('settings-btn');
    
    if (token && projectId) {
        // User is logged in
        loginBtn.textContent = `Logged In (${projectId})`;
        loginBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        loginBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        
        // Show settings button
        settingsBtn.classList.remove('hidden');
    } else {
        // User is not logged in
        loginBtn.textContent = 'Login';
        loginBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        loginBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        
        // Hide settings button
        settingsBtn.classList.add('hidden');
    }
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
            
            if (customCases && typeof customCases === 'object' && Object.keys(customCases).length > 0) {
                // Load custom cases into CASES
                Object.assign(CASES, customCases);
                console.log('Successfully loaded cases:', Object.keys(CASES));
            } else {
                console.log('No cases found in Firebase database');
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
    const caseSelectionArea = document.getElementById('case-selection-container');
    if (!caseSelectionArea) return;
    
    caseSelectionArea.innerHTML = '';
    
    // Check if there are any cases
    if (Object.keys(CASES).length === 0) {
        caseSelectionArea.innerHTML = '<p class="text-gray-400 italic text-sm">No cases available. Please login and add cases in Settings.</p>';
        return;
    }
    
    Object.entries(CASES).forEach(([caseId, caseData]) => {
        const caseCard = document.createElement('div');
        caseCard.id = `case-${caseId}`;
        caseCard.onclick = () => selectCase(caseId);
        caseCard.className = 'case-card w-40 h-40 cursor-pointer transition duration-200 relative overflow-hidden';
        caseCard.setAttribute('data-case-id', caseId);
        
        caseCard.innerHTML = `
            <img src="${caseData.image || 'https://placehold.co/100x100/525252/ffffff?text=CASE'}" alt="${caseData.name}" class="w-full h-full object-cover">
            <div class="case-name-overlay">
                <p>${caseData.name}</p>
            </div>
        `;
        
        caseSelectionArea.appendChild(caseCard);
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
    
    // Initial setup: select first case if available
    const firstCaseId = Object.keys(CASES)[0];
    if (firstCaseId) {
        selectCase(firstCaseId);
    }
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