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

});    