const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        let width, height, particles = [], activeTouches = []; // Replaced mouse with activeTouches
        const shapes = ['circle', 'square', 'triangle'];

        // Resize canvas to fit window
        function resizeCanvas() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Particle class
        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 2;
                this.vy = (Math.random() - 0.5) * 2;
                this.size = Math.random() * 4 + 2; // Changed from Math.random() * 3 + 1;
                this.h = Math.random() * 360;
                this.s = 70;
                this.l = 60;
                this.color = `hsl(${this.h}, ${this.s}%, ${this.l}%)`;
                this.shape = shapes[Math.floor(Math.random() * shapes.length)];
                this.shapeAngle = 0; // For rotation
                this.shapeChangeCounter = 0; // To trigger shape change
                this.wiggleAngle = Math.random() * Math.PI * 2;
                this.wiggleMagnitude = 0.1;
            }
            update() {
                this.h = (this.h + 1) % 360; // Increment hue and wrap around 360
                this.color = `hsl(${this.h}, ${this.s}%, ${this.l}%)`; // Update the color string
                this.shapeAngle += 0.02; // Increment angle for rotation
                this.shapeChangeCounter++;
                if (this.shapeChangeCounter > 200) {
                    this.shapeChangeCounter = 0;
                    let currentShapeIndex = shapes.indexOf(this.shape);
                    this.shape = shapes[(currentShapeIndex + 1) % shapes.length];
                }
                // Wiggle effect
                this.wiggleAngle += 0.05;
                this.vx += Math.cos(this.wiggleAngle) * this.wiggleMagnitude;
                this.vy += Math.sin(this.wiggleAngle) * this.wiggleMagnitude;

                // Interact with touch/mouse (now activeTouches)
                if (activeTouches.length > 0) {
                    activeTouches.forEach(touch => {
                        let dx_particle_touch = this.x - touch.x; // dx for distance calculation
                        let dy_particle_touch = this.y - touch.y; // dy for distance calculation
                        let dist = Math.sqrt(dx_particle_touch * dx_particle_touch + dy_particle_touch * dy_particle_touch);

                        const directAttractionFactor = 0.015; // Keep existing tuned value
                        const swirlFactor = 0.05;          // Keep existing tuned value
                        const interactionRadius = 150;     // Keep existing tuned value

                        if (dist < interactionRadius && dist > 0) {
                            let forceX = (touch.x - this.x);
                            let forceY = (touch.y - this.y);

                        // Optional: Normalize if preferred, but factors are tuned for non-normalized
                        // let magnitude = Math.sqrt(forceX * forceX + forceY * forceY);
                        // if (magnitude > 0) {
                        //   forceX /= magnitude;
                        //   forceY /= magnitude;
                        // }

                        let interactionVx = (forceX * directAttractionFactor) + (forceY * swirlFactor);
                        let interactionVy = (forceY * directAttractionFactor) - (forceX * swirlFactor);

                        this.vx += interactionVx;
                        this.vy += interactionVy;
                    }
                }

                // General speed capping (moved here)
                const maxSpeed = 5; // Or make this a class/global property
                let currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                if (currentSpeed > maxSpeed) {
                    this.vx = (this.vx / currentSpeed) * maxSpeed;
                    this.vy = (this.vy / currentSpeed) * maxSpeed;
                }

                // Finally, update position
                this.x += this.vx;
                this.y += this.vy;

                // Bounce off edges
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;
            }
            draw() {
                ctx.fillStyle = this.color;
                ctx.save(); // Save context state
                ctx.translate(this.x, this.y); // Move to particle position
                ctx.rotate(this.shapeAngle); // Rotate

                ctx.beginPath();
                if (this.shape === 'circle') {
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                } else if (this.shape === 'square') {
                    ctx.rect(-this.size / 2, -this.size / 2, this.size, this.size);
                } else if (this.shape === 'triangle') {
                    const side = this.size * 1.5; // Make triangle a bit larger
                    ctx.moveTo(0, -side / 2);
                    ctx.lineTo(side / 2, side / 2);
                    ctx.lineTo(-side / 2, side / 2);
                    ctx.closePath();
                }
                ctx.fill();
                ctx.restore(); // Restore context state
            }
        }

        // Initialize particles
        function initParticles() {
            particles = [];
            for (let i = 0; i < 100; i++) {
                particles.push(new Particle());
            }
        }
        initParticles();

        // Animation loop
        function animate() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.03)'; // Changed from 0.05 for longer trails
            ctx.fillRect(0, 0, width, height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            requestAnimationFrame(animate);
        }
        animate();

        // New Event Handlers
        function handleTouchStart(e) {
            e.preventDefault();
            for (let touch of e.changedTouches) {
                activeTouches.push({ id: touch.identifier, x: touch.clientX, y: touch.clientY });
            }
        }

        function handleTouchMove(e) {
            e.preventDefault();
            for (let touch of e.changedTouches) {
                let existingTouch = activeTouches.find(t => t.id === touch.identifier);
                if (existingTouch) {
                    existingTouch.x = touch.clientX;
                    existingTouch.y = touch.clientY;
                }
            }
        }

        function handleTouchEnd(e) {
            e.preventDefault();
            for (let touch of e.changedTouches) {
                activeTouches = activeTouches.filter(t => t.id !== touch.identifier);
            }
        }

        function handleMouseDown(e) {
            e.preventDefault();
            activeTouches = activeTouches.filter(t => t.id !== -1); // Remove old mouse touch if any
            activeTouches.push({ id: -1, x: e.clientX, y: e.clientY });
        }

        function handleMouseMove(e) {
            e.preventDefault();
            let mouseTouch = activeTouches.find(t => t.id === -1);
            if (mouseTouch) {
                mouseTouch.x = e.clientX;
                mouseTouch.y = e.clientY;
            }
        }

        function handleMouseUp(e) {
            e.preventDefault();
            activeTouches = activeTouches.filter(t => t.id !== -1);
        }

        function handleMouseLeave(e) { // Optional but good for UX
            activeTouches = activeTouches.filter(t => t.id !== -1);
        }

        // Update Event Listeners
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);
        canvas.addEventListener('touchcancel', handleTouchEnd); // Also use handleTouchEnd for touchcancel

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave); // Optional

        // Reset canvas
        function resetCanvas() {
            initParticles();
        }
