# -*- coding: utf-8 -*-
"""
Fallback catalog, used only when Airtable is not configured.

`seed_cards.json` is GENERATED from the same content as the app's embedded pack
(`frontend/src/data/seedCards.ts`) and the Airtable table "Questions". Edit the
content in Airtable and regenerate; do not patch the JSON by hand.

Content rules (CLAUDE.md §2): zero alcohol, Hot content suggestive never explicit.
"""
import json
import os

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_cards.json")

with open(_PATH, encoding="utf-8") as _f:
    SEED_CARDS = json.load(_f)
