// Animated neon floating blobs background for The Syndicate

const canvas = document.querySelector('.animated-bg-canvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resizeCanvas);

// Blob parameters
const BLOB_COLORS = [
    "#2de3ff88", "#7bffe988", "#2de3ff55", "#00fff033", "#00faff44"
];
const BLOB_COUNT = 12;
const blobs = [];

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

for (let i = 0; i < BLOB_COUNT; i++) {
    blobs.push({
        x: rand(0, width),
        y: rand(0, height),
        r: rand(70, 170),
        dx: rand(-0.18, 0.18),
        dy: rand(-0.12, 0.12),
        color: BLOB_COLORS[Math.floor(rand(0, BLOB_COLORS.length))],
        alpha: rand(0.12, 0.25)
    });
}

function animateBackground() {
    ctx.clearRect(0, 0, width, height);

    for (let blob of blobs) {
        ctx.save();
        ctx.globalAlpha = blob.alpha;
        let grad = ctx.createRadialGradient(
            blob.x, blob.y, blob.r * 0.2,
            blob.x, blob.y, blob.r
        );
        grad.addColorStop(0, blob.color);
        grad.addColorStop(1, "#181d2300");
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.r, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.shadowColor = blob.color.replace(/88|55|44|33/, "AA");
        ctx.shadowBlur = blob.r * 0.5;
        ctx.fill();
        ctx.restore();

        // Move blob
        blob.x += blob.dx;
        blob.y += blob.dy;

        // Bounce off edges softly
        if (blob.x - blob.r < 0 || blob.x + blob.r > width) blob.dx *= -1;
        if (blob.y - blob.r < 0 || blob.y + blob.r > height) blob.dy *= -1;
    }

    requestAnimationFrame(animateBackground);
}

// Start animation after DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", animateBackground);
} else {
    animateBackground();
}
