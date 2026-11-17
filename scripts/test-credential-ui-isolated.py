#!/usr/bin/env python3
"""Keep the V1 test entry point while exercising the V2 UI and print workflow.

The former test asserted the removed one-click add-all interface. The replacement
uses the same approved private certificate and synthetic data, and covers source
selection, both signatures, overflow, safe text, draft review and browser PDF.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(ROOT / 'scripts/test-credential-v2-ui.py')], cwd=ROOT, check=True)
