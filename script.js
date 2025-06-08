const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        let width, height, particles = [], mouse = { x: null, y: null };
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
                this.size = Math.random() * 3 + 1;
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

                // Interact with touch/mouse
                if (mouse.x && mouse.y) {
                    const directAttractionFactor = 0.015; // Adjusted
                    const swirlFactor = 0.05;      // Adjusted
                    const interactionRadius = 150;

                    let dx_particle_mouse = this.x - mouse.x; // dx for distance calculation
                    let dy_particle_mouse = this.y - mouse.y; // dy for distance calculation
                    let dist = Math.sqrt(dx_particle_mouse * dx_particle_mouse + dy_particle_mouse * dy_particle_mouse);

                    if (dist < interactionRadius && dist > 0) { // Added dist > 0 to avoid issues if particle is exactly at mouse
                        let forceX = (mouse.x - this.x);
                        let forceY = (mouse.y - this.y);

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
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, width, height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            requestAnimationFrame(animate);
        }
        animate();

        // Touch and mouse events
        function handleTouch(e) {
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            mouse.x = touch.clientX;
            mouse.y = touch.clientY;
        }
        canvas.addEventListener('touchstart', handleTouch);
        canvas.addEventListener('touchmove', handleTouch);
        canvas.addEventListener('mousedown', handleTouch);
        canvas.addEventListener('mousemove', handleTouch);
        canvas.addEventListener('touchend', () => { mouse.x = null; mouse.y = null; });
        canvas.addEventListener('mouseup', () => { mouse.x = null; mouse.y = null; });

        // Reset canvas
        function resetCanvas() {
            initParticles();
        }
