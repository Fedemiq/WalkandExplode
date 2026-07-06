// main.js
(async function main() {
    const canvas = document.getElementById('canvas');
    if (!canvas) throw new Error('Canvas non trovato.');

    const statusEl = document.getElementById('game-status');
    statusEl.textContent = 'Caricamento modelli e texture...';

    const camera = new Camera([0, 15, 12], [0, 0, 0], [0, 1, 0]);
    const scene = new Scene(canvas, camera);

    await scene.init();

    statusEl.textContent = 'Gioca!';
    setTimeout(() => statusEl.style.display = 'none', 2000);

    const ui = new UI(scene);
    const game = new Game(scene, camera, ui);

    document.addEventListener('player-move', (e) => {
        game.movePlayer(e.detail.playerId, e.detail.dx, e.detail.dz);
    });

    document.addEventListener('player-bomb', (e) => {
        game.useBomb(e.detail.playerId);
    });

    document.addEventListener('player-explode', (e) => {
        const tZero = performance.now() * 0.001; 
        scene.startExplosionAnimation(e.detail.explodingId, tZero);
        ui.triggerExplosionFX(e.detail.explodingId, e.detail.winnerId);
    });

    document.addEventListener('change-arena', async (e) => {
        statusEl.textContent = 'Caricamento arena...';
        statusEl.style.display = 'block';
        
        await scene.loadArena(e.detail.arena);
        
        statusEl.textContent = 'Fatto!';
        setTimeout(() => statusEl.style.display = 'none', 1000);
    });

    document.addEventListener('restart-game', () => {
        game.restartGame();
    });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
    });

    window.addEventListener('mouseup', () => {
        dragging = false;
    });

    window.addEventListener('mousemove', (event) => {
        if (!dragging) return;
        const deltaX = event.clientX - lastX;
        const deltaY = event.clientY - lastY;
        lastX = event.clientX;
        lastY = event.clientY;

        camera.orbit(deltaX, deltaY);
    });

    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        camera.zoom(event.deltaY);
    }, { passive: false });

    let touchStartX = 0;
    let touchStartY = 0;
    let initialPinchDistance = 0;

    canvas.addEventListener('touchstart', (event) => {
        if (event.touches.length === 1) {
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            // Calcola la distanza iniziale tra le due dita per lo zoom
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            initialPinchDistance = Math.hypot(dx, dy);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (event) => {
        event.preventDefault(); // Evita lo scroll della pagina
        
        if (event.touches.length === 1) {
            // Slide a 1 dito: Ruota la telecamera (X e Y)
            const currentX = event.touches[0].clientX;
            const currentY = event.touches[0].clientY;
            
            const deltaX = currentX - touchStartX;
            const deltaY = currentY - touchStartY;
            
            camera.orbit(deltaX, deltaY); 

            touchStartX = currentX;
            touchStartY = currentY;
            
        } else if (event.touches.length === 2) {
            // Pinch a 2 dita: Zoom della telecamera
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const currentPinchDistance = Math.hypot(dx, dy);
            
            // La differenza di distanza determina lo zoom
            const deltaZoom = initialPinchDistance - currentPinchDistance;
            
            camera.zoom(deltaZoom * 0.1); 

            initialPinchDistance = currentPinchDistance;
        }
    }, { passive: false });

    function frame(time) {
        scene.render(time * 0.001); 
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
})();