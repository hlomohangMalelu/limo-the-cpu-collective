# LIMO — The CPU Collective

### A Sesotho-Language Processor and Interactive Computer Architecture Project

>>Live site:https://hlomohangmalelu.github.io/limo-the-cpu-collective/

## Overview

**LIMO** is an educational computer architecture project that introduces processor design through a Sesotho-language instruction set architecture (ISA) derived from RISC-V.

The project provides a browser-based environment for writing LIMO assembly programs, assembling and disassembling instructions, and inspecting machine-code representations.


## Application

The LIMO web application provides:

- An assembly editor for writing LIMO programs.
- An assembler and disassembler.
- Machine-code representations in binary and hexadecimal.
- Colour-coded instruction-field visualisation.
- Register information and instruction references.
- Built-in example programs.
- Assembly error reporting with line numbers.

The application is designed to run directly in a modern web browser without requiring a backend server.

## Getting Started

### Requirements

- Git
- Node.js 20 or later
- Python 3
- A modern web browser

### Clone the repository

```bash
git clone https://github.com/hlomohangMalelu/limo-the-cpu-collective.git

cd limo-the-cpu-collective
```

### Run locally

Start a local web server:

```bash
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

### Run automated tests

```bash
npm test
```

### Regenerate example programs

Whenever files in `examples/` are modified, regenerate the browser examples:

```bash
npm run examples
```

## Project Structure

```text
limo-the-cpu-collective/
├── .github/       # GitHub Actions workflows
├── docs/          # Technical and design documentation
├── examples/      # LIMO assembly programs
├── scripts/       # Development utilities
├── src/           # Application and ISA implementation
├── tests/         # Automated tests
├── index.html     # Application entry point
├── style.css      # Application styles
├── package.json   # Project scripts and metadata
├── LICENSE        # Project licence
└── README.md
```

## Documentation

- [Design and Architecture](docs/DESIGN.md)
- [Project Source Code](src/)
- [Example Programs](examples/)
- [Automated Tests](tests/)

## Development

Contributions follow a feature-branch and pull-request workflow.

1. Create a feature branch.
2. Implement and test your changes.
3. Run `npm test`.
4. Regenerate examples when necessary using `npm run examples`.
5. Commit and push your changes.
6. Submit a pull request for review.

GitHub Actions automatically runs the test suite and deploys the application to GitHub Pages when the configured workflow succeeds.


## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

