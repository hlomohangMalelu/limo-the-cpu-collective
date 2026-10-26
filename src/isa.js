

(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.LIMO = Object.assign(root.LIMO || {}, api);
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const IMM_BITS = 14;
    const NUM_REGS = 16;

    // Register names by number (x0..x15): English alias and Sesotho name.
    const REG_ALIASES = [
        'zero', 'ra', 'sp', 'a0', 'a1', 't0', 't1', 't2',
        't3', 's0', 's1', 's2', 's3', 's4', 's5', 's6'
    ];

    const REG_SESOTHO = [
        'khoamo', 'bolulo', 'khetsi', 'karabo', 'karabo',
        'nakoana', 'nakoana', 'nakoana', 'nakoana',
        'boloka', 'boloka', 'boloka', 'boloka', 'boloka',
        'boloka', 'boloka'
    ];

    /**
     * Instruction table. `syntax` says how the operands are written:
     *   R  rd, rs1, rs2      I  rd, rs1, imm      L  rd, imm(rs1)
     *   S  rs2, imm(rs1)     B  rs1, rs2, label
     * `rv32i` is the RISC-V instruction it is derived from.
     */
    const INSTRUCTIONS = {
        kopanya: {
            syntax: 'R',
            opcode: 0x33,
            funct3: 0,
            funct7: 0,
            rv32i: 'add'
        },

        tlosa: {
            syntax: 'R',
            opcode: 0x33,
            funct3: 0,
            funct7: 32,
            rv32i: 'sub'
        },

        ritsisa_t: {
            syntax: 'R',
            opcode: 0x33,
            funct3: 1,
            funct7: 0,
            rv32i: 'sll'
        },

        kopanya_h: {
            syntax: 'I',
            opcode: 0x13,
            funct3: 0,
            rv32i: 'addi'
        },

        ritsisa_ht: {
            syntax: 'I',
            opcode: 0x13,
            funct3: 1,
            rv32i: 'slli'
        },

        ritsisa_hl: {
            syntax: 'I',
            opcode: 0x13,
            funct3: 5,
            rv32i: 'srli'
        },

        nka: {
            syntax: 'L',
            opcode: 0x03,
            funct3: 2,
            rv32i: 'lw'
        },

        beha: {
            syntax: 'S',
            opcode: 0x23,
            funct3: 2,
            rv32i: 'sw'
        },

        lekana: {
            syntax: 'B',
            opcode: 0x63,
            funct3: 0,
            rv32i: 'beq'
        },

        fapana: {
            syntax: 'B',
            opcode: 0x63,
            funct3: 1,
            rv32i: 'bne'
        }
    };

    // Bit fields of each format: [high bit, low bit, css class, label].
    const OPCODE = [6, 0, 'op', 'opcode'];
    const RD = [10, 7, 'rd', 'rd'];
    const FUNCT3 = [13, 11, 'f3', 'funct3'];

    const RS1 = [17, 14, 'rs1', 'rs1'];
    const RS2 = [21, 18, 'rs2', 'rs2'];

    const R_FIELDS = [
        [31, 22, 'f7', 'funct7'],
        RS2,
        RS1,
        FUNCT3,
        RD,
        OPCODE
    ];

    const I_FIELDS = [
        [31, 18, 'imm', 'imm[13:0]'],
        RS1,
        FUNCT3,
        RD,
        OPCODE
    ];

    const S_FIELDS = [
        [31, 22, 'imm', 'imm[13:4]'],
        RS2,
        RS1,
        FUNCT3,
        [10, 7, 'imm', 'imm[3:0]'],
        OPCODE
    ];

    const FIELDS_BY_SYNTAX = {
        R: R_FIELDS,
        I: I_FIELDS,
        L: I_FIELDS,
        S: S_FIELDS,
        B: S_FIELDS
    };

    /**
     * Lexical rule: backtick, curly quotes and the apostrophe
     * all mean the same as underscore.
     */
    const normalizeName = text => text.replace(/[`’‘']/g, '_');

    /** Inclusive range of an n-bit signed integer. */
    const signedRange = bits => ({
        min: -(2 ** (bits - 1)),
        max: 2 ** (bits - 1) - 1
    });

    /**
     * Find the mnemonic with this opcode / funct3
     * (and funct7 for R-type).
     */
    function mnemonicFor(opcode, funct3, funct7) {
        return Object.keys(INSTRUCTIONS).find(name => {
            const i = INSTRUCTIONS[name];

            return (
                i.opcode === opcode &&
                i.funct3 === funct3 &&
                (i.syntax !== 'R' || i.funct7 === funct7)
            );
        });
    }

    const hex32 = value =>
        '0x' + (value >>> 0).toString(16).padStart(8, '0');

    const bin32 = value =>
        (value >>> 0).toString(2).padStart(32, '0');

    /**
     * Split a word into its colour-coded fields:
     * [{cls, label, bits}], high bit first.
     */
    function splitFields(word, syntax) {
        const bits = bin32(word);

        return FIELDS_BY_SYNTAX[syntax].map(
            ([hi, lo, cls, label]) => ({
                cls,
                label,
                bits: bits.slice(31 - hi, 32 - lo)
            })
        );
    }

    return {
        IMM_BITS,
        NUM_REGS,
        REG_ALIASES,
        REG_SESOTHO,
        INSTRUCTIONS,
        FIELDS_BY_SYNTAX,
        normalizeName,
        signedRange,
        mnemonicFor,
        hex32,
        bin32,
        splitFields
    };
});
