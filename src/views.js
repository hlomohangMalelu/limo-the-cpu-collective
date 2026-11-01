/*
 * Processor view: draws the pipeline state into the page.
 * No simulation logic here: it only reads the state made by src/pipeline.js.
 *
 *   renderProcessor(state, {decimal})  draws everything below
 *   - stage table            which instruction is in IF, ID, EX, MEM, WB
 *   - pipeline registers     IF/ID, ID/EX, EX/MEM, MEM/WB and their fields
 *   - instruction memory     every instruction and the stage it is in
 *   - data memory            words, the last write highlighted
 *   - execution info         cycles, instructions retired, CPI
 *   - datapath               the units of docs/DESIGN.md section 2.2; the ones
 *                            that worked this cycle are "(active)" with values
 *   - control                the control signals made in ID and those in flight
 */

(function (root, factory) {
    const isNode = typeof module === "object" && module.exports;
    const isa = isNode ? require("./isa.js") : root.LIMO;
    const assembler = isNode ? require("./assembler.js") : root.LIMO;
    const pipeline = isNode ? require("./pipeline.js") : root.LIMO;

    const api = factory(isa, assembler, pipeline);

    if (isNode) {
        module.exports = api;
    } else {
        Object.assign(root.LIMO, api);
    }
})(typeof self !== "undefined" ? self : this, function (isa, assembler, pipeline) {
    const { hex32 } = isa;
    const { disassemble } = assembler;
    const { STAGE_NAMES, stagesByAddress } = pipeline;

    const $ = (id) => document.getElementById(id);

    const escapeHtml = (text) =>
        String(text).replace(/[&<>"]/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
        })[c]);

    const textOf = (word) =>
        word === null || word === undefined ? "–" : disassemble(word).text;

    // Fields of each pipeline register, in the order of docs/DESIGN.md section 3.
    const REGISTER_FIELDS = {
        "IF/ID": ["pc", "pcPlus4", "instr"],
        "ID/EX": ["pc", "instr", "rs1", "rs2", "rd", "rs1Val", "rs2Val", "imm", "funct3", "ctl"],
        "EX/MEM": ["pc", "instr", "rd", "aluResult", "storeData", "branchTaken", "branchTarget", "ctl"],
        "MEM/WB": ["pc", "instr", "rd", "aluResult", "memData", "ctl"],
    };

    // How to show a field: an address, a register number, or a 32-bit value.
    const ADDRESS_FIELDS = ["pc", "pcPlus4", "branchTarget", "instr"];
    const NUMBER_FIELDS = ["rs1", "rs2", "rd", "funct3"];

    function formatField(name, value, decimal) {
        if (name === "ctl") {
            return Object.entries(value)
                .map(([signal, v]) => `${signal}=${v}`)
                .join(" ");
        }

        if (name === "branchTaken") {
            return value ? "yes" : "no";
        }

        if (ADDRESS_FIELDS.includes(name)) {
            return hex32(value);
        }

        if (NUMBER_FIELDS.includes(name)) {
            return name === "funct3" ? value : `x${value}`;
        }

        return decimal ? value | 0 : hex32(value);
    }

    // ------------------------------------------------------------------

    function renderStages(state) {
        const trace = state.trace;

        $("stageTable").innerHTML = STAGE_NAMES.map((name, i) => {
            const active = trace && trace.active[i];
            const word = trace ? trace.instrs[i] : null;

            return `
                <tr class="${active ? "" : "bubble"}">
                    <td><b>${name}</b></td>
                    <td>${active ? escapeHtml(textOf(word)) : "bubble"}</td>
                </tr>
            `;
        }).join("");
    }

    function renderPipelineRegisters(state, decimal) {
        const registers = {
            "IF/ID": state.ifid,
            "ID/EX": state.idex,
            "EX/MEM": state.exmem,
            "MEM/WB": state.memwb,
        };

        $("pipeRegs").innerHTML = Object.entries(registers)
            .map(([name, register]) => {
                if (!register.valid) {
                    return `
                        <div class="preg empty">
                            <h3>${name}</h3>
                            <p>bubble</p>
                        </div>
                    `;
                }

                const rows = REGISTER_FIELDS[name]
                    .map(
                        (field) => `
                            <dt>${field}</dt>
                            <dd>${escapeHtml(formatField(field, register[field], decimal))}</dd>
                        `
                    )
                    .join("");

                return `
                    <div class="preg">
                        <h3>${name} <small>${escapeHtml(textOf(register.instr))}</small></h3>
                        <dl>${rows}</dl>
                    </div>
                `;
            })
            .join("");
    }

    function renderInstructionMemory(state, breakpoints) {
        const stages = stagesByAddress(state);

        $("imemTable").innerHTML = state.instructionMemory
            .map((word, index) => {
                const address = index * 4;
                const isBreakpoint = breakpoints.has(address);

                return `
                    <tr class="${stages[address] ? "current" : ""}">
                        <td><input type="checkbox" class="bp" data-address="${address}"
                            aria-label="Breakpoint at ${hex32(address)}" ${isBreakpoint ? "checked" : ""}></td>
                        <td>${hex32(address)}</td>
                        <td>${stages[address] || ""}</td>
                        <td>${escapeHtml(textOf(word))}</td>
                    </tr>
                `;
            })
            .join("");
    }

    /** The first 16 words, plus every higher address that was written. */
    function renderDataMemory(state, decimal) {
        const written = Object.keys(state.dataMemory).map(Number);
        const last = Math.max(60, ...written);
        let rows = "";

        for (let address = 0; address <= last; address += 4) {
            const isWritten = address in state.dataMemory;
            const value = state.dataMemory[address] | 0;

            rows += `
                <tr class="${address === state.changedAddress ? "changed" : ""}">
                    <td>${hex32(address)}</td>
                    <td>${decimal ? value : hex32(value)}</td>
                    <td>${isWritten ? "" : "·"}</td>
                </tr>
            `;
        }

        $("dmemTable").innerHTML = rows;
    }

    function renderInfo(state) {
        const { retired, stalls, flushes } = state.stats;
        const cpi = retired ? (state.cycle / retired).toFixed(2) : "–";

        $("info").innerHTML = [
            ["Cycles", state.cycle],
            ["Instrs. retired", retired],
            ["CPI", cpi],
            ["Stalls", stalls],
            ["Flushes", flushes],
        ]
            .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
            .join("");
    }

 // Datapath: every unit of the block diagram, active ones outlined
    // ------------------------------------------------------------------

    /** A bar for a pipeline register, as in the block diagram. */
    const bar = (name) => `<div class="pbar" title="${name} pipeline register"><span>${name}</span></div>`;

    /** One unit. `lines` are its live values; it is drawn only as active when `active`. */
    function unit(name, active, lines = [], { later = "" } = {}) {
        const body = lines.length
            ? lines.map((line) => `<div class="uval">${escapeHtml(line)}</div>`).join("")
            : "";

        return `
            <div class="unit ${active ? "active" : ""} ${later ? "later" : ""}">
                <b>${escapeHtml(name)}${active ? " (active)" : ""}</b>
                ${body}
                ${later ? `<div class="uval">${later}</div>` : ""}
            </div>
        `;
    }

    function renderDatapath(state, decimal) {
        const trace = state.trace;
        const a = trace ? trace.active : [false, false, false, false, false];
        const v = trace ? trace.values : {};
        const num = (x) => (decimal ? x | 0 : hex32(x));
        const instr = (i) => (a[i] ? textOf(trace.instrs[i]) : "");
        const ex = a[2] ? disassemble(trace.instrs[2]) : {};

        const idUses2 = ["R", "S", "B"].includes(v.syntax);
        const activeSignals = v.ctl
            ? Object.entries(v.ctl).filter(([, value]) => value && value !== "-").map(([k, value]) => (value === 1 ? k : `${k}=${value}`))
            : [];

        const stage = (name, units) => `<div class="stage s-${name.toLowerCase()}"><h3>${name}</h3>${units.join("")}</div>`;

        $("datapath").innerHTML = `
            <div class="dp">
                ${stage("IF", [
                    unit("PC", a[0], a[0] ? [`pc ${hex32(v.pc)}`, `PC + 4 = ${hex32(v.pcPlus4)}`] : [`pc ${hex32(state.pc)}`]),
                    unit("Instr. memory", a[0], a[0] ? [instr(0)] : []),
                ])}
                ${bar("IF/ID")}
                ${stage("ID", [
                    unit("Register file", a[1] || !!v.wbWrites,
                        [
                            ...(a[1] ? [`rs1 x${v.rs1} = ${num(v.rs1Val)}`] : []),
                            ...(a[1] && idUses2 ? [`rs2 x${v.rs2} = ${num(v.rs2Val)}`] : []),
                            ...(v.wbWrites ? [`write x${v.wbRd} ← ${num(v.wbValue)}`] : []),
                        ]),
                    unit("Control", a[1], a[1] ? [activeSignals.join(" ") || "no signals"] : []),
                    unit("Immediate", a[1] && v.syntax !== "R", a[1] && v.syntax !== "R" ? [`imm ${v.imm}`] : []),
                ])}
                ${bar("ID/EX")}
                ${stage("EX", [
                    unit("Fwd muxes", false, [], { later: "M4" }),
                    unit("ALU", a[2], a[2] ? [`${v.aluOp}: ${num(v.aluA)}, ${num(v.aluB)}`, `result ${num(v.aluResult)}`] : []),
                    unit("Branch", a[2] && ex.syntax === "B",
                        a[2] && ex.syntax === "B" ? [v.branchTaken ? `taken → ${hex32(v.branchTarget)}` : "not taken"] : []),
                ])}
                ${bar("EX/MEM")}
                ${stage("MEM", [
                    unit("Data mem", a[3] && v.memOp !== "none",
                        a[3] && v.memOp !== "none" ? [`${v.memOp} [${v.address}]`, `value ${num(v.memValue)}`] : []),
                    unit("Hazard unit", false, [], { later: "M4: stall · flush" }),
                ])}
                ${bar("MEM/WB")}
                ${stage("WB", [
                    unit("WB mux", a[4] && !!v.wbWrites, a[4] && v.wbWrites ? [`x${v.wbRd} ← ${num(v.wbValue)}`] : []),
                ])}
            </div>
            <p class="dpnote">${trace ? `Cycle ${state.cycle}: ${a.filter(Boolean).length} of 5 stages busy.` : "Press Step to run the first clock cycle."}</p>
        `;
    }



});