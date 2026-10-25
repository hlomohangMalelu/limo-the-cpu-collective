/*
 * Page wiring for the assembler view.
 * All assembling is done by src/assembler.js; this file only draws.
 */

(function () {
    const {
        assemble,
        disassemble,
        INSTRUCTIONS,
        REG_ALIASES,
        REG_SESOTHO,
        splitFields,
        hex32,
        EXAMPLES,
    } = window.LIMO;

    const $ = (id) => document.getElementById(id);

    const escapeHtml = (text) =>
        text.replace(/[&<>"]/g, (c) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
        })[c]);

    let mode = "hex";

    // Register file contents. No program runs in M2, so every register
    // holds 0; the pipeline (M3) will pass its real register values and
    // the index it just wrote to renderRegs().
    const regs = Array(16).fill(0);

    // Program counter (sebaka). It stays 0 until the pipeline exists in M3.
    let pc = 0;

    let timer = null;

    const OPERANDS = {
        R: "rd, rs1, rs2",
        I: "rd, rs1, imm",
        L: "rd, imm(rs1)",
        S: "rs2, imm(rs1)",
        B: "rs1, rs2, label",
    };

    // ------------------------------------------------------------------
    // Source editor helpers
    // ------------------------------------------------------------------

    function updateLineNumbers() {
        const count = $("src").value.split("\n").length;

        $("lines").textContent = Array.from(
            { length: count },
            (_, i) => i + 1
        ).join("\n");
    }

    function message(text, className = "", line = 0) {
        const row = document.createElement("div");
        row.className = className;

        if (line) {
            const link = document.createElement("button");

            link.className = "linkish";
            link.textContent = text;
            link.onclick = () => jumpToLine(line);

            row.append(link);
        } else {
            row.textContent = text;
        }

        $("output").append(row);
    }

    function jumpToLine(line) {
        const area = $("src");
        const lines = area.value.split("\n");

        const start =
            lines.slice(0, line - 1).join("\n").length +
            (line > 1 ? 1 : 0);

        area.focus();
        area.setSelectionRange(
            start,
            start + lines[line - 1].length
        );

        const lineHeight =
            parseFloat(getComputedStyle(area).lineHeight) || 20;

        area.scrollTop = Math.max(0, (line - 3) * lineHeight);
        $("lines").scrollTop = area.scrollTop;
    }

    // ------------------------------------------------------------------
    // Machine-code display
    // ------------------------------------------------------------------

    function renderCode(result) {
        const box = $("code");

        if (!result.ok || !result.instructions.length) {
            box.innerHTML = `
                <div class="empty">
                    ${
                        result.ok
                            ? "Nothing to assemble yet."
                            : "Fix the errors to see machine code."
                    }
                </div>
            `;

            return;
        }

        const labelAt = {};

        Object.entries(result.labels).forEach(([name, address]) => {
            (labelAt[address] ??= []).push(name);
        });

        box.innerHTML = result.instructions
            .map((inst) => {
                const fields = splitFields(inst.word, inst.syntax);

                const bits =
                    mode === "hex"
                        ? `<span>${hex32(inst.word)}</span>`
                        : fields
                              .map(
                                  (field) => `
                                      <span
                                          class="f-${field.cls}"
                                          title="${field.label}"
                                      >${field.bits}</span>
                                  `
                              )
                              .join("");

                const label = labelAt[inst.address]
                    ? `
                        <span class="lbl">
                            ${escapeHtml(
                                labelAt[inst.address].join(", ")
                            )}:
                        </span>
                    `
                    : "";

                return (
                    `<div class="coderow ${mode}">` +
                    `<span class="addr">${inst.address
                        .toString(16)
                        .padStart(4, "0")}</span>` +
                    `<span class="word">${bits}</span>` +
                    `<span class="dis">${label}${escapeHtml(
                        disassemble(inst.word).text
                    )}</span>` +
                    `<span class="ln" title="source line">L${inst.line}</span>` +
                    `</div>`
                );
            })
            .join("");

        if (mode === "hex") {
            // In hex mode, field details are shown on hover/tap.
            box.querySelectorAll(".coderow").forEach((row, i) => {
                row.title = splitFields(
                    result.instructions[i].word,
                    result.instructions[i].syntax
                )
                    .map((field) => `${field.label}=${field.bits}`)
                    .join("  ");
            });
        }
    }

    // ------------------------------------------------------------------
    // Assembly execution and status display
    // ------------------------------------------------------------------

    function run() {
        clearTimeout(timer);

        const result = assemble($("src").value);

        $("output").innerHTML = "";

        renderCode(result);

        if (result.ok) {
            const n = result.words.length;

            $("count").textContent =
                `${n} instruction${n === 1 ? "" : "s"} · ${n * 4} bytes`;

            $("asmStatus").textContent = n ? "Assembled ✓" : "Ready";
            $("asmStatus").className =
                "status-chip " + (n ? "ok" : "");

            $("status").textContent = n
                ? `Assembled ${n} instruction${
                      n === 1 ? "" : "s"
                  } with no errors.`
                : "Ready";

            if (n) {
                const labelCount = Object.keys(result.labels).length;

                message(
                    `Assembled ${n} instruction${
                        n === 1 ? "" : "s"
                    }, ${labelCount} label${
                        labelCount === 1 ? "" : "s"
                    }. No errors.`,
                    "okmsg"
                );
            }
        } else {
            $("count").textContent = "0 instructions";

            const errorCount = result.errors.length;

            $("asmStatus").textContent =
                `${errorCount} error${errorCount === 1 ? "" : "s"} ✗`;

            $("asmStatus").className = "status-chip bad";

            $("status").textContent =
                `${errorCount} error${
                    errorCount === 1 ? "" : "s"
                }: click a message to jump to the line.`;

            result.errors.forEach((error) => {
                message(
                    `Line ${error.line}: ${error.message}`,
                    "err",
                    error.line
                );
            });
        }
    }

    const runSoon = () => {
        clearTimeout(timer);
        timer = setTimeout(run, 250);
    };

    function load(text) {
        $("src").value = text;

        updateLineNumbers();
        run();
    }

    // ------------------------------------------------------------------
    // ISA reference table
    // ------------------------------------------------------------------

    // Generate the reference table from the ISA so it cannot drift from it.
    $("isaTable").innerHTML = Object.entries(INSTRUCTIONS)
        .map(
            ([name, instruction]) => `
                <tr>
                    <td>${name}</td>
                    <td>${instruction.syntax}</td>
                    <td>${OPERANDS[instruction.syntax]}</td>
                    <td>${instruction.rv32i}</td>
                </tr>
            `
        )
        .join("");

    // ------------------------------------------------------------------
    // Register table
    // ------------------------------------------------------------------

    /**
     * Draw the GPR table, followed by the PC (sebaka).
     *
     * @param {number[]} values Register values.
     * @param {number} changed Register written in the last cycle,
     *                         highlighted; -1 means none.
     */
    function renderRegs(values, changed = -1) {
        const decimal = $("regFormat").value === "dec";

        const gprRows = REG_ALIASES
            .map(
                (alias, n) => `
                    <tr class="${n === changed ? "changed" : ""}">
                        <td>x${n}</td>
                        <td>${alias} · ${REG_SESOTHO[n]}</td>
                        <td>${
                            decimal
                                ? values[n] | 0
                                : hex32(values[n])
                        }</td>
                    </tr>
                `
            )
            .join("");

        // The PC is not in the register file, so it gets its own row.
        const pcRow = `
            <tr class="pcrow">
                <td>PC</td>
                <td>sebaka</td>
                <td>${decimal ? pc : hex32(pc)}</td>
            </tr>
        `;

        $("regTable").innerHTML = gprRows + pcRow;
    }

    $("regFormat").onchange = () => renderRegs(regs);

    renderRegs(regs);

    // ------------------------------------------------------------------
    // UI event wiring
    // ------------------------------------------------------------------

    Object.keys(EXAMPLES).forEach((name) => {
        $("example").add(
            new Option(`${name}.limo`, name)
        );
    });

    $("example").onchange = () => {
        if ($("example").value) {
            load(EXAMPLES[$("example").value]);
        }

        $("example").value = "";
    };

    $("assemble").onclick = run;

    $("open").onclick = () => {
        $("file").click();
    };

    $("file").onchange = (event) => {
        const file = event.target.files[0];

        if (file) {
            file.text().then(load);
        }

        event.target.value = "";
    };

    document
        .querySelectorAll('[name="mode"]')
        .forEach((radio) => {
            radio.onchange = () => {
                mode = radio.value;
                run();
            };
        });

    $("src").addEventListener("input", () => {
        updateLineNumbers();

        $("asmStatus").textContent = "Editing…";
        $("asmStatus").className = "status-chip";

        runSoon();
    });

    $("src").addEventListener("scroll", () => {
        $("lines").scrollTop = $("src").scrollTop;
    });

    document.addEventListener("keydown", (event) => {
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key === "Enter"
        ) {
            event.preventDefault();
            run();
        }
    });

    // Load the default example.
    load(EXAMPLES.sum);
})();