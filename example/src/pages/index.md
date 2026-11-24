---
layout: ../layouts/Layout.astro
title: A Python reading list
---

# A Python reading list

Start with the [Python beginner’s guide](https://www.python.org/about/gettingstarted/), then jump to [project resources](#project-resources).

## Try a small script

Count the file extensions in your downloads folder.
[`pathlib`](https://docs.python.org/3/library/pathlib.html) lists the files, and
[`Counter`](https://docs.python.org/3/library/collections.html#collections.Counter)
keeps a running total for each extension.

```python
from pathlib import Path
from collections import Counter

downloads = Path.home() / "Downloads"
extensions = Counter(
    path.suffix.lower() or "(no extension)"
    for path in downloads.iterdir() if path.is_file()
)
for extension, count in extensions.most_common(5):
    print(extension, count)
```

Save the script as `extensions.py` and run `python extensions.py`. To inspect
each total, follow the [VS Code Python debugging guide](https://code.visualstudio.com/docs/python/debugging)
and set a breakpoint on the `print` line.

## Project resources

- Find packages on the [Python Package Index](https://pypi.org/).
- Publish your project's documentation with [Read the Docs](https://readthedocs.org/).
