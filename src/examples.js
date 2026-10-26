

(function (root, factory) {
    const api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    } else {
        root.LIMO = Object.assign(root.LIMO || {}, api);
    }
})(typeof self !== "undefined" ? self : this, function () {
    const EXAMPLES = {
        branch: `# One branch that is taken and one that is not, plus shifts and hex.
        kopanya_h  x5, x0, 0x0F
        ritsisa_ht x6, x5, 2     # x6 = x5 << 2
        ritsisa_hl x7, x6, 1     # x7 = x6 >> 1
        lekana     x5, x6, skip  # 15 != 60, not taken
        fapana     x5, x6, done  # 15 != 60, taken
skip:   kopanya_h  x8, x0, 99    # skipped
done:   kopanya_h  x9, x0, 7
`,

        memory: `# Store a value, load it back, and use it straight away.
        kopanya_h x5, x0, 10
        kopanya_h x6, x0, 25
        kopanya   x7, x5, x6     # x7 = 35
        beha      x7, 0(x0)      # memory[0] = 35
        nka       x8, 0(x0)      # x8 = memory[0]
        kopanya   x9, x8, x5     # uses x8 right after the load
        tlosa     x10, x9, x6    # x10 = x9 - x6
`,

        sum: `# Sum of 1..5 with a loop. Result (15) ends in x5 and at address 0.
        kopanya_h x5, x0, 0      # sum = 0
        kopanya_h x6, x0, 5      # counter = 5
loop:   kopanya   x5, x5, x6     # sum = sum + counter
        kopanya_h x6, x6, -1     # counter = counter - 1
        fapana    x6, x0, loop   # repeat while counter != 0
        beha      x5, 0(x0)      # store the result
`,
    };

    return { EXAMPLES };
});
