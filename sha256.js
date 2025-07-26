// Pure JavaScript SHA-256 for browser (if window.crypto.subtle is not available)
// Usage: window.sha256("text").then(hash => ...)

window.sha256 = async function sha256(ascii) {
    // Function adapted from https://geraintluff.github.io/sha256/
    function rightRotate(v, amount) {
        return (v>>>amount) | (v<<(32-amount));
    }
    var mathPow = Math.pow;
    var maxWord = Math.pow(2, 32);
    var result = "";

    var words = [], asciiBitLength = ascii.length*8;

    var hash = sha256.h = sha256.h || [];
    var k = sha256.k = sha256.k || [];
    var primeCounter = k.length;

    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (var i = 0; i < 313; i += candidate) {
                isComposite[i] = candidate;
            }
            hash[primeCounter] = (mathPow(candidate, .5)*maxWord)|0;
            k[primeCounter++] = (mathPow(candidate, 1/3)*maxWord)|0;
        }
    }

    ascii += "\x80"; // Append Ƈ' bit (plus zero padding)
    while (ascii.length % 64 - 56) ascii += "\x00";
    for (var i=0; i<ascii.length; i++) {
        var j = ascii.charCodeAt(i);
        if (j>>8) return; // ASCII check
        words[i>>2] |= j << ((3-i)%4)*8;
    }
    words[words.length] = ((asciiBitLength/Math.pow(2, 32))|0);
    words[words.length] = (asciiBitLength)

    for (var j=0; j<words.length;) {
        var w = words.slice(j, j += 16);
        var oldHash = hash.slice(0);
        for (var i=16; i<64; i++) {
            var s0 = rightRotate(w[i-15],7) ^ rightRotate(w[i-15],18) ^ (w[i-15]>>>3);
            var s1 = rightRotate(w[i-2],17) ^ rightRotate(w[i-2],19) ^ (w[i-2]>>>10);
            w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
        }
        var a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
        for (var i=0; i<64; i++) {
            var S1 = rightRotate(e,6) ^ rightRotate(e,11) ^ rightRotate(e,25);
            var ch = (e & f) ^ (~e & g);
            var temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
            var S0 = rightRotate(a,2) ^ rightRotate(a,13) ^ rightRotate(a,22);
            var maj = (a & b) ^ (a & c) ^ (b & c);
            var temp2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + temp1) | 0;
            d = c; c = b; b = a; a = (temp1 + temp2) | 0;
        }
        hash[0] = (hash[0]+a)|0;
        hash[1] = (hash[1]+b)|0;
        hash[2] = (hash[2]+c)|0;
        hash[3] = (hash[3]+d)|0;
        hash[4] = (hash[4]+e)|0;
        hash[5] = (hash[5]+f)|0;
        hash[6] = (hash[6]+g)|0;
        hash[7] = (hash[7]+h)|0;
    }
    for (var i=0; i<hash.length; i++) {
        for (var j=3; j+1; j--) {
            var b = (hash[i] >> (j*8)) & 255;
            result += ((b>>4).toString(16)) + ((b&0xf).toString(16));
        }
    }
    return Promise.resolve(result);
}
