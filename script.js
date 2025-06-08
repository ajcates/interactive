// Global Variables and Constants
const canvas = document.getElementById('canvas');
let ctx; // Will be initialized after checking canvas

let canvasWidth, canvasHeight; // Renamed for clarity
let particles = [];
/** @type {{id: number, x: number, y: number}[]} */
let activeTouches = []; // Stores active touch points (and mouse as a special touch point)

// Defines the available shapes for particles. Used in Particle class for shape cycling.
const SHAPES = ['circle', 'square', 'triangle'];
const PARTICLE_COUNT = 100;
const MAX_PARTICLE_SPEED = 5;
const PARTICLE_SIZE_MIN = 2;
const PARTICLE_SIZE_MAX = 4;
const SHAPE_CHANGE_INTERVAL = 200; // In frames
const INTERACTION_RADIUS = 150;
const SQUARED_INTERACTION_RADIUS = INTERACTION_RADIUS * INTERACTION_RADIUS;
const DIRECT_ATTRACTION_FACTOR = 0.015;
const SWIRL_FACTOR = 0.05;
const MOUSE_IDENTIFIER = -1; // Special ID for mouse interaction to distinguish from touch events
const MAX_PARTICLE_SPEED_SQUARED = MAX_PARTICLE_SPEED * MAX_PARTICLE_SPEED;

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
        this.halfSize = this.size / 2;
        // For triangle drawing, side length is 1.5 * size, so halfSide is 0.75 * size
        this.triangleHalfBase = (this.size * 1.5) / 2;
        // Assuming equilateral triangle for simplicity in drawing, height relates to side.
        // For an equilateral triangle: height = (sqrt(3)/2) * side.
        // The current drawing creates an isosceles triangle where height = side.
        // The points were (0, -side/2), (side/2, side/2), (-side/2, side/2)
        // Let's stick to the original visual proportions for the triangle by caching these:
        this.trianglePointY = (this.size * 1.5) / 2; // This is effectively "side/2" from original


        // Color (HSL format)
        this.h = Math.random() * 360; // Hue: 0-360, represents the color wheel
        this.s = 70;                  // Saturation: 0-100%, intensity of the color
        this.l = 60;                  // Lightness: 0-100%, brightness of the color
        this.color = `hsl(${this.h}, ${this.s}%, ${this.l}%)`;

        // Shape
        this.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        this.shapeAngle = 0; // Current rotation angle of the shape
        this.shapeChangeCounter = 0; // Counter to trigger shape morphing

        // Wiggle effect
        this.wiggleAngle = Math.random() * Math.PI * 2; // Initial angle for the sinusoidal wiggle movement
        this.wiggleMagnitude = 0.1; // Amplitude of the wiggle, affecting how much it deviates
    }

    /**
     * Updates the particle's state (position, color, shape, etc.) for each animation frame.
     */
    update() {
        this._updateColor();
        this._updateShape();
        this._applyWiggle();
        this._handleInteractions();
        this._capSpeed();
        this._updatePosition();
        this._applyBoundaryConditions();
    }

    /** @private Updates the particle's color, cycling through hues. */
    _updateColor() {
        this.h = (this.h + 1) % 360; // Increment hue and wrap around 360
        this.color = `hsl(${this.h}, ${this.s}%, ${this.l}%)`;
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

    /** @private Applies a gentle sinusoidal wiggle force to the particle's velocity. */
    _applyWiggle() {
        this.wiggleAngle += 0.05;
        this.vx += Math.cos(this.wiggleAngle) * this.wiggleMagnitude;
        this.vy += Math.sin(this.wiggleAngle) * this.wiggleMagnitude;
    }

    /** @private Handles interactions with active touch points (including mouse). */
    _handleInteractions() {
        if (activeTouches.length > 0) {
            activeTouches.forEach(touch => {
                let dxParticleTouch = this.x - touch.x;
                let dyParticleTouch = this.y - touch.y;
                // Compare squared distances to avoid Math.sqrt for the check
                let squaredDistance = dxParticleTouch * dxParticleTouch + dyParticleTouch * dyParticleTouch;

                // distance > 0 check becomes squaredDistance > very_small_number (e.g. 0.001 to avoid issues at exact same point)
                if (squaredDistance < SQUARED_INTERACTION_RADIUS && squaredDistance > 0.001) {
                    let forceX = (touch.x - this.x);
                    let forceY = (touch.y - this.y);

                    // Apply forces: direct attraction and a swirling component
                    let interactionVx = (forceX * DIRECT_ATTRACTION_FACTOR) + (forceY * SWIRL_FACTOR);
                    let interactionVy = (forceY * DIRECT_ATTRACTION_FACTOR) - (forceX * SWIRL_FACTOR);

                    this.vx += interactionVx;
                    this.vy += interactionVy;
                }
            });
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
        ctx.fillStyle = this.color;
        ctx.save(); // Save current canvas context state (transformations, styles)
        ctx.translate(this.x, this.y); // Move canvas origin to particle's position
        ctx.rotate(this.shapeAngle); // Rotate canvas for the particle's shape

        ctx.beginPath();
        if (this.shape === 'circle') {
            ctx.arc(0, 0, this.size, 0, Math.PI * 2); // Draw circle centered at new origin
        } else if (this.shape === 'square') {
            ctx.rect(-this.halfSize, -this.halfSize, this.size, this.size); // Draw square centered
        } else if (this.shape === 'triangle') {
            // Using the cached this.trianglePointY which is equivalent to original side/2
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
    // Clear canvas with a semi-transparent black to create trails effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

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
