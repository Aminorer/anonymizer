#!/usr/bin/env python3
"""Utility script to remove TensorFlow and reinstall PyTorch-only deps.

Running this script helps resolve import errors caused by TensorFlow being
pulled in transitively by transformers.  It removes any TensorFlow packages and
pins the versions of ``transformers`` and ``torch`` used by the project.
"""

import subprocess
import sys
from typing import Sequence


def run_command(cmd: Sequence[str]) -> None:
    """Run *cmd* in a subprocess and exit on failure."""
    print("$", " ".join(cmd))
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def main() -> None:
    packages_to_remove = ["tensorflow", "tensorflow-cpu", "tf-keras"]
    for pkg in packages_to_remove:
        run_command([sys.executable, "-m", "pip", "uninstall", "-y", pkg])

    run_command([sys.executable, "-m", "pip", "uninstall", "-y", "transformers"])
    run_command(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "transformers==4.35.0",
            "torch==2.2.0",
            "tokenizers==0.14.1",
        ]
    )


if __name__ == "__main__":
    main()
