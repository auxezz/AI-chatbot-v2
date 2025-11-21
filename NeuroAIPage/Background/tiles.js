// tiles.js - 3D perspective grid tiles with mouse tracking
(function () {
    const background = document.getElementById('background');
    if (!background) return;

    // Create grid container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';
    
    // Create tile container
    const container = document.createElement('div');
    container.id = 'container';
    
    gridContainer.appendChild(container);
    background.appendChild(gridContainer);

    // Generate tiles
    const tileCount = 1600; // 40x40 grid
    const tiles = [];
    
    for (let i = 0; i < tileCount; i++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        container.appendChild(tile);
        tiles.push(tile);
    }

    // Track mouse globally and apply hover to tiles beneath cursor
    let currentHoveredTile = null;
    
    document.addEventListener('mousemove', (e) => {
        // Calculate which tile should be hovered based on mouse position
        // Get all elements that need to be hidden temporarily
        const chatRoot = document.querySelector('.chat-root');
        const chatHeader = document.querySelector('.chat-header');
        const chatBox = document.querySelector('.chat-box');
        const inputArea = document.querySelector('.input-area');
        const chatFooter = document.querySelector('.chat-footer');
        
        // Store original pointer-events values
        const originalValues = [];
        const elements = [chatRoot, chatHeader, chatBox, inputArea, chatFooter].filter(el => el);
        
        elements.forEach(el => {
            originalValues.push(el.style.pointerEvents);
            el.style.pointerEvents = 'none';
        });
        
        // Now check what's underneath
        const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
        
        // Restore pointer-events
        elements.forEach((el, i) => {
            el.style.pointerEvents = originalValues[i];
        });
        
        // Check if it's a tile
        if (elementAtPoint && elementAtPoint.classList.contains('tile')) {
            if (currentHoveredTile !== elementAtPoint) {
                // Remove hover from previous tile
                if (currentHoveredTile) {
                    currentHoveredTile.classList.remove('active-hover');
                }
                // Add hover to new tile
                elementAtPoint.classList.add('active-hover');
                currentHoveredTile = elementAtPoint;
            }
        } else {
            // Not hovering over any tile
            if (currentHoveredTile) {
                currentHoveredTile.classList.remove('active-hover');
                currentHoveredTile = null;
            }
        }
    });
    
    document.addEventListener('mouseleave', () => {
        if (currentHoveredTile) {
            currentHoveredTile.classList.remove('active-hover');
            currentHoveredTile = null;
        }
    });
})();