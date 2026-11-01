#!/usr/bin/env python3
"""Zip up the iOS-relevant source files of a React Native project.

Usage:
    python zip_project.py [project_root] [-o output.zip]

Defaults to the current directory, and writes <project_name>.zip there.
"""

import argparse
import zipfile
from pathlib import Path

# Extensions skipped everywhere
IGNORED_EXTENSIONS = {".gif"}
# Filenames skipped everywhere
IGNORED_NAMES = {".DS_Store"}

# (directory relative to root, allowed suffixes/names or None for "anything", recursive?)
# Each rule is applied independently; results are de-duplicated.
IOS_SOURCE_SUFFIXES = {".swift", ".m", ".h", ".js"}
IOS_SOURCE_NAMES = {"Podfile"}


def is_ignored(path: Path) -> bool:
    return path.suffix.lower() in IGNORED_EXTENSIONS or path.name in IGNORED_NAMES


def files_in(directory: Path, recursive: bool):
    """Yield files in a directory (optionally recursive); missing dirs yield nothing."""
    if not directory.is_dir():
        return
    iterator = directory.rglob("*") if recursive else directory.iterdir()
    for p in iterator:
        if p.is_file():
            yield p


def collect_files(root: Path) -> list[Path]:
    selected: set[Path] = set()

    # 1. Everything at the root (non-recursive), including .env even if gitignored
    selected.update(files_in(root, recursive=False))

    # 2. Everything under src/
    selected.update(files_in(root / "src", recursive=True))

    # 3. ios/ (top level): .swift, .m, .h, .js, and Podfile
    for p in files_in(root / "ios", recursive=False):
        if p.suffix in IOS_SOURCE_SUFFIXES or p.name in IOS_SOURCE_NAMES:
            selected.add(p)

    # 4. Explicit file
    app_delegate = root / "ios" / "Algernon" / "AppDelegate.swift"
    if app_delegate.is_file():
        selected.add(app_delegate)
    else:
        print(f"warning: {app_delegate.relative_to(root)} not found")

    # 5. ios/LLMEval/ and ios/LLMEval/LLM/: .swift and .h
    for sub in ("ios/LLMEval", "ios/LLMEval/LLM"):
        for p in files_in(root / sub, recursive=False):
            if p.suffix in {".swift", ".h"}:
                selected.add(p)

    # 6. ios/Models/: .swift
    for p in files_in(root / "ios" / "Models", recursive=False):
        if p.suffix == ".swift":
            selected.add(p)

    return sorted(p for p in selected if not is_ignored(p))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="project root (default: current dir)")
    parser.add_argument("-o", "--output", help="output zip path (default: <project_name>.zip)")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        raise SystemExit(f"error: {root} is not a directory")

    output = Path(args.output).resolve() if args.output else Path.cwd() / f"{root.name}.zip"

    files = [p for p in collect_files(root) if p.resolve() != output]

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            arcname = Path(root.name) / p.relative_to(root)
            zf.write(p, arcname)
            print(f"  + {p.relative_to(root)}")

    print(f"\nWrote {len(files)} files to {output}")


if __name__ == "__main__":
    main()