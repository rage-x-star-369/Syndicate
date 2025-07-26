// Simple SHA-256 hashing for browsers
// Modern browsers: uses crypto.subtle. Fallback for older browsers provided.
// Usage: await sha256("password")

async function sha256(str) {
    if (window.crypto && window.crypto.subtle) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(x => ('00' + x.toString(16)).slice(-2)).join('');
    } else {
        // Fallback for older browsers (not recommended for production)
        return sha256Sync(str);
    }
}

// Synchronous (slow, legacy) SHA-256 implementation (from https://geraintluff.github.io/sha256/)
function sha256Sync(ascii) {
    function rightRotate(v, amount) {
        return (v>>>amount) | (v<<(32-amount));
    }
    var mathPow = Math.pow;
    var maxWord = Math.pow(2, 32);
    var result = "";
    var words = [], asciiBitLength = ascii.length*8;
    var hash = sha256Sync.h = sha256Sync.h || [];
    var k = sha256Sync.k = sha256Sync.k || [];
    var primeCounter = k.length;
    var i, j, l, s0, s1, maj, ch, temp1, temp2, W = new Array(64);

    if (!k.length) {
        var isPrime = {};
        for (i=2; primeCounter<64; i++) {
            if (!isPrime[i]) {
                for (j=0; j<313; j+=i) isPrime[j] = i;
                hash[primeCounter] = (mathPow(i, .5)*maxWord)|0;
                k[primeCounter++] = (mathPow(i, 1/3)*maxWord)|0;
            }
        }
    }

    ascii += '\x80';
    while (ascii.length%64 - 56) ascii += '\x00';
    for (i=0; i<ascii.length; i++) {
        words[i>>2] |= ascii.charCodeAt(i) << ((3-i)%4)*8;
    }
    words[words.length] = ((asciiBitLength/Math.pow(2,32))|0);
    words[words.length] = (asciiBitLength)

    for (j=0; j<words.length;) {
        var w = words.slice(j, j += 16), oldHash = hash.slice(0);
        for (i=0; i<64; i++) {
            if (i<16) W[i] = w[i] | 0;
            else {
                s0 = rightRotate(W[i-15], 7) ^ rightRotate(W[i-15], 18) ^ (W[i-15]>>>3);
                s1 = rightRotate(W[i-2], 17) ^ rightRotate(W[i-2], 19) ^ (W[i-2]>>>10);
                W[i] = (W[i-16] + s0 + W[i-7] + s1) | 0;
            }
            temp1 = (hash[7] + (rightRotate(hash[4],6)^rightRotate(hash[4],11)^rightRotate(hash[4],25)) +
                    ((hash[4]&hash[5])^((~hash[4])&hash[6])) + k[i] + W[i]) | 0;
            temp2 = (rightRotate(hash[0],2)^rightRotate(hash[0],13)^rightRotate(hash[0],22)) +
                    ((hash[0]&hash[1])^(hash[0]&hash[2])^(hash[1]&hash[2]));
            hash = [(temp1+temp2)|0, hash[0], hash[1], hash[2], (hash[3]+temp1)|0, hash[4], hash[5], hash[6]];
        }
        for (i=0; i<8; i++) hash[i] = (hash[i] + oldHash[i])|0;
    }
    for (i=0; i<8; i++) {
        for (j=3; j+1; j--) {
            var b = (hash[i]>>(j*8))&255;
            result += ((b>>4).toString(16)) + ((b&15).toString(16));
        }
    }
    return result;
}
