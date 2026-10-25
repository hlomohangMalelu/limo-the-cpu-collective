(function (root, factory) {
    const isa =
        typeof module === "object" && module.exports
            ? require("./isa.js")
            : root.LIMO;

    const api = factory(isa);

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    } else {
        Object.assign(root.LIMO, api);
    }
})(typeof self !== "undefined" ? self : this, function (isa) {
    const {
        INSTRUCTIONS,
        IMM_BITS,
        NUM_REGS,
        REG_ALIASES,
        normalizeName,
        signedRange,
        mnemonicFor,
    } = isa;

    // ---------------------------------------------------------------------
    // Errors and parsing helpers
    // ---------------------------------------------------------------------

    class AssemblyError extends Error {
        constructor(line, message) {
            super(message);
            this.line = line;
        }
    }


    //paser
    const NUMBER = /^[+-]?(0x[\da-f]+|\d+)$/i;
    const LABEL_DEFINITION = /^([A-Za-z_][\w`’‘']*):/;

    function parseNumber(text, line, bits = IMM_BITS) {
        if (!NUMBER.test(text)) {
            throw new AssemblyError(
                line,
                `"${text}" is not a number (use decimal such as 10 or hex such as 0x1F).`
            );
        }

        const magnitude = parseInt(
            text.replace(/^[+-]/, ""),
            /0x/i.test(text) ? 16 : 10
        );

        const value = text.startsWith("-") ? -magnitude : magnitude;
        const { min, max } = signedRange(bits);

        if (value < min || value > max) {
            throw new AssemblyError(
                line,
                `${text} does not fit in ${bits} bits (allowed ${min} to ${max}).`
            );
        }

        return value;
    }


});    