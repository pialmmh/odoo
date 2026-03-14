#!/bin/bash
cd "$(dirname "$0")"
./venv/bin/python odoo-src/odoo-bin -c odoo.conf "$@"
