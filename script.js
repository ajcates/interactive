// Global Variables and Constants
const canvas = document.getElementById('canvas');
let ctx; // Will be initialized after checking canvas

let audioContext;
let analyser;
let microphone;
let javascriptNode; // For processing audio data
let audioDataArray; // To store frequency data
let audioSource; // To store the microphone audio source

const FFT_SIZE = 256; // Size of the FFT for frequency analysis, can be adjusted

let canvasWidth, canvasHeight; // Renamed for clarity
let particles = [];
/** @type {{id: number, x: number, y: number}[]} */
let activeTouches = []; // Stores active touch points (and mouse as a special touch point)

// Defines the available shapes for particles. Used in Particle class for shape cycling.
const SHAPES = ['circle', 'square', 'triangle'];
const PARTICLE_COUNT = 300;
const MAX_PARTICLE_SPEED = 1; // Increased from 5
const PARTICLE_SIZE_MIN = 2;
const PARTICLE_SIZE_MAX = 24;
const SHAPE_CHANGE_INTERVAL = 1; // In frames
const INTERACTION_RADIUS = 100;
const SQUARED_INTERACTION_RADIUS = INTERACTION_RADIUS * INTERACTION_RADIUS;
const DIRECT_ATTRACTION_FACTOR = 0.02;
const SWIRL_FACTOR = 0.01;
const MOUSE_IDENTIFIER = -1; // Special ID for mouse interaction to distinguish from touch events
const MAX_PARTICLE_SPEED_SQUARED = MAX_PARTICLE_SPEED * MAX_PARTICLE_SPEED; // Updated to 7*7 = 49

// -- Audio Setup --
async function handleAudioPermission() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support microphone input!');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        audioDataArray = new Uint8Array(analyser.frequencyBinCount);

        // Connect the microphone stream to the analyser
        audioSource = audioContext.createMediaStreamSource(stream);
        audioSource.connect(analyser);

        // Further processing or starting the animation that depends on audio can be triggered here
        // For now, let's log success
        console.log("Microphone access granted and audio context initialized.");

        // Optional: If the animation should only start/resume after permission
        // if (!animationRunning) { // Assuming an animationRunning flag
        //    animate();
        // }

    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access the microphone. Please allow microphone access in your browser settings.');
    }
}

// -- Canvas Setup --

/**
 * Resizes the canvas to fill the browser window and updates dimension variables.
 */
function resizeCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}

// -- Particle Class --

/**
 * Represents a single particle in the animation.
 */
class Particle {
    /**
     * Initializes a new particle with random properties.
     */
    constructor() {
        // Position
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;

        // Velocity
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;

        // Size
        this.size = Math.random() * PARTICLE_SIZE_MAX + PARTICLE_SIZE_MIN;
        // new properties for reactive effects
        this.baseLightness = 60;
        this.baseSize = this.size;
        this.currentLightness = this.baseLightness;
        this.currentSize = this.baseSize;

        this.halfSize = this.currentSize / 2;
        // For triangle drawing, side length is 1.5 * size, so halfSide is 0.75 * size
        this.triangleHalfBase = (this.currentSize * 1.5) / 2;
        // Assuming equilateral triangle for simplicity in drawing, height relates to side.
        // For an equilateral triangle: height = (sqrt(3)/2) * side.
        // The current drawing creates an isosceles triangle where height = side.
        // The points were (0, -side/2), (side/2, side/2), (-side/2, side/2)
        // Let's stick to the original visual proportions for the triangle by caching these:
        this.trianglePointY = (this.currentSize * 1.5) / 2; // This is effectively "side/2" from original


        // Color (HSL format)
        this.h = Math.random() * 360; // Hue: 0-360, represents the color wheel
        this.s = 70;                  // Saturation: 0-100%, intensity of the color
        // Initialize target lightness and size to base values
        this.l = this.baseLightness;
        this.size = this.baseSize; // Initialize target size to base size
        // Update color string to use this.currentLightness
        this.color = `hsl(${this.h}, ${this.s}%, ${this.currentLightness}%)`;

        // Shape
        this.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        this.shapeAngle = 0; // Current rotation angle of the shape
        this.shapeChangeCounter = 0; // Counter to trigger shape morphing

        // Wiggle effect
        this.wiggleAngle = Math.random() * Math.PI * 2; // Initial angle for the sinusoidal wiggle movement
        this.wiggleMagnitude = 0.3; // Increased from 0.1 - Amplitude of the wiggle
    }

    /**
     * Updates the particle's state (position, color, shape, etc.) for each animation frame.
     */
    update() {
        this._applyAudioInfluence(); // Add this line
        this._updateColor();
        this._updateShape();
        this._applyWiggle();
        this._handleInteractions(); // Interactions can modify l and size further
        this._updateCurrentVisuals(); // Smoothly update visual properties
        this._capSpeed();
        this._updatePosition();
        this._applyBoundaryConditions();
    }

    /** @private Updates the particle's color, cycling through hues and pulsing saturation. */
    _updateColor() {
        this.h = (this.h + 5) % 360; // Increased hue cycling speed
        // Dynamic saturation: pulses between 50% and 100% (75 +/- 25)
        // The (this.h * 0.1) makes the saturation wave slower than the hue cycle.
        this.s = 75 + Math.sin(this.h * 0.1) * 25;
        // Ensure saturation stays within valid HSL range (0-100)
        this.s = Math.max(0, Math.min(100, this.s));

        // Update this.color using this.currentLightness (driven by interactions)
        this.color = `hsl(${this.h}, ${this.s}%, ${this.currentLightness}%)`;
    }

    /** @private Handles shape rotation and morphing to the next shape in the sequence. */
    _updateShape() {
        this.shapeAngle += 0.02; // Increment angle for continuous rotation
        this.shapeChangeCounter++;
        if (this.shapeChangeCounter > SHAPE_CHANGE_INTERVAL) {
            this.shapeChangeCounter = 0;
            let currentShapeIndex = SHAPES.indexOf(this.shape);
            this.shape = SHAPES[(currentShapeIndex + 1) % SHAPES.length]; // Cycle to the next shape
        }
    }

    /** @private Smoothly updates current visual properties towards target values. */
    _updateCurrentVisuals() {
        const lerpFactor = 0.1;
        this.currentLightness += (this.l - this.currentLightness) * lerpFactor;
        this.currentSize += (this.size - this.currentSize) * lerpFactor;

        // Small threshold to snap to target value if very close - avoids tiny fluctuations
        // and ensures it can reach the target.
        if (Math.abs(this.l - this.currentLightness) < 0.05) {
            this.currentLightness = this.l;
        }
        if (Math.abs(this.size - this.currentSize) < 0.05) {
            this.currentSize = this.size;
        }
    }

    /** @private Applies a gentle sinusoidal wiggle force to the particle's velocity. */
    _applyWiggle() {
        this.wiggleAngle += 0.1; // Increased from 0.05 - Faster wiggle
        this.vx += Math.cos(this.wiggleAngle) * this.wiggleMagnitude;
        this.vy += Math.sin(this.wiggleAngle) * this.wiggleMagnitude;
    }

    _applyAudioInfluence() {
        if (analyser && audioDataArray) {
            analyser.getByteFrequencyData(audioDataArray);
            let sum = 0;
            for (let i = 0; i < audioDataArray.length; i++) {
                sum += audioDataArray[i];
            }
            const averageLevel = sum / audioDataArray.length;

            // Normalize the average level (0-255) to a factor (e.g., 0-1 or 0-2)
            // Adjust this factor based on desired sensitivity
            const audioFactor = averageLevel / 128; // Results in a factor around 0-2

            // Influence base lightness and size
            // The idea is that louder sounds make particles brighter and slightly larger.
            // We'll adjust the *target* lightness (this.l) and *target* size (this.size).
            // The _updateCurrentVisuals method will then smoothly transition to these targets.

            const maxLightnessBoostFromAudio = 20; // Max additional lightness from audio
            const maxSizeBoostFromAudio = 5;    // Max additional size from audio

            // Apply audio effect to base values before other interactions
            // This means _handleInteractions might override or add to this.
            // Let's refine this: audio should provide a base modulation,
            // and interactions can add on top.
            // So, we set this.l and this.size based on audio,
            // and _handleInteractions will use these as the new "base"
            // if an interaction occurs.

            this.l = this.baseLightness + (maxLightnessBoostFromAudio * audioFactor);
            this.l = Math.max(0, Math.min(100, this.l)); // Clamp lightness

            this.size = this.baseSize + (maxSizeBoostFromAudio * audioFactor);
            this.size = Math.max(PARTICLE_SIZE_MIN, Math.min(PARTICLE_SIZE_MAX, this.size)); // Clamp size

        } else {
            // If audio is not active, ensure lightness and size revert to their base values
            // if no other interactions are happening.
            // This logic is already somewhat handled in _handleInteractions,
            // but it's good to be explicit if audio is the primary modulator.
            // For now, if analyser is not ready, we don't change l and size here.
            // _handleInteractions will set them if no touch/mouse.
        }
    }

    /** @private Handles interactions with active touch points (including mouse). */
    _handleInteractions() {
        if (activeTouches.length > 0) {
            let totalLightnessBoost = 0;
            let totalSizeBoost = 0;
            let interactionCount = 0;

            activeTouches.forEach(touch => {
                let dxParticleTouch = this.x - touch.x;
                let dyParticleTouch = this.y - touch.y;
                let squaredDistance = dxParticleTouch * dxParticleTouch + dyParticleTouch * dyParticleTouch;

                if (squaredDistance < SQUARED_INTERACTION_RADIUS && squaredDistance > 0.001) {
                    const distance = Math.sqrt(squaredDistance);
                    let proximityFactor = 1 - (distance / INTERACTION_RADIUS);
                    proximityFactor = Math.max(0, Math.min(1, proximityFactor)); // Clamp 0-1

                    const maxLightnessBoost = 30;
                    const maxSizeBoost = 4;

                    totalLightnessBoost += maxLightnessBoost * proximityFactor;
                    totalSizeBoost += maxSizeBoost * proximityFactor;
                    interactionCount++;

                    // Original interaction physics (attraction/swirl)
                    let forceX = (touch.x - this.x);
                    let forceY = (touch.y - this.y);
                    let interactionVx = (forceX * DIRECT_ATTRACTION_FACTOR) + (forceY * SWIRL_FACTOR);
                    let interactionVy = (forceY * DIRECT_ATTRACTION_FACTOR) - (forceX * SWIRL_FACTOR);
                    this.vx += interactionVx;
                    this.vy += interactionVy;
                }
            });

            if (interactionCount > 0) {
                // Average the boosts if multiple interactions affect the same particle
                // Apply interaction boost ON TOP of the current this.l and this.size (which might be audio-influenced)
                this.l = Math.max(0, Math.min(100, this.l + (totalLightnessBoost / interactionCount) - this.baseLightness));
                this.size = Math.max(PARTICLE_SIZE_MIN, this.size + (totalSizeBoost / interactionCount) - this.baseSize);

            } else {
                // No active interaction *for this particle*, keep audio-influenced values.
                // So, we don't reset to baseLightness/baseSize here anymore.
                // The values set by _applyAudioInfluence will persist if no direct interaction.
            }
        } else {
            // No active touches on screen. Values set by _applyAudioInfluence should persist.
            // So, we don't reset to baseLightness/baseSize here either.
        }
    }

    /** @private Caps the particle's speed to a maximum value. */
    _capSpeed() {
        const squaredSpeed = this.vx * this.vx + this.vy * this.vy;
        if (squaredSpeed > MAX_PARTICLE_SPEED_SQUARED) {
            const currentSpeed = Math.sqrt(squaredSpeed); // Calculate sqrt only when necessary
            this.vx = (this.vx / currentSpeed) * MAX_PARTICLE_SPEED;
            this.vy = (this.vy / currentSpeed) * MAX_PARTICLE_SPEED;
        }
    }

    /** @private Updates the particle's position based on its current velocity. */
    _updatePosition() {
        this.x += this.vx;
        this.y += this.vy;
    }

    /** @private Handles boundary conditions, making particles bounce off canvas edges. */
    _applyBoundaryConditions() {
        if (this.x < 0 || this.x > canvasWidth) {
            this.vx *= -1;
            if (this.x < 0) this.x = 0; // Clamp to edge to prevent sticking
            if (this.x > canvasWidth) this.x = canvasWidth; // Clamp to edge
        }
        if (this.y < 0 || this.y > canvasHeight) {
            this.vy *= -1;
            if (this.y < 0) this.y = 0; // Clamp to edge
            if (this.y > canvasHeight) this.y = canvasHeight; // Clamp to edge
        }
    }

    /**
     * Draws the particle on the canvas.
     */
    draw() {
        // Update size-related properties based on this.currentSize
        this.halfSize = this.currentSize / 2;
        this.triangleHalfBase = (this.currentSize * 1.5) / 2;
        this.trianglePointY = (this.currentSize * 1.5) / 2;

        ctx.fillStyle = this.color;
        ctx.save(); // Save current canvas context state (transformations, styles)
        ctx.translate(this.x, this.y); // Move canvas origin to particle's position
        ctx.rotate(this.shapeAngle); // Rotate canvas for the particle's shape

        ctx.beginPath();
        if (this.shape === 'circle') {
            // Use this.currentSize for drawing
            ctx.arc(0, 0, this.currentSize, 0, Math.PI * 2); // Draw circle centered at new origin
        } else if (this.shape === 'square') {
            // Use this.currentSize for drawing
            ctx.rect(-this.halfSize, -this.halfSize, this.currentSize, this.currentSize); // Draw square centered
        } else if (this.shape === 'triangle') {
            // Use this.currentSize for drawing (via trianglePointY)
            ctx.moveTo(0, -this.trianglePointY);      // Top point
            ctx.lineTo(this.trianglePointY, this.trianglePointY);  // Bottom-right point
            ctx.lineTo(-this.trianglePointY, this.trianglePointY); // Bottom-left point
            ctx.closePath();               // Close path to form triangle
        }
        ctx.fill();
        ctx.restore(); // Restore canvas context state to before this particle was drawn
    }
}

// -- Particle Initialization --

/**
 * Clears existing particles and creates a new set of particles.
 */
function initParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }
}

// -- Animation Loop --

/**
 * Main animation loop that clears the canvas, updates and draws particles,
 * and requests the next frame.
 */
function animate() {
    // Psychedelic canvas feedback loop
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate(0.005); // Small rotation
    ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

    let scaleFactor = 1.01; // Zoom-in factor
    let newWidth = canvasWidth * scaleFactor;
    let newHeight = canvasHeight * scaleFactor;
    let offsetX = (canvasWidth - newWidth) / 2;
    let offsetY = (canvasHeight - newHeight) / 2;

    // Draw the existing canvas onto itself, scaled and offset
    // This requires the canvas object itself, not just the context.
    ctx.drawImage(canvas, 0, 0, canvasWidth, canvasHeight, offsetX, offsetY, newWidth, newHeight);
    ctx.restore();

    // Update and draw particles AFTER the feedback effect
    particles.forEach(p => {
        p.update();
        p.draw();
    });
    requestAnimationFrame(animate); // Request the browser to call animate again for the next frame
}

// -- Event Handlers --

// Touch Event Handlers
/**
 * Handles the start of a touch interaction.
 * Adds new touch points to the `activeTouches` array.
 * @param {TouchEvent} e - The touch event object.
 */
function handleTouchStart(e) {
    e.preventDefault(); // Prevent default touch behaviors like scrolling
    for (let touch of e.changedTouches) {
        activeTouches.push({ id: touch.identifier, x: touch.clientX, y: touch.clientY });
    }
}

/**
 * Handles the movement of an active touch interaction.
 * Updates the position of the corresponding touch point in `activeTouches`.
 * @param {TouchEvent} e - The touch event object.
 */
function handleTouchMove(e) {
    e.preventDefault(); // Prevent default touch behaviors
    for (let touch of e.changedTouches) {
        let existingTouch = activeTouches.find(t => t.id === touch.identifier);
        if (existingTouch) {
            existingTouch.x = touch.clientX;
            existingTouch.y = touch.clientY;
        }
    }
}

/**
 * Handles the end of a touch interaction (finger lifted).
 * Removes the touch point from the `activeTouches` array.
 * @param {TouchEvent} e - The touch event object.
 */
function handleTouchEnd(e) {
    e.preventDefault(); // Prevent default touch behaviors
    for (let touch of e.changedTouches) {
        activeTouches = activeTouches.filter(t => t.id !== touch.identifier);
    }
}

// Mouse Event Handlers
/**
 * Handles the mouse button being pressed down.
 * Adds or updates the mouse as a special touch point in `activeTouches`.
 * The mouse is identified by `MOUSE_IDENTIFIER` (-1).
 * @param {MouseEvent} e - The mouse event object.
 */
function handleMouseDown(e) {
    e.preventDefault();
    // Remove any existing mouse touch point before adding a new one
    activeTouches = activeTouches.filter(t => t.id !== MOUSE_IDENTIFIER);
    activeTouches.push({ id: MOUSE_IDENTIFIER, x: e.clientX, y: e.clientY });
}

/**
 * Handles the mouse moving over the canvas.
 * Updates the position of the mouse touch point in `activeTouches`.
 * @param {MouseEvent} e - The mouse event object.
 */
function handleMouseMove(e) {
    e.preventDefault();
    let mouseTouch = activeTouches.find(t => t.id === MOUSE_IDENTIFIER);
    if (mouseTouch) {
        mouseTouch.x = e.clientX;
        mouseTouch.y = e.clientY;
    }
}

/**
 * Handles the mouse button being released.
 * Removes the mouse touch point from `activeTouches`.
 * @param {MouseEvent} e - The mouse event object.
 */
function handleMouseUp(e) {
    e.preventDefault();
    activeTouches = activeTouches.filter(t => t.id !== MOUSE_IDENTIFIER);
}

/**
 * Handles the mouse leaving the canvas area.
 * Removes the mouse touch point from `activeTouches` for better UX.
 * @param {MouseEvent} e - The mouse event object.
 */
function handleMouseLeave(e) {
    // No e.preventDefault() needed here as it's not a cancelable event in this context
    activeTouches = activeTouches.filter(t => t.id !== MOUSE_IDENTIFIER);
}

// -- Event Listeners Setup --
window.addEventListener('resize', resizeCanvas);

// Touch events
// { passive: false } is used to indicate that the event handlers WILL call e.preventDefault().
// This is important for performance and to prevent default browser actions like scroll or zoom.
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd);
canvas.addEventListener('touchcancel', handleTouchEnd); // Treat cancel like end

// Mouse events
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mouseleave', handleMouseLeave);

// -- Utility Functions --

/**
 * Resets the canvas by re-initializing the particles.
 * Useful for restarting the animation or applying changes.
 */
function resetCanvas() {
    initParticles();
}

// -- Initial Setup --
// Main script execution starts here
function main() {
    if (!canvas) {
        console.error("Error: Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Error: 2D context not available!");
        return;
    }

    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', handleAudioPermission);
    } else {
        console.error("Start button not found!");
    }

    resizeCanvas(); // Set initial canvas size
    initParticles(); // Create initial set of particles
    animate(); // Start the animation loop

    // Setup event listeners only if canvas and context are valid
    window.addEventListener('resize', resizeCanvas);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
}

main(); // Run the main setup
