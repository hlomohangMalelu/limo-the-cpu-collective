/*
 * The five-stage pipeline: IF -> ID -> EX -> MEM -> WB.
 *
 * clock(state) runs ONE clock cycle. Every stage reads the OLD pipeline
 * registers and produces a NEW one; all four are swapped in at the end,
 * like a real clock edge. The shapes of the registers are in
 * docs/DESIGN.md section 3.
 *
 * M3 = the pipeline core. There are NO hazard units yet (forwarding, the
 * load-use stall and the branch flush arrive in M4 as src/hazards.js), so a
 * program must be hazard-free: a result is used at least 3 instructions
 * after it is produced (the register file is written in the first half of
 * WB, so ID sees it), and the 2 instructions after a taken branch still run.
 */

(function (root, factory) {
    const isNode = typeof module === "object" && module.exports;
    const isa = isNode ? require("./isa.js") : root.LIMO;
    const assembler = isNode ? require("./assembler.js") : root.LIMO;
    const control = isNode ? require("./control.js") : root.LIMO;

    const api = factory(isa, assembler, control);

    if (isNode) {
        module.exports = api;
    } else {
        Object.assign(root.LIMO, api);
    }
})(typeof self !== "undefined" ? self : this, function (isa, assembler, control) {

    const { NUM_REGS, hex32 } = isa;
    const { disassemble } = assembler;
    const { controlUnit } = control;

    // An empty pipeline register: every other field is ignored.
    const BUBBLE = Object.freeze({ valid: false });

    const STAGE_NAMES = ["IF", "ID", "EX", "MEM", "WB"];

    /** A fresh processor holding `words` (machine code) in instruction memory. */
    function createState(words = []) {
        return {
            pc: 0, // address of the next instruction to fetch
            cycle: 0,
            regs: Array(NUM_REGS).fill(0),
            instructionMemory: words.slice(),
            dataMemory: {}, // byte address (word aligned) -> 32-bit word
            ifid: BUBBLE,
            idex: BUBBLE,
            exmem: BUBBLE,
            memwb: BUBBLE,
            changedReg: -1, // register written in the last cycle (-1: none)
            changedAddress: -1, // data-memory address written in the last cycle
            stats: { retired: 0, stalls: 0, flushes: 0 },
            trace: null, // what happened in the last cycle (see clock)
        };
    }

    
    /** True when every instruction has left the pipeline. */
    function isFinished(state) {
        return (
            state.pc >> 2 >= state.instructionMemory.length &&
            !state.ifid.valid &&
            !state.idex.valid &&
            !state.exmem.valid &&
            !state.memwb.valid
        );
    }


     /** The ALU: ADD, SUB, SLL or SRL on 32-bit values. */
    function alu(operation, a, b) {
        switch (operation) {
            case "ADD":
                return (a + b) | 0;
            case "SUB":
                return (a - b) | 0;
            case "SLL":
                return (a << (b & 31)) | 0;
            case "SRL":
                return (a >>> (b & 31)) | 0;
        }

        throw new Error(`Unknown ALU operation ${operation}`);
    }



    /** WB: write the result into the register file. */
    function writeBack(state, memwb, trace) {
        if (!memwb.valid) {
            return;
        }

        trace.active[4] = true;
        trace.instrs[4] = memwb.instr;

        const value = memwb.ctl.MemtoReg ? memwb.memData : memwb.aluResult;
        const writes = !!(memwb.ctl.RegWrite && memwb.rd !== 0);

        Object.assign(trace.values, { wbRd: memwb.rd, wbValue: value, wbWrites: writes });

        // x0 is hard-wired to 0, so writes to it are ignored.
        if (memwb.ctl.RegWrite && memwb.rd !== 0) {
            state.regs[memwb.rd] = value;
            state.changedReg = memwb.rd;
            trace.events.push(`x${memwb.rd} ← ${value}`);
        }

        state.stats.retired++;
    }



        /** MEM: load or store a word. Returns MEM/WB. */
    function memoryAccess(state, exmem, trace) {
        if (!exmem.valid) {
            return BUBBLE;
        }

        trace.active[3] = true;
        trace.instrs[3] = exmem.instr;

        const { ctl, aluResult: address } = exmem;
        let memData = 0;

        if ((ctl.MemRead || ctl.MemWrite) && address & 3) {
            throw new Error(
                `Memory fault: address ${hex32(address)} is not word-aligned (it must be a multiple of 4).`
            );
        }

        if (ctl.MemRead) {
            memData = state.dataMemory[address] | 0;
        }

        if (ctl.MemWrite) {
            state.dataMemory[address] = exmem.storeData;
            state.changedAddress = address;
            trace.events.push(`memory[${address}] ← ${exmem.storeData}`);
        }

        Object.assign(trace.values, {
            memOp: ctl.MemRead ? "read" : ctl.MemWrite ? "write" : "none",
            address,
            memValue: ctl.MemRead ? memData : exmem.storeData,
        });

        // Signals WB still needs; the others are dropped here.
        return {
            valid: true,
            pc: exmem.pc,
            instr: exmem.instr,
            rd: exmem.rd,
            aluResult: address,
            memData,
            ctl: { RegWrite: ctl.RegWrite, MemtoReg: ctl.MemtoReg },
        };
    }


    
    /** ID: decode, generate control signals, read the registers. Returns ID/EX. */
    function decodeStage(state, ifid, trace) {
        if (!ifid.valid) {
            return BUBBLE;
        }

        trace.active[1] = true;
        trace.instrs[1] = ifid.instr;

        const decoded = disassemble(ifid.instr);
        const ctl = controlUnit(decoded);

        Object.assign(trace.values, {
            mnemonic: decoded.mnemonic,
            syntax: decoded.syntax,
            rs1: decoded.rs1,
            rs2: decoded.rs2,
            rd: decoded.rd,
            rs1Val: state.regs[decoded.rs1],
            rs2Val: state.regs[decoded.rs2],
            imm: decoded.imm,
            ctl,
        });

        return {
            valid: true,
            pc: ifid.pc,
            instr: ifid.instr,
            rs1: decoded.rs1,
            rs2: decoded.rs2,
            rd: decoded.rd,
            rs1Val: state.regs[decoded.rs1],
            rs2Val: state.regs[decoded.rs2],
            imm: decoded.imm,
            funct3: decoded.funct3,
            ctl,
        };
    }

    /** IF: fetch the word at the PC and advance the PC. Returns IF/ID. */
    function fetch(state, trace) {
        const index = state.pc >> 2;

        if (index >= state.instructionMemory.length) {
            return BUBBLE; // past the end of the program
        }

        const instr = state.instructionMemory[index];

        trace.active[0] = true;
        trace.instrs[0] = instr;
        Object.assign(trace.values, { pc: state.pc, pcPlus4: state.pc + 4 });

        const fetched = {
            valid: true,
            pc: state.pc,
            pcPlus4: state.pc + 4,
            instr,
        };

        state.pc += 4;

        return fetched;
    }

        /** EX: ALU and branch decision. Returns EX/MEM. */
    function execute(idex, trace) {
        if (!idex.valid) {
            return BUBBLE;
        }

        trace.active[2] = true;
        trace.instrs[2] = idex.instr;

        const { ctl } = idex;
        const operandB = ctl.ALUSrc ? idex.imm : idex.rs2Val;
        const aluResult = alu(ctl.ALUctl, idex.rs1Val, operandB);

        // lekana (funct3 0) branches when rs1 - rs2 == 0, fapana (1) when it is not.
        const branchTaken =
            !!ctl.Branch && (idex.funct3 === 0 ? aluResult === 0 : aluResult !== 0);

        Object.assign(trace.values, {
            aluOp: ctl.ALUctl,
            aluA: idex.rs1Val,
            aluB: operandB,
            aluResult,
            branchTaken,
            branchTarget: idex.pc + idex.imm,
        });

        return {
            valid: true,
            pc: idex.pc,
            instr: idex.instr,
            rd: idex.rd,
            aluResult,
            storeData: idex.rs2Val,
            branchTaken,
            branchTarget: idex.pc + idex.imm,
            ctl: {
                RegWrite: ctl.RegWrite,
                MemRead: ctl.MemRead,
                MemWrite: ctl.MemWrite,
                MemtoReg: ctl.MemtoReg,
                Branch: ctl.Branch,
            },
        };
    }

});