/*
 * Control unit: a decoded instruction -> the control signals generated in ID.
 * Pure logic, no DOM. See docs/DESIGN.md section 3 for what each signal means.
 */

(function (root, factory) {
    const api = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    } else {
        Object.assign(root.LIMO, api);
    }
})(typeof self !== "undefined" ? self : this, function () {
    // Signals of a bubble or an unknown word: the instruction does nothing.
    const NO_CONTROL = Object.freeze({
        RegWrite: 0,
        ALUSrc: 0,
        ALUctl: "-",
        MemRead: 0,
        MemWrite: 0,
        MemtoReg: 0,
        Branch: 0,
    });

    // The ALU operation of every instruction. A new instruction needs a row here.
    const ALU_OPERATION = {
        kopanya: "ADD",
        tlosa: "SUB",
        ritsisa_t: "SLL",
        kopanya_h: "ADD",
        ritsisa_ht: "SLL",
        ritsisa_hl: "SRL",
        nka: "ADD", // address = rs1 + offset
        beha: "ADD", // address = rs1 + offset
        lekana: "SUB", // compare: rs1 - rs2 == 0 ?
        fapana: "SUB",
    };

    /**
     * @param {{mnemonic: ?string, syntax: ?string}} decoded
     *        the result of disassemble() in src/assembler.js
     * @returns {{RegWrite: number, ALUSrc: number, ALUctl: string,
     *            MemRead: number, MemWrite: number, MemtoReg: number,
     *            Branch: number}}
     */
    function controlUnit(decoded) {
        if (!decoded || !decoded.mnemonic) {
            return NO_CONTROL;
        }

        const syntax = decoded.syntax; // R, I, L (load), S (store) or B

        return {
            RegWrite: +(syntax === "R" || syntax === "I" || syntax === "L"),
            ALUSrc: +(syntax === "I" || syntax === "L" || syntax === "S"),
            ALUctl: ALU_OPERATION[decoded.mnemonic],
            MemRead: +(syntax === "L"),
            MemWrite: +(syntax === "S"),
            MemtoReg: +(syntax === "L"),
            Branch: +(syntax === "B"),
        };
    }

    return { NO_CONTROL, ALU_OPERATION, controlUnit };
});
