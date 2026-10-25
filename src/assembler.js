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


       /**
     * Parse the operands of one instruction into register numbers,
     * an immediate value, or a label.
     */
    function parseOperands(mnemonic, syntax, operands, line) {
        switch (syntax) {
            case "R":
                expectOperands(
                    operands,
                    3,
                    "rd, rs1, rs2",
                    mnemonic,
                    line
                );

                return {
                    rd: parseRegister(operands[0], line),
                    rs1: parseRegister(operands[1], line),
                    rs2: parseRegister(operands[2], line),
                };

            case "I": {
                expectOperands(
                    operands,
                    3,
                    "rd, rs1, immediate",
                    mnemonic,
                    line
                );

                const imm = parseNumber(operands[2], line);
                const isShift = INSTRUCTIONS[mnemonic].rv32i !== "addi";

                if (isShift && (imm < 0 || imm > 31)) {
                    throw new AssemblyError(
                        line,
                        `a shift amount must be between 0 and 31, not ${imm}.`
                    );
                }

                return {
                    rd: parseRegister(operands[0], line),
                    rs1: parseRegister(operands[1], line),
                    imm,
                };
            }

            case "L": {
                expectOperands(
                    operands,
                    2,
                    "rd, offset(rs1)",
                    mnemonic,
                    line
                );

                const mem = parseMemoryOperand(operands[1], line);

                return {
                    rd: parseRegister(operands[0], line),
                    rs1: mem.base,
                    imm: mem.imm,
                };
            }

            case "S": {
                expectOperands(
                    operands,
                    2,
                    "rs2, offset(rs1)",
                    mnemonic,
                    line
                );

                const mem = parseMemoryOperand(operands[1], line);

                return {
                    rs2: parseRegister(operands[0], line),
                    rs1: mem.base,
                    imm: mem.imm,
                };
            }

            case "B":
                expectOperands(
                    operands,
                    3,
                    "rs1, rs2, label",
                    mnemonic,
                    line
                );

                return {
                    rs1: parseRegister(operands[0], line),
                    rs2: parseRegister(operands[1], line),
                    label: operands[2],
                };
        }
    }

// ---------------------------------------------------------------------
    // Instruction encoding
    // ---------------------------------------------------------------------

    /**
     * Pack the fields of one instruction into a 32-bit word.
     * See docs/DESIGN.md section 1.3.
     */
    function encode({
        syntax,
        opcode,
        funct3,
        funct7 = 0,
        rd = 0,
        rs1 = 0,
        rs2 = 0,
        imm = 0,
    }) {
        let word;

        if (syntax === "R") {
            word =
                (funct7 << 22) |
                (rs2 << 18) |
                (rs1 << 14) |
                (funct3 << 11) |
                (rd << 7) |
                opcode;
        } else if (syntax === "I" || syntax === "L") {
            word =
                ((imm & 0x3fff) << 18) |
                (rs1 << 14) |
                (funct3 << 11) |
                (rd << 7) |
                opcode;
        } else {
            // S and B: the immediate is split around rs2, rs1 and funct3.
            word =
                (((imm >> 4) & 0x3ff) << 22) |
                (rs2 << 18) |
                (rs1 << 14) |
                (funct3 << 11) |
                ((imm & 15) << 7) |
                opcode;
        }

        return word >>> 0;
    }

    // ---------------------------------------------------------------------
    // First pass: parse instructions and collect labels
    // ---------------------------------------------------------------------

    /**
     * Strip comments, record labels, and parse each instruction line.
     * Errors are collected rather than thrown.
     */
    function firstPass(source, errors) {
        const instructions = [];
        const labels = {};

        source.split(/\r?\n/).forEach((rawLine, index) => {
            const line = index + 1;

            try {
                let text = rawLine.replace(/(#|\/\/).*$/, "").trim();

                if (!text) {
                    return;
                }

                const definition = text.match(LABEL_DEFINITION);

                if (definition) {
                    const name = normalizeName(definition[1]);

                    if (name in labels) {
                        throw new AssemblyError(
                            line,
                            `label "${definition[1]}" is defined twice.`
                        );
                    }

                    labels[name] = instructions.length * 4;
                    text = text.slice(definition[0].length).trim();

                    if (!text) {
                        return;
                    }
                }

                const [, word, rest] = text.match(/^(\S+)\s*(.*)$/);
                const mnemonic = normalizeName(word.toLowerCase());
                const spec = INSTRUCTIONS[mnemonic];

                if (!spec) {
                    throw new AssemblyError(
                        line,
                        `"${word}" is not a LIMO instruction. Check the spelling (for example kopanya, tlosa, nka, beha).`
                    );
                }

                const operands = rest
                    ? rest.split(",").map((operand) => operand.trim())
                    : [];

                const fields = parseOperands(
                    mnemonic,
                    spec.syntax,
                    operands,
                    line
                );

                instructions.push({
                    line,
                    address: instructions.length * 4,
                    mnemonic,
                    syntax: spec.syntax,
                    opcode: spec.opcode,
                    funct3: spec.funct3,
                    funct7: spec.funct7 ?? 0,
                    rd: 0,
                    rs1: 0,
                    rs2: 0,
                    imm: 0,
                    ...fields,
                });
            } catch (error) {
                if (!(error instanceof AssemblyError)) {
                    throw error;
                }

                errors.push({
                    line: error.line,
                    message: error.message,
                });

                // Reserve a slot for the bad instruction to keep addresses stable.
                instructions.push({
                    line,
                    address: instructions.length * 4,
                    bad: true,
                });
            }
        });

        return { instructions, labels };
    }

    // ---------------------------------------------------------------------
    // Second pass: resolve branch labels
    // ---------------------------------------------------------------------

    /**
     * Resolve branch labels into byte offsets relative to each branch's
     * own address.
     */
    function resolveBranches(instructions, labels, errors) {
        const { min, max } = signedRange(IMM_BITS);

        for (const inst of instructions.filter(
            (item) => item.syntax === "B" && !item.bad
        )) {
            const target = labels[normalizeName(inst.label)];

            if (target === undefined) {
                errors.push({
                    line: inst.line,
                    message: `unknown label "${inst.label}". Define it as "${inst.label}:" before an instruction.`,
                });

                inst.bad = true;
                continue;
            }

            inst.imm = target - inst.address;

            if (inst.imm < min || inst.imm > max) {
                errors.push({
                    line: inst.line,
                    message: `branch target "${inst.label}" is too far away (limit ${min} to ${max} bytes, this is ${inst.imm}).`,
                });

                inst.bad = true;
            }
        }
    }

    // ---------------------------------------------------------------------
    // Public assembler API
    // ---------------------------------------------------------------------

    /**
     * @param {string} source
     * @returns {{
     *   ok: boolean,
     *   instructions: object[],
     *   words: number[],
     *   labels: object,
     *   errors: {line: number, message: string}[]
     * }}
     */
    function assemble(source) {
        const errors = [];
        const { instructions, labels } = firstPass(source, errors);

        resolveBranches(instructions, labels, errors);
        errors.sort((a, b) => a.line - b.line);

        if (errors.length) {
            return {
                ok: false,
                instructions: [],
                words: [],
                labels,
                errors,
            };
        }

        instructions.forEach((inst) => {
            inst.word = encode(inst);
        });

        return {
            ok: true,
            instructions,
            words: instructions.map((instruction) => instruction.word),
            labels,
            errors,
        };
    }

    // ---------------------------------------------------------------------
    // Disassembler
    // ---------------------------------------------------------------------

    /**
     * Decode a machine word back into its fields and assembly text.
     * Unknown opcodes return mnemonic: null.
     */
    function disassemble(word) {
        const opcode = word & 127;
        const rdField = (word >> 7) & 15;
        const funct3 = (word >> 11) & 7;
        const funct7 = word >>> 22;
        const mnemonic = mnemonicFor(opcode, funct3, funct7) ?? null;

        if (!mnemonic) {
            return {
                mnemonic: null,
                syntax: null,
                text: "?",
                word: word >>> 0,
            };
        }

        const syntax = INSTRUCTIONS[mnemonic].syntax;
        const rs1 = (word >> 14) & 15;

        const rs2 =
            syntax === "R" || syntax === "S" || syntax === "B"
                ? (word >> 18) & 15
                : 0;

        // Arithmetic shifts sign-extend the immediate.
        // S/B rejoin imm[13:4] and imm[3:0].
        const imm =
            syntax === "S" || syntax === "B"
                ? ((word >> 22) << 4) | rdField
                : syntax === "R"
                  ? 0
                  : (word | 0) >> 18;

        const rd = syntax === "S" || syntax === "B" ? 0 : rdField;

        let text;

        if (syntax === "R") {
            text = `${mnemonic} x${rd}, x${rs1}, x${rs2}`;
        } else if (syntax === "I") {
            text = `${mnemonic} x${rd}, x${rs1}, ${imm}`;
        } else if (syntax === "L") {
            text = `${mnemonic} x${rd}, ${imm}(x${rs1})`;
        } else if (syntax === "S") {
            text = `${mnemonic} x${rs2}, ${imm}(x${rs1})`;
        } else {
            text = `${mnemonic} x${rs1}, x${rs2}, ${
                imm >= 0 ? "+" : ""
            }${imm}`;
        }

        return {
            mnemonic,
            syntax,
            rd,
            rs1,
            rs2,
            imm,
            funct3,
            text,
            word: word >>> 0,
        };
    }

    return {
        AssemblyError,
        encode,
        assemble,
        disassemble,
    };
});  