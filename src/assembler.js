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


    //

        function parseRegister(text, line) {
        const lower = text.toLowerCase();
        const numbered = lower.match(/^x(\d+)$/);

        if (numbered) {
            if (+numbered[1] >= NUM_REGS) {
                throw new AssemblyError(
                    line,
                    `register ${text} does not exist; LIMO has x0 to x${NUM_REGS - 1}.`
                );
            }

            return +numbered[1];
        }

        const index = REG_ALIASES.indexOf(lower);

        if (index < 0) {
            throw new AssemblyError(
                line,
                `"${text}" is not a register. Use x0–x${NUM_REGS - 1} or a name such as t0, s1, a0.`
            );
        }

        return index;
    }


        /**
     * Parse a memory operand.
     * Example: "8(x5)" -> { imm: 8, base: 5 }
     */
    function parseMemoryOperand(text, line) {
        const match = text.match(/^(.+)\(([^()]+)\)$/);

        if (!match) {
            throw new AssemblyError(
                line,
                `write the address as offset(register), for example 0(x5); you wrote "${text}".`
            );
        }

        return {
            imm: parseNumber(match[1].trim(), line),
            base: parseRegister(match[2].trim(), line),
        };
    }


    function expectOperands(operands, count, shape, mnemonic, line) {
        if (operands.length !== count) {
            throw new AssemblyError(
                line,
                `${mnemonic} needs ${count} operands (${shape}) but you wrote ${operands.length}.`
            );
        }
    }

});    